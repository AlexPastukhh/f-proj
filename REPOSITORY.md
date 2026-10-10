# Repository workflow

Canonical development checkout (Windows):

```text
%USERPROFILE%\Repos\feature-projection
```

Remote: https://github.com/AlexPastukhh/f-proj (public; branch `main`).

The source checkout, test fixtures, automation scripts and evolving
project decisions in `docs/plan/` are Git-versioned. Prior accepted
release binaries and subsequent VSIX candidates are stored as local
copies in `artifacts/`, **ignored by Git**. An inventory with SHA-256
checksums is recorded in `artifacts/INDEX.md` and *is* versioned.

## Recreate dependencies

From the repository root, in PowerShell:

```powershell
npm ci
dotnet restore workers/dotnet/FeatureProjection.DotNetWorker.csproj
dotnet restore fixtures/responsibility-proof/Responsibility.FeatureTests.csproj
dotnet restore fixtures/assertion-helper-proof/AssertionHelper.FeatureTests.csproj
npm test
node scripts/verify-usage-symbol-feasibility.mjs
npm run build:dotnet-worker
```

Restore other `fixtures/**/**/*.csproj` as required by additional smoke tests.
Ignored `node_modules`, `dist`, .NET `bin/obj/runtime`, and VS Code
test-profile caches are *generated state*, not Git source of truth.
The local developer checkout may retain these files for fast iterative tests.

Ordinary-user P1/P2 acceptance workspaces are test workspaces, not the
product repository; their input fixtures are versioned under `fixtures/`.
The original `Downloads` project checkout is retained temporarily as
a fallback until the new GitHub-backed workflow is validated. Do not
delete previously accepted releases or reconstruct candidate hashes.

## Acceptance status

The current feature implementation is the internal 0.1.0 alpha. P2/8.3b
registered C# Usage View has isolated installed and ordinary-user manual
acceptance recorded in D-056/D-057. P2/8.3c (Rename/refactor semantic
safety) has *not* been implemented. Read-only workflow is the starting
point. No remote Git commit should imply a public extension release.
