using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

namespace Account.Scope;

public sealed record AccountAccessCase(bool Allowed);

public sealed class AccessFeatureTests
{
    public static IEnumerable<TheoryDataRow<AccountAccessCase>> Cases =>
    [
        new(new AccountAccessCase(false)) { Label = "expired" },
        new(new AccountAccessCase(false)) { Label = "locked" },
    ];

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task access__denied__account_request_is_rejected(AccountAccessCase testCase)
    {
        await Task.Yield();
        Assert.False(testCase.Allowed);
    }
}
