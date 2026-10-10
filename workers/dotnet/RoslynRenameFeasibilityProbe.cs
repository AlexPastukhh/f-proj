using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.FindSymbols;
using Microsoft.CodeAnalysis.MSBuild;
using Microsoft.CodeAnalysis.Rename;
using Microsoft.CodeAnalysis.Text;

public static class RoslynRenameFeasibilityProbe
{
    // A deliberately read-only research command. Never ApplyChanges or write user files.
    public static async Task<object> Analyze(WorkerRequest request)
    {
        object Refuse(string reason) => new {
            probeOnly = true, mutationSupported = false, accepted = false,
            projectScopeOnly = true, symbol = request.Symbol, newName = request.NewName,
            edits = Array.Empty<object>(), diagnostics = new[] { reason }
        };

        if (request.Source.Adapter != "xunit-v3" || string.IsNullOrWhiteSpace(request.Source.ProjectFile))
            return Refuse("Only an explicitly configured xUnit C# project is accepted");
        if (string.IsNullOrWhiteSpace(request.Symbol) || string.IsNullOrWhiteSpace(request.NewName))
            return Refuse("Exact registered method signature and new name required");
        if (!SyntaxFacts.IsValidIdentifier(request.NewName) ||
            SyntaxFacts.GetKeywordKind(request.NewName) != SyntaxKind.None ||
            request.NewName.StartsWith("@", StringComparison.Ordinal))
            return Refuse("New name is not a conservative C# identifier");
        var projectFile = Path.GetFullPath(request.Source.ProjectFile);
        var projectRoot = Path.GetFullPath(request.Source.FrameworkProject);
        if (!projectFile.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase) ||
            !Within(projectRoot, projectFile) || !Within(projectRoot, request.Source.Root) ||
            !File.Exists(projectFile) || !Directory.Exists(request.Source.Root))
            return Refuse("Project or source is outside configured C# project");

