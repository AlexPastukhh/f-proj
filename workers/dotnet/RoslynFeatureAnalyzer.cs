using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.MSBuild;

public static class RoslynFeatureAnalyzer
{
    public static async Task<object> Analyze(WorkerRequest request)
    {
        if (!MSBuildLocator.IsRegistered) MSBuildLocator.RegisterDefaults();
        if (string.IsNullOrWhiteSpace(request.Source.ProjectFile))
            return new { definitions = Array.Empty<object>(), diagnostics = new[] { new { ruleId = "worker/missing-project-file", category = "runtime", severity = "error", projectionImpact = "blocks-part", message = "projectFile is required" } } };

        using var workspace = MSBuildWorkspace.Create();
        var project = await workspace.OpenProjectAsync(request.Source.ProjectFile);
        var compilation = await project.GetCompilationAsync();
        if (compilation is null) throw new InvalidOperationException("Could not create C# compilation");
        var definitions = new List<object>();
        var diagnostics = new List<object>();
        var registeredResponsibilities = new HashSet<IMethodSymbol>(SymbolEqualityComparer.Default);
        var registeredAssertions = new HashSet<IMethodSymbol>(SymbolEqualityComparer.Default);

        // Configuration is inspected with Roslyn; it is never invoked or executed.
        // Search the project, not just feature roots: configuration commonly lives at project root.
        foreach (var document in project.Documents)
        {
            var configRoot = await document.GetSyntaxRootAsync();
            var configModel = await document.GetSemanticModelAsync();
            if (configRoot is null || configModel is null) continue;
            foreach (var configType in configRoot.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                if (configModel.GetDeclaredSymbol(configType) is not INamedTypeSymbol type ||
                    !type.AllInterfaces.Any(i => i.ToDisplayString() == "FeatureProjection.IFeatureProjectionConfiguration"))
                    continue;
                foreach (var configure in configType.Members.OfType<MethodDeclarationSyntax>().Where(m => m.Identifier.ValueText == "Configure"))
                foreach (var registrationCall in configure.DescendantNodes().OfType<InvocationExpressionSyntax>())
                {
                    var registration = configModel.GetSymbolInfo(registrationCall).Symbol as IMethodSymbol;
                    if (registration?.ContainingType.ToDisplayString() != "FeatureProjection.IFeatureProjectionBuilder" ||
                        (registration.Name != "RegisterResponsibility" && registration.Name != "RegisterAssertion"))
                        continue;
                    var isAssertionRegistration = registration.Name == "RegisterAssertion";
                    if (registrationCall.ArgumentList.Arguments.Count != 1 ||
                        registrationCall.ArgumentList.Arguments[0].Expression is not LambdaExpressionSyntax lambda ||
                        lambda.Body is not InvocationExpressionSyntax targetCall ||
                        configModel.GetSymbolInfo(targetCall).Symbol is not IMethodSymbol targetSymbol)
                    {
                        diagnostics.Add(new {
                            ruleId = isAssertionRegistration ? "feature-test/unresolved-assertion-registration" : "feature-test/unresolved-responsibility-registration",
                            category = "projection-safety", severity = "error", projectionImpact = "blocks-part",
                            message = "Registered method must resolve to one invocation symbol"
                        });
                        continue;
                    }
                    if (isAssertionRegistration) registeredAssertions.Add(targetSymbol.OriginalDefinition);
                    else registeredResponsibilities.Add(targetSymbol.OriginalDefinition);
                }
            }
        }

        foreach (var document in project.Documents)
        {
            var file = document.FilePath;
            if (file is null || !Path.GetFullPath(file).StartsWith(Path.GetFullPath(request.Source.Root), StringComparison.OrdinalIgnoreCase)) continue;
            var root = await document.GetSyntaxRootAsync();
            var model = await document.GetSemanticModelAsync();
            if (root is null || model is null) continue;

            foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
            {
                var fact = method.AttributeLists.SelectMany(x => x.Attributes).Any(a => a.Name.ToString().EndsWith("Fact") || a.Name.ToString().EndsWith("Theory"));
                if (!fact) continue;
                var isTheory = method.AttributeLists.SelectMany(x => x.Attributes).Any(a => a.Name.ToString().EndsWith("Theory"));
                var line = method.Identifier.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
                var folder = Path.GetRelativePath(request.Source.Root, Path.GetDirectoryName(file)!).Replace('\\','/');
                var assertions = new List<object>();
                foreach (var statement in method.Body?.Statements ?? default)
                {
                    var frameworkAssertion = statement.DescendantNodesAndSelf().OfType<InvocationExpressionSyntax>().Any(i =>
                    {
                        var symbol = model.GetSymbolInfo(i).Symbol as IMethodSymbol;
                        return symbol?.ContainingType?.ToDisplayString() == "Xunit.Assert";
                    });
                    var projectAssertion = IsRegisteredAssertion(statement, model, registeredAssertions);
                    var responsibilityVerification = IsRegisteredVerification(statement, model, registeredResponsibilities);
                    if (frameworkAssertion || projectAssertion || responsibilityVerification)
                    {
                        var span = statement.GetLocation().GetLineSpan();
                        assertions.Add(new { sourceCode = statement.ToFullString().Trim(), source = new { file, start = statement.SpanStart, end = statement.Span.End, line = span.StartLinePosition.Line + 1, column = span.StartLinePosition.Character + 1 }, kind = frameworkAssertion || projectAssertion ? "assertion" : "responsibility" });
                    }
                }
                definitions.Add(new {
                    id = $"{request.Source.Id}:{method.Identifier.ValueText}:{line}",
                    featureSpaceId = request.FeatureSpaceId,
                    logicalFolderKey = string.IsNullOrEmpty(folder) ? "." : folder,
                    partRole = request.Source.Role,
                    adapterId = "xunit-v3",
                    frameworkProject = request.Source.FrameworkProject,
                    isParameterized = isTheory,
                    rawDescription = method.Identifier.ValueText,
                    assertions,
                    source = new { file, start = method.SpanStart, end = method.Span.End, line, column = method.Identifier.GetLocation().GetLineSpan().StartLinePosition.Character + 1 },
                    definitionRef = new { adapterId = "xunit-v3", frameworkProject = request.Source.FrameworkProject, frameworkDefinitionKey = BuildDefinitionKey(model.GetDeclaredSymbol(method) as IMethodSymbol), sourceFile = file, sourceLine = line },
                    caseSourceAnchors = isTheory ? StaticInlineCaseAnchors(method, model, file) : Array.Empty<object>(),
                    diagnostics = Array.Empty<object>()
                });
            }
        }
        return new { definitions, diagnostics };
    }

