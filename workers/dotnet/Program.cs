using System.Text.Json;

var request = JsonSerializer.Deserialize<WorkerRequest>(Console.In.ReadToEnd(), JsonOptions())
    ?? throw new InvalidOperationException("Missing worker request");
object result = request.Command switch
{
    "analyze" => await RoslynFeatureAnalyzer.Analyze(request),
    "materialize-xunit" => await XunitCaseMaterializer.Materialize(request),
    "probe-registered-usages" => await RoslynUsageFeasibilityProbe.Analyze(request),
    "probe-registered-rename" => await RoslynRenameFeasibilityProbe.Analyze(request),
    _ => new { error = $"Unknown command: {request.Command}" }
};
Console.Write(JsonSerializer.Serialize(result, JsonOptions()));

static JsonSerializerOptions JsonOptions() => new(JsonSerializerDefaults.Web) { WriteIndented = false };

public sealed record WorkerRequest(string Command, string FeatureSpaceId, SourceConfig Source,
    string? Symbol = null, string? NewName = null, bool Profile = false);
public sealed record SourceConfig(string Id, string Role, string Root, string Adapter, string FrameworkProject, string? ProjectFile);
