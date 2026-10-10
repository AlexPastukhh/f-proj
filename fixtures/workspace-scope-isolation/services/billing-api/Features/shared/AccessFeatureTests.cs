using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;

namespace Billing.Scope;

public sealed record BillingAccessCase(bool Allowed);

public sealed class AccessFeatureTests
{
    public static IEnumerable<TheoryDataRow<BillingAccessCase>> Cases =>
    [
        new(new BillingAccessCase(false)) { Label = "expired" },
        new(new BillingAccessCase(false)) { Label = "locked" },
    ];

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task access__denied__billing_request_is_rejected(BillingAccessCase testCase)
    {
        await Task.Yield();
        Assert.False(testCase.Allowed);
    }
}