    private static object[] StaticInlineCaseAnchors(
        MethodDeclarationSyntax method,
        SemanticModel model,
        string file)
    {
        // Only attributes semantically bound to Xunit.InlineDataAttribute are eligible.
        // Other data providers, runtime label calculations and ambiguous labels fall
        // back to the test-definition source. No concrete case is created here.
        var attrs = method.AttributeLists.SelectMany(list => list.Attributes).ToList();
        var labels = new HashSet<string>(StringComparer.Ordinal);
        var anchors = new List<object>();
        foreach (var attribute in attrs)
        {
            var constructor = model.GetSymbolInfo(attribute).Symbol as IMethodSymbol;
            if (constructor?.ContainingType.ToDisplayString() == "Xunit.TheoryAttribute")
                continue;
            if (constructor?.ContainingType.ToDisplayString() != "Xunit.InlineDataAttribute")
                return Array.Empty<object>();

            var labelArguments = attribute.ArgumentList?.Arguments
                .Where(arg => arg.NameEquals?.Name.Identifier.ValueText == "Label")
                .ToArray() ?? [];
            if (labelArguments.Length != 1 ||
                labelArguments[0].Expression is not LiteralExpressionSyntax literal ||
                !literal.IsKind(SyntaxKind.StringLiteralExpression))
                return Array.Empty<object>();

            var label = literal.Token.ValueText;
            if (string.IsNullOrWhiteSpace(label) || !labels.Add(label))
                return Array.Empty<object>();
            var span = attribute.GetLocation().GetLineSpan();
            anchors.Add(new {
                label,
                source = new {
                    file,
                    start = attribute.SpanStart,
                    end = attribute.Span.End,
                    line = span.StartLinePosition.Line + 1,
                    column = span.StartLinePosition.Character + 1,
                }
            });
        }
        return anchors.ToArray();
    }

    private static bool IsRegisteredAssertion(
        StatementSyntax statement,
        SemanticModel model,
        HashSet<IMethodSymbol> registered)
    {
        if (registered.Count == 0 ||
            statement is not ExpressionStatementSyntax { Expression: InvocationExpressionSyntax call })
            return false;

        return model.GetSymbolInfo(call).Symbol is IMethodSymbol method &&
               registered.Contains(method.OriginalDefinition);
    }

    private static bool IsRegisteredVerification(
        StatementSyntax statement,
        SemanticModel model,
        HashSet<IMethodSymbol> registered)
    {
        if (registered.Count == 0 ||
            statement is not ExpressionStatementSyntax { Expression: InvocationExpressionSyntax call })
            return false;

        var verificationMethod = model.GetSymbolInfo(call).Symbol as IMethodSymbol;
        if (verificationMethod?.Name != "Verify" ||
            verificationMethod.ContainingNamespace.ToDisplayString() != "Moq")
            return false;

        // Only a method invocation *inside the verification lambda* may supply
        // evidence. Same-named methods or unrelated ordinary calls do not match.
        foreach (var argument in call.ArgumentList.Arguments)
        {
            if (argument.Expression is not LambdaExpressionSyntax lambda) continue;
            foreach (var invoked in lambda.Body.DescendantNodesAndSelf().OfType<InvocationExpressionSyntax>())
            {
                if (model.GetSymbolInfo(invoked).Symbol is IMethodSymbol symbol &&
                    registered.Contains(symbol.OriginalDefinition))
                    return true;
            }
        }
        return false;
    }

    private static string BuildDefinitionKey(IMethodSymbol? method)
    {
        if (method is null) return "<unresolved>";
        var typeName = method.ContainingType.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat);
        // Reflection-based xUnit discovery uses CLR type names (System.Boolean, not
        // C# aliases like bool). Do not enable SymbolDisplayMiscellaneousOptions.UseSpecialTypes.
        var frameworkTypeFormat = new SymbolDisplayFormat(
            globalNamespaceStyle: SymbolDisplayGlobalNamespaceStyle.Omitted,
            typeQualificationStyle: SymbolDisplayTypeQualificationStyle.NameAndContainingTypesAndNamespaces,
            genericsOptions: SymbolDisplayGenericsOptions.IncludeTypeParameters,
            miscellaneousOptions: SymbolDisplayMiscellaneousOptions.EscapeKeywordIdentifiers);
        var parameters = string.Join(", ", method.Parameters.Select(p =>
            p.Type.ToDisplayString(frameworkTypeFormat)));
        return $"{typeName}.{method.Name}({parameters})";
    }

}
