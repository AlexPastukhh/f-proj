# Feature Projection 0.1.0

Windows-first alpha VS Code extension that reconstructs an end-to-end feature projection from feature-level tests and framework metadata.

```text
Feature
└─ Outcome
   └─ Situation
      ├─ Frontend
      │  ├─ Expected Behavior
      │  └─ literal Assertions
      └─ Backend
         ├─ Expected Behavior
         └─ literal Assertions
```

## Accepted platform and prerequisites

`0.1.0` is accepted on **Windows x64**.

- Vitest sources require a supported external **Node.js** installation. Feature Projection resolves Node from `featureProjection.nodePath`, `PATH`, or common Windows locations.
- xUnit sources require a compatible **.NET SDK/runtime** for project analysis/build/materialization.
- Runtime/project evaluation happens only after an explicit **Refresh** in a **trusted workspace**.
- Restricted Mode never starts the Vitest runtime worker, Roslyn/MSBuild project analysis, `dotnet build`, or xUnit materialization.

Missing Node or .NET prerequisites are reported as actionable blocking diagnostics rather than silently skipped.

## Supported framework pair

The accepted first pair is:

```text
TypeScript / Vitest 5.0.3
C# / xUnit.net v3 4.0.1
```

Parameterized Situation identity comes from framework-native case labels, never arbitrary business/error payload fields.

## Install

Build/package from the repository:

```powershell
npm install
npm run prepare:dotnet-worker
npm run package:vsix
```

Install:

```text
artifacts/feature-projection-prototype-p0-0.1.0.vsix
```

The VSIX contains the compiled extension, the Vitest worker, the framework-dependent .NET worker runtime, and `typescript@5.8.3` as its explicit production Node dependency. Normal users do not run `npm install` or compile extension-owned C# code.

## Configure and use

1. Open a single-folder workspace and trust it if you want runtime/project-backed evidence.
2. Run **Feature Projection: Configure**.
3. Configure each FeatureSpace source explicitly: source id, Frontend/Backend role, feature-test root, adapter, framework project, and adapter-specific config/project file when needed.
4. Run **Feature Projection: Refresh** explicitly.
5. Inspect the projection document and Test Explorer.
6. Open Frontend/Backend source from the projection editor, Markdown Preview links, or Testing API items.

Configure never auto-runs framework materialization. Relevant source/config changes mark the projection **Stale**; Refresh remains explicit.

## Semantic identity

```text
FeatureScope = FeatureSpaceId + logicalFolderKey
```

Inside a FeatureScope, Frontend and Backend match only on exact:

```text
FeatureName + Outcome + Situation
```

Unknown, unmatched, unresolved, or blocked evidence stays explicit rather than being inferred.

## Test naming

Non-parameterized:

```text
<feature>__<outcome>__<situation>__<expected_behavior>
```

Parameterized definition:

```text
<feature>__<outcome>__<expected_behavior>
```

The concrete Situation comes from the framework-native case label.

## Current configuration settings

- `featureProjection.featureSpaces` — configured FeatureSpaces and sources.
- `featureProjection.workerTimeoutMs` — analysis/materialization worker timeout; default 30000 ms.
- `featureProjection.buildTimeoutMs` — trusted xUnit project-build and development worker-bootstrap timeout; default 120000 ms.
- `featureProjection.nodePath` — optional absolute path to an external Node executable.

## Current limitations

- Windows x64 is the only installed-VSIX acceptance platform for 0.1.0.
- Configure intentionally supports one workspace folder; full VS Code multi-root workspace support is not implemented.
- Parameterized source navigation is definition-level rather than exact row/case-level.
- Testing API is publish/navigation-only; Feature Projection does not add Run/Debug profiles yet.
- No public stable normalized JSON export or incremental cache yet.
- Registered business/domain responsibility proof and broader projection-safety fixture matrix remain post-0.1 hardening work.

## Verification

Primary release checks:

```powershell
npm test
powershell -ExecutionPolicy Bypass -File .\scripts\verify-real-p0.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\verify-extension-host.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\verify-installed-vsix.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\verify-second-workspace.ps1
```

Installed smoke runs outside source-checkout ancestry and verifies that the VSIX carries its required runtime dependencies instead of accidentally resolving development `node_modules`.
