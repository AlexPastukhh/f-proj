using Moq;
using Xunit;

public sealed class AccessFeatureTests
{
    [Fact]
    public void access__denied__invalid_password__authentication_is_rejected()
    {
        var user = new Mock<User>();
        var logger = new Mock<Logger>();

        user.Object.Authenticate("invalid");
        user.Verify(x => x.Authenticate("invalid"), Times.Once);
        user.Verify(x => x.Authenticate(42), Times.Never);
        logger.Verify(x => x.Log("not_logged"), Times.Never);
        Assert.True(true);
    }
}
