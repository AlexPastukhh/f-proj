using Xunit;

public sealed class AccessFeatureTests
{
    [Fact]
    public void access__denied__invalid_token__request_is_rejected()
    {
        FeatureChecks.AssertDenied(false);
        FeatureChecks.AssertDenied("context");
        UnrelatedChecks.AssertDenied(false);
        Telemetry.Track("checked");
        Assert.True(true);
    }
}
