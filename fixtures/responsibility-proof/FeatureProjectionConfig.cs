using System;
using System.Linq.Expressions;

namespace FeatureProjection
{
    // Minimal code-first contracts for an isolated Roslyn proof; no configuration is executed.
    public interface IFeatureProjectionConfiguration
    {
        void Configure(IFeatureProjectionBuilder builder);
    }

    public interface IFeatureProjectionBuilder
    {
        void RegisterResponsibility<T>(Expression<Action<T>> member) where T : class;
    }
}

public interface User
{
    void Authenticate(string input);
    void Authenticate(int attempt);
}

public interface Logger
{
    void Log(string message);
}

public sealed class FeatureProjectionConfig : FeatureProjection.IFeatureProjectionConfiguration
{
    public void Configure(FeatureProjection.IFeatureProjectionBuilder builder)
    {
        builder.RegisterResponsibility<User>(x => x.Authenticate(default(string)!));
    }
}
