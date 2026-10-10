using System.Reflection;
using System.Runtime.Loader;
using Xunit;
using Xunit.Runner.Common;
using Xunit.Sdk;
using Xunit.v3;

public static class XunitCaseMaterializer
{
    public static async Task<object> Materialize(WorkerRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Source.ProjectFile))
            return Failure("worker/missing-project-file", "projectFile is required for xUnit materialization");

        var assemblyPath = FindBuiltAssembly(request.Source);
        if (assemblyPath is null)
            return Failure(
                "worker/xunit-test-assembly-missing",
                $"Built test assembly was not found for '{request.Source.ProjectFile}'. Build the test project in Release configuration before materialization."
            );

        var assemblyDirectory = Path.GetDirectoryName(assemblyPath)!;
        Assembly? ResolveDependency(AssemblyLoadContext context, AssemblyName name)
        {
            var candidate = Path.Combine(assemblyDirectory, name.Name + ".dll");
            if (!File.Exists(candidate)) return null;
            return context.LoadFromAssemblyPath(candidate);
        }

        AssemblyLoadContext.Default.Resolving += ResolveDependency;
        var previousProbe = Environment.GetEnvironmentVariable("FEATURE_PROJECTION_MATERIALIZING");
        Environment.SetEnvironmentVariable("FEATURE_PROJECTION_MATERIALIZING", "1");
        try
        {
            var testAssembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(assemblyPath);

            // Discovery/materialization may execute theory data providers, but it must never execute
            // the feature-test method body. Keep this operation inside the already isolated .NET worker.
            TestContext.SetForInitialization(null, diagnosticMessages: false, internalDiagnosticMessages: false);

            await using var testFramework = new XunitTestFramework();
            var frontController = new InProcessFrontController(testFramework, testAssembly, configFilePath: null);
            var discoveryOptions = TestFrameworkOptions.ForDiscoveryFromSerialization("{}");
            discoveryOptions.SetPreEnumerateTheories(true);

            var discovered = new List<IXunitTestCase>();
            using var cancellation = new CancellationTokenSource();

            await frontController.Find(
                messageSink: null,
                options: discoveryOptions,
                filter: _ => true,
                cancellationTokenSource: cancellation,
                types: null,
                discoveryCallback: (testCase, passedFilter) =>
                {
                    if (passedFilter && testCase is IXunitTestCase xunitTestCase)
                        discovered.Add(xunitTestCase);
                    return new ValueTask<bool>(true);
                }
            );

            var cases = new List<object>();
            var diagnostics = new List<object>();

            foreach (var testCase in discovered)
            {
                var isTheory = testCase.TestMethod.FactAttributes.Any(a => a is ITheoryAttribute);
                if (!isTheory)
                    continue;

                IReadOnlyCollection<IXunitTest> concreteTests;
                try
                {
                    concreteTests = await testCase.CreateTests();
                }
                catch (Exception ex)
                {
                    diagnostics.Add(Diagnostic(
                        "worker/xunit-create-tests-failed",
                        "error",
                        "blocks-part",
                        $"xUnit CreateTests() failed for '{testCase.TestCaseDisplayName}': {ex.GetBaseException().Message}"
                    ));
                    continue;
                }

                if (concreteTests.Count == 0)
                {
                    diagnostics.Add(Diagnostic(
                        "worker/xunit-no-concrete-tests",
                        "warning",
                        "blocks-part",
                        $"xUnit theory produced no concrete tests: {testCase.TestCaseDisplayName}"
                    ));
                    continue;
                }

                foreach (var test in concreteTests)
                {
                    var method = test.TestMethod.Method;
                    var definitionKey = BuildDefinitionKey(method);
                    var label = test.TestLabel;
                    var perCaseDiagnostics = new List<object>();

                    if (string.IsNullOrWhiteSpace(label))
                    {
                        perCaseDiagnostics.Add(Diagnostic(
                            "feature-test/missing-situation-id",
                            "error",
                            "blocks-part",
                            $"xUnit theory row has no explicit Label: {test.TestDisplayName}"
                        ));
                    }

                    cases.Add(new
                    {
                        definitionRef = new
                        {
                            adapterId = "xunit-v3",
                            frameworkProject = request.Source.FrameworkProject,
                            frameworkDefinitionKey = definitionKey,
                            sourceFile = string.Empty,
                            sourceLine = 0,
                        },
                        frameworkCaseId = test.UniqueID,
                        situationId = label,
                        displayName = test.TestDisplayName,
                        diagnostics = perCaseDiagnostics,
                    });
                }
            }

            return new { cases, diagnostics };
        }
        catch (Exception ex)
        {
            return Failure(
                "worker/xunit-materialization-failed",
                $"xUnit materialization failed: {ex.GetBaseException().Message}"
            );
        }
        finally
        {
            Environment.SetEnvironmentVariable("FEATURE_PROJECTION_MATERIALIZING", previousProbe);
            AssemblyLoadContext.Default.Resolving -= ResolveDependency;
        }
    }

    private static string BuildDefinitionKey(MethodInfo method)
    {
        var typeName = method.DeclaringType?.FullName?.Replace('+', '.') ?? method.DeclaringType?.Name ?? "<unknown>";
        var parameters = string.Join(", ", method.GetParameters().Select(p => DisplayTypeName(p.ParameterType)));
        return $"{typeName}.{method.Name}({parameters})";
    }

    private static string DisplayTypeName(Type type)
    {
        if (type.IsByRef)
            return DisplayTypeName(type.GetElementType()!);
        if (type.IsArray)
            return DisplayTypeName(type.GetElementType()!) + "[]";
        if (!type.IsGenericType)
            return type.FullName ?? type.Name;

        var genericName = type.GetGenericTypeDefinition().FullName ?? type.Name;
        var tick = genericName.IndexOf('`');
        if (tick >= 0) genericName = genericName[..tick];
        return $"{genericName}<{string.Join(", ", type.GetGenericArguments().Select(DisplayTypeName))}>";
    }

    private static string? FindBuiltAssembly(SourceConfig source)
    {
        var projectFile = source.ProjectFile;
        if (string.IsNullOrWhiteSpace(projectFile)) return null;
        var projectName = Path.GetFileNameWithoutExtension(projectFile);
        var root = Path.Combine(source.FrameworkProject, "bin", "Release");
        if (!Directory.Exists(root)) return null;

        return Directory
            .EnumerateFiles(root, projectName + ".dll", SearchOption.AllDirectories)
            .Where(p => !p.Contains($"{Path.DirectorySeparatorChar}ref{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .FirstOrDefault();
    }

    private static object Failure(string ruleId, string message) => new
    {
        cases = Array.Empty<object>(),
        diagnostics = new[] { Diagnostic(ruleId, "error", "blocks-part", message) },
    };

    private static object Diagnostic(string ruleId, string severity, string projectionImpact, string message) => new
    {
        ruleId,
        category = "runtime",
        severity,
        projectionImpact,
        message,
    };
}