        if (!MSBuildLocator.IsRegistered) MSBuildLocator.RegisterDefaults();
        using var workspace = MSBuildWorkspace.Create();
        var project = await workspace.OpenProjectAsync(projectFile);
        if (project.Solution.Projects.Count() != 1)
            return Refuse("Only a single loaded C# project may be previewed");
        var registrations = new Dictionary<IMethodSymbol, int>(SymbolEqualityComparer.Default);
        var errors = new List<string>();
        foreach (var document in project.Documents)
        {
            var root = await document.GetSyntaxRootAsync();
            var model = await document.GetSemanticModelAsync();
            if (root == null || model == null || document.FilePath == null) continue;
            foreach (var typeNode in root.DescendantNodes().OfType<ClassDeclarationSyntax>())
            {
                if (model.GetDeclaredSymbol(typeNode) is not INamedTypeSymbol type ||
                    !type.AllInterfaces.Any(i => i.ToDisplayString() == "FeatureProjection.IFeatureProjectionConfiguration"))
                    continue;
                foreach (var configure in typeNode.Members.OfType<MethodDeclarationSyntax>()
                             .Where(m => m.Identifier.ValueText == "Configure"))
                foreach (var call in configure.DescendantNodes().OfType<InvocationExpressionSyntax>())
                {
                    if (model.GetSymbolInfo(call).Symbol is not IMethodSymbol registration ||
                        registration.ContainingType.ToDisplayString() != "FeatureProjection.IFeatureProjectionBuilder" ||
                        (registration.Name != "RegisterResponsibility" && registration.Name != "RegisterAssertion"))
                        continue;
                    if (call.ArgumentList.Arguments.Count != 1 ||
                        call.ArgumentList.Arguments[0].Expression is not LambdaExpressionSyntax lambda ||
                        lambda.Body is not InvocationExpressionSyntax invoked ||
                        model.GetSymbolInfo(invoked).Symbol is not IMethodSymbol resolved)
                    {
                        errors.Add("Unresolved method registration; refuse rename preview");
                        continue;
                    }
                    if (!registrations.TryAdd(resolved.OriginalDefinition, 1))
                        errors.Add("Duplicate registered method symbol; refuse partial rename preview");
                }
            }
        }
        if (errors.Count != 0) return Refuse(string.Join("; ", errors));
        var matches = registrations.Keys.Where(m =>
            m.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat) == request.Symbol).ToList();
        if (matches.Count != 1)
            return Refuse("Exact registered C# method symbol is missing or ambiguous");
        var target = matches.Single();
        if (target.Name == request.NewName) return Refuse("New name equals original name");
        // Conservative: reject ANY same-name member on the declaring type,
        // even an overload with another signature.
        if (target.ContainingType.GetMembers(request.NewName).Length > 0)
            return Refuse("Name collision on declaring C# type");
        var originalCompilation = await project.GetCompilationAsync();
        if (originalCompilation == null ||
            originalCompilation.GetDiagnostics().Any(d => d.Severity == DiagnosticSeverity.Error))
            return Refuse("Original C# project has errors; semantic safety unprovable");
        var references = await SymbolFinder.FindReferencesAsync(target, project.Solution);
        if (references.SelectMany(r => r.Locations).Any(r => r.Document.Project.Id != project.Id))
            return Refuse("Symbol references outside selected project; cross-project rename refused");

        // Roslyn returns an immutable Solution; no filesystem mutation.
        var afterSolution = await Renamer.RenameSymbolAsync(project.Solution, target,
            new SymbolRenameOptions(false, false, false, false), request.NewName);
        var projectChanges = afterSolution.GetChanges(project.Solution).GetProjectChanges().ToList();
        if (projectChanges.Count != 1 || projectChanges[0].ProjectId != project.Id)
            return Refuse("Unexpected project change");
        var changes = projectChanges.Single();
        if (changes.GetAddedDocuments().Any() || changes.GetRemovedDocuments().Any() ||
            changes.GetChangedAdditionalDocuments().Any())
            return Refuse("Rename changed non-source resources or document set");
        var edits = new List<Edit>();
        var originalLocations = target.Locations
            .Concat(references.SelectMany(r => r.Locations).Select(r => r.Location))
            .Where(l => l.IsInSource).ToList();
        foreach (var id in changes.GetChangedDocuments())
        {
            var oldDoc = project.Solution.GetDocument(id);
            var newDoc = afterSolution.GetDocument(id);
            if (oldDoc == null || newDoc == null || oldDoc.FilePath == null ||
                !Within(projectRoot, oldDoc.FilePath) || !File.Exists(oldDoc.FilePath))
                return Refuse("Changed document outside selected project");
            var originalText = await oldDoc.GetTextAsync();
            var allowedTokens = originalLocations
                .Where(l => string.Equals(l.SourceTree?.FilePath, oldDoc.FilePath,
                    StringComparison.OrdinalIgnoreCase))
                .Select(l => l.SourceSpan).Distinct().ToList();
            var textChanges = (await newDoc.GetTextChangesAsync(oldDoc)).ToList();
            foreach (var change in textChanges)
            {
                var owners = allowedTokens.Where(span =>
                    change.Span.Start >= span.Start && change.Span.End <= span.End).ToList();
                if (owners.Count != 1)
                    return Refuse("Roslyn changed text outside one exact registered method token");
            }
            foreach (var token in allowedTokens)
            {
                var tokenEdits = textChanges.Where(c =>
                    c.Span.Start >= token.Start && c.Span.End <= token.End)
                    .OrderByDescending(c => c.Span.Start).ToList();
                if (tokenEdits.Count == 0) continue;
                var originalName = originalText.ToString(token);
                if (originalName != target.Name)
                    return Refuse("Resolved method token does not match the registered name");
                var resultingName = originalName;
                foreach (var change in tokenEdits)
                {
                    var index = change.Span.Start - token.Start;
                    resultingName = resultingName.Remove(index, change.Span.Length)
                        .Insert(index, change.NewText ?? string.Empty);
                }
                if (resultingName != request.NewName)
                    return Refuse("Renamed token does not equal the exact requested C# identifier");
                var pos = originalText.Lines.GetLinePosition(token.Start);
                edits.Add(new Edit(oldDoc.FilePath, token.Start, token.End,
                    pos.Line + 1, pos.Character + 1, originalName, resultingName));
            }
        }
        if (edits.Count == 0) return Refuse("Roslyn produced no method edits");
        var rewrittenCompilation = await afterSolution.GetProject(project.Id)!.GetCompilationAsync();
        if (rewrittenCompilation == null ||
            rewrittenCompilation.GetDiagnostics().Any(d => d.Severity == DiagnosticSeverity.Error))
            return Refuse("In-memory renamed project has C# compilation errors");
        // Preview is project-scoped and read-only. External consumers, runtime
        // labels, reflection and cross-language callers are NOT covered.
        return new {
            probeOnly = true, mutationSupported = false, accepted = true,
            projectScopeOnly = true, symbol = request.Symbol, newName = request.NewName,
            edits = edits.OrderBy(e => e.File, StringComparer.OrdinalIgnoreCase)
                .ThenBy(e => e.Start).ToArray(),
            diagnostics = Array.Empty<string>()
        };
    }

    private static bool Within(string root, string candidate)
    {
        var rel = Path.GetRelativePath(Path.GetFullPath(root), Path.GetFullPath(candidate));
        return rel != "." && !Path.IsPathRooted(rel) &&
            rel != ".." && !rel.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal) &&
            !rel.StartsWith(".." + Path.AltDirectorySeparatorChar, StringComparison.Ordinal);
    }
    private sealed record Edit(string File, int Start, int End,
        int Line, int Column, string OldText, string NewText);
}
