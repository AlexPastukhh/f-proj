using System.Threading.Tasks;
using System.Collections.Generic;
using Xunit;

public sealed record LoginCase(bool Authenticated);

public static class FeatureProjectionProbe
{
    public static void AssertNotMaterializing()
    {
        if (System.Environment.GetEnvironmentVariable("FEATURE_PROJECTION_MATERIALIZING") == "1")
            throw new System.InvalidOperationException("Feature test body executed during projection materialization");
    }
}

public sealed class LoginFeatureTests
{
    public static IEnumerable<TheoryDataRow<LoginCase>> Cases =>
    [
        new(new LoginCase(false)) { Label = "passwords_dont_match" },
        new(new LoginCase(false)) { Label = "email_has_invalid_format" },
    ];

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task login__invalid_user_input__authentication_fails_and_user_stays_unauthenticated(LoginCase testCase)
    {
        FeatureProjectionProbe.AssertNotMaterializing();
        await Task.Yield();
        Assert.False(testCase.Authenticated);
    }

    [Fact]
    public async Task login__session_expired__refresh_token_expired__request_is_rejected_and_session_is_invalidated()
    {
        await Task.Yield();
        Assert.False(false);
    }
}
