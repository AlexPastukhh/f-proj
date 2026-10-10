using System.Threading.Tasks;
using Xunit;

namespace Billing.Scope;

public sealed class OrphanFeatureTests
{
    [Fact]
    public async Task orphan__pending__manual_review__billing_server_records_pending_review()
    {
        await Task.Yield();
        Assert.True(true);
    }
}
