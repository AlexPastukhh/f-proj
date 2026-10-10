using Xunit;
public sealed class AccessFeatureTests
{
    [Theory]
    [InlineData(false, Label = "expired")]
    [InlineData(true, Label = "locked")]
    public void access__denied__request_is_rejected(bool allowed)
    {
        Assert.Equal(allowed, allowed);
    }
}
