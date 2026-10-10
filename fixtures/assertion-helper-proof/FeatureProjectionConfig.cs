using System;
using System.Linq.Expressions;

namespace FeatureProjection
{
    // Local symbol-bearing proof contract. Configure is never executed by the worker.
    public interface IFeatureProjectionConfiguration
    {
        void Configure(IFeatureProjectionBuilder builder);
    }

    public interface IFeatureProjectionBuilder
    {
        void RegisterAssertion(Expression<Action> method);
    }
}

public static class FeatureChecks
{
    public static void AssertDenied(bool granted)
    {
        if (granted) throw new InvalidOperationException("Expected denied");
    }

    public static void AssertDenied(string context) { }
}

public static class UnrelatedChecks
{
    public static void AssertDenied(bool granted) { }
}

public static class Telemetry
{
    public static void Track(string message) { }
}

// Same API spelling but wrong declaring type: must not register any assertion.
public sealed class PretendBuilder
{
    public void RegisterAssertion(Expression<Action> method) { }
}

public sealed class FeatureProjectionConfig : FeatureProjection.IFeatureProjectionConfiguration
{
    public void Configure(FeatureProjection.IFeatureProjectionBuilder builder)
    {
        builder.RegisterAssertion(() => FeatureChecks.AssertDenied(default(bool)));
        new PretendBuilder().RegisterAssertion(() => UnrelatedChecks.AssertDenied(default(bool)));
        throw new InvalidOperationException("Roslyn must not execute Configure()");
    }
}
