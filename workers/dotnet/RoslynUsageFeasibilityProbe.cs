using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.FindSymbols;
using Microsoft.CodeAnalysis.MSBuild;

public static class RoslynUsageFeasibilityProbe
{
    // Research command only: no edit generation, no rename, no runtime Configure() execution.
    public static async Task<object> Analyze(WorkerRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Source.ProjectFile))
            throw new ArgumentException("projectFile required for symbol usage feasibility");

        if (!MSBuildLocator.IsRegistered) MSBuildLocator.RegisterDefaults();
        using var workspace = MSBuildWorkspace.Create();
        var project = await workspace.OpenProjectAsync(request.Source.ProjectFile);
        var targets = new Dictionary<IMethodSymbol, Registration>(SymbolEqualityComparer.Default);
        var errors = new List<string>();

        foreach (var document in project.Documents)
        {
            var root = await document.GetSyntaxRootAsync();
            var model = await document.GetSemanticModelAsync();
            if (root is null || model is null || document.FilePath is null) continue;

            foreach (var configClass in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                if (model.GetDeclaredSymbol(configClass) is not INamedTypeSymbol type ||
                    !type.AllInterfaces.Any(i => i.ToDisplayString() == "FeatureProjection.IFeatureProjectionConfiguration"))
                    continue;

                foreach (var configure in configClass.Members.OfType<MethodDeclarationSyntax>()
                             .Where(m => m.Identifier.ValueText == "Configure"))
                foreach (var registrationCall in configure.DescendantNodes().OfType<InvocationExpressionSyntax>())
                {
                    if (model.GetSymbolInfo(registrationCall).Symbol is not IMethodSymbol registration ||
                        registration.ContainingType.ToDisplayString() != "FeatureProjection.IFeatureProjectionBuilder" ||
                        (registration.Name != "RegisterResponsibility" && registration.Name != "RegisterAssertion"))
                        continue;

                    var kind = registration.Name == "RegisterResponsibility" ? "responsibility" : "assertion";
                    if (registrationCall.ArgumentList.Arguments.Count != 1 ||
                        registrationCall.ArgumentList.Arguments[0].Expression is not LambdaExpressionSyntax lambda ||
                        lambda.Body is not InvocationExpressionSyntax invocation ||
                        model.GetSymbolInfo(invocation).Symbol is not IMethodSymbol invoked)
                    {
                        errors.Add("Unresolved registered symbol; no usage query is valid for this registration");
                        continue;
                    }
                    var symbol = invoked.OriginalDefinition;
                    if (targets.ContainsKey(symbol))
                    {
                        errors.Add("Duplicate registration of same method symbol; ambiguous usage registration");
                        continue;
                    }
                    targets.Add(symbol, new Registration(kind, document.FilePath,
                        registrationCall.SpanStart, registrationCall.Span.End));
                }
            }
        }

        // Fail closed on ambiguous/unresolved registration. A partial usage view would
        // misleadingly imply completeness and could guide an unsafe rename.
        if (errors.Count > 0)
            return new { probeOnly = true, mutationSupported = false,
                targets = Array.Empty<object>(), diagnostics = errors.ToArray() } as object;

        var result = new List<object>();
        foreach (var (symbol, registration) in targets.OrderBy(p => p.Key.ToDisplayString(), StringComparer.Ordinal))
        {
            var references = new List<UsageEntry>();
            var usages = await SymbolFinder.FindReferencesAsync(symbol, project.Solution);
            foreach (var reference in usages)
            foreach (var location in reference.Locations)
            {
                var source = location.Location;
                // A FeatureSpace is scoped to its configured project. Do not silently
                // merge references from loaded project dependencies or other projects.
                if (!source.IsInSource || location.Document.FilePath is null ||
                    location.Document.Project.Id != project.Id) continue;
                var path = location.Document.FilePath;
                var range = source.GetLineSpan();
                var inTestRoot = IsWithin(path, request.Source.Root);
                var registrationReference =
                    string.Equals(Path.GetFullPath(path), Path.GetFullPath(registration.File), StringComparison.OrdinalIgnoreCase) &&
                    source.SourceSpan.Start >= registration.Start &&
                    source.SourceSpan.End <= registration.End;
                references.Add(new UsageEntry(
                    registrationReference ? "registration" : (inTestRoot ? "feature-test" : "project-source"),
                    new UsageRange(
                        path,
                        source.SourceSpan.Start,
                        source.SourceSpan.End,
                        range.StartLinePosition.Line + 1,
                        range.StartLinePosition.Character + 1
                    )));
            }
            result.Add(new {
                kind = registration.Kind,
                symbol = symbol.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat),
                registration = registration.File,
                references = references
                    .OrderBy(x => x.Source.File, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(x => x.Source.Start)
                    .ToArray()
            });
        }

        return new {
            probeOnly = true,
            mutationSupported = false,
            targets = result,
            diagnostics = errors
        };
    }

    private static bool IsWithin(string file, string root)
    {
        var rel = Path.GetRelativePath(Path.GetFullPath(root), Path.GetFullPath(file));
        return rel != "." && !Path.IsPathRooted(rel) &&
               rel != ".." && !rel.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) &&
               !rel.StartsWith(".." + Path.AltDirectorySeparatorChar, StringComparison.Ordinal);
    }

    private sealed record Registration(string Kind, string File, int Start, int End);
    private sealed record UsageRange(string File, int Start, int End, int Line, int Column);
    private sealed record UsageEntry(string Kind, UsageRange Source);
}
