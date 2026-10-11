# Feature Projection — Decisions and Deltas

Purpose: preserve the original v11 design while recording facts learned from executable prototypes. This file is append-oriented. Do not silently edit historical assumptions to make them look as if they were always known.

## Status meanings

```text
CONFIRMED   original design assumption was empirically confirmed
CHANGED     prototype evidence supersedes a specific historical assumption
ADOPTED     new product/implementation decision introduced after v11
OPEN        mechanism is not yet fixed
```

## D-001 — Core semantic projection remains unchanged

Status: CONFIRMED

```text
Feature -> Outcome -> Situation -> Frontend/Backend
```

Join remains:

```text
inside FeatureScope:
FeatureName + Outcome + Situation
```

Evidence: real 0.0.11 Vitest+xUnit fixture produces the expected three joined Situations.

Impact: no semantic redesign is needed for the usable-extension phase.

---

## D-002 — Parameterized Situation is framework-native concrete-case identity

Status: CONFIRMED

Never derive parameterized Situation from arbitrary input/error/business payload.

Vitest carrier:

```text
[situation:<canonical-id>]
```

xUnit carrier:

```text
TheoryDataRow.Label -> IXunitTest.TestLabel
```

Evidence: both real framework materializers produce `passwords_dont_match` and `email_has_invalid_format` without payload inference.

---

## D-003 — Vitest title truncation setting changed

Status: CHANGED

Historical v11 assumption:

```text
taskTitleValueFormatTruncate = 0
```

Observed with pinned Vitest 5.0.3: `0` truncated/ellipsized the title and corrupted the Situation carrier.

Current proven setting:

```text
taskTitleValueFormatTruncate = 1024
```

Impact: historical v11 references to `0` are superseded for the proven adapter.

---

## D-004 — xUnit concrete-test materialization path confirmed

Status: CONFIRMED

```text
IXunitTestCase
-> CreateTests()
-> concrete IXunitTest / ITest
-> TestLabel
-> Situation
```

`PreEnumerateTheories = true` is an optimization rather than the correctness mechanism.

Evidence: real xUnit.net v3 4.0.1 worker materializes both labeled theory rows.

---

## D-005 — Runtime materialization is explicit and trusted only

Status: CONFIRMED / ADOPTED AS UX CONTRACT

```text
workspace open/change
-> never automatically execute framework materialization

explicit Refresh + trusted workspace
-> runtime materialization allowed
```

File/config changes mark the projection `Stale` and may offer Refresh.

Impact: incremental work must preserve this boundary.

---

## D-006 — Workers stay out-of-process

Status: CONFIRMED

```text
VS Code Extension Host
  -> external Node/Vitest worker
  -> external .NET Roslyn/xUnit worker
```

Required behavior includes timeout/kill, captured stdout/stderr, and structured responses.

Evidence: real timeout regression and real Extension Host smoke.

---

## D-007 — Source discovery root and framework project target stay distinct

Status: CONFIRMED

```text
root / physicalRoot
  -> feature discovery + logicalFolderKey

frameworkProject (+ projectFile/configFile)
  -> framework materialization target
```

Impact: Configure UX must preserve this distinction instead of hiding it through upward filesystem guessing.

---

## D-008 — VS Code Testing API is a secondary semantic/navigation surface

Status: ADOPTED

```text
Feature -> Outcome -> Situation -> Frontend / Backend
```

Current mode:

```text
publish-only TestController
no custom Run/Debug profile
```

Reason: Test Explorer is useful for native navigation while the projection document remains the richer behavior-explanation surface.

Evidence: real TestItem source navigation and green Extension Host smoke.

---

## D-009 — Projection freshness has explicit UI state

Status: ADOPTED

```text
Fresh
Stale
Refreshing
Error
```

External disk changes are watched and mark the result Stale. Runtime refresh is never started automatically.

Evidence: Extension Host smoke verifies `Fresh -> Stale` after a direct disk edit.

---

## D-010 — Source-less runtime diagnostics must remain visible

Status: ADOPTED

Source-backed diagnostics:

```text
VS Code Problems + Output
```

Source-less runtime diagnostics:

```text
Output + Error state/notification
```

Reason: worker/materialization failures often do not belong to one source range.

---

## D-011 — Vitest workers use an external Node runtime

Status: CHANGED / ADOPTED

Rejected assumption:

```text
process.execPath in Extension Host can be treated as normal node.exe
```

Current behavior:

```text
explicit configured Node path
or Node resolved from PATH/common location
```

Reason: `process.execPath` in VS Code points to VS Code/Electron, not necessarily a standalone project Node runtime.

---

## D-012 — External Node worker environment is sanitized

Status: ADOPTED

Before starting the framework worker, remove editor/debugger process-injection variables such as:

```text
NODE_OPTIONS
VSCODE_INSPECTOR_OPTIONS
ELECTRON_RUN_AS_NODE
DEBUG
LD_PRELOAD
DYLD_INSERT_LIBRARIES
```

Normal toolchain environment remains available.

Reason: framework workers must not accidentally inherit editor/debugger bootloaders.

---

## D-013 — Windows filesystem identity is canonicalized at framework boundary

Status: CHANGED / CONFIRMED BY MINIMAL REPRO

Observed failure:

```text
C:\Users\... filter -> Vitest cases found, exit 0
c:\Users\... filter -> cases=[], exit 1
```

VS Code supplied workspace paths with a lowercase drive letter while direct PowerShell execution used uppercase.

Current behavior:

```text
canonicalize existing Windows framework/filter paths with filesystem realpath
```

Impact: materialization no longer depends on drive-letter casing.

---

## D-014 — Windows source-path correlation is case-insensitive

Status: CHANGED

Vitest may report module paths with different separator/casing form from source-analysis paths.

Current rule:

```text
Windows path identity -> case-insensitive after normalization
Unix-like path identity -> case-sensitive
```

Reason: successful materialization must still correlate cases back to TestDefinitions.

---

## D-015 — Real Windows host acceptance is authoritative for host/process changes

Status: ADOPTED

Rule:

```text
unit/core tests green
!= host/runtime change proven
```

Changes touching child processes, runtime discovery, VS Code API, trust, watchers, or Node/.NET resolution must pass real Windows host acceptance, and later installed-VSIX acceptance.

Reason: several failures existed only in the real Extension Host environment.

---

## D-016 — Missing/unresolved semantic parts stay visible in Testing API

Status: ADOPTED

Do not silently omit incomplete evidence.

Examples:

```text
Backend · unmatched
[situations unresolved]
```

Reason: semantic navigation must not make incomplete evidence look complete.

---

## D-017 — Current .NET worker bootstrap is prototype behavior, not final packaging policy

Status: OPEN

0.0.11 can build the extension-owned .NET worker on explicit Refresh when missing.

For 0.1.0 choose explicitly between:

```text
package framework-dependent worker artifact
keep deterministic source bootstrap
another equally reproducible deployment method
```

Acceptance requirement: normal users must not manually build the extension-owned worker.

---

## D-018 — Original v11 P0 checklist contained retained residual work

Status: ADOPTED AS PLANNING CORRECTION

The prototype proves the core P0 hypothesis, but original v11 P0 also requested items not present in 0.0.11, notably:

```text
one registered business/domain responsibility proof
full projection-safety failure fixture matrix
```

Planning rule: keep those visible as P1 hardening work instead of retroactively redefining v11 as completed.

---

## D-019 — Parameterized source navigation is definition-level today

Status: OPEN / KNOWN LIMITATION

Current:

```text
concrete Situation -> shared parameterized test definition source
```

Future target where safely supported:

```text
concrete Situation -> exact row/case declaration
```

Constraint: better navigation must not turn payload fields into semantic Situation identity.

---

## D-020 — Configure UX may assist discovery but must not guess semantics

Status: ADOPTED FOR 0.1.0

`Feature Projection: Configure` may present candidate roots/projects/config files, but the user confirms FeatureSpace/source role and framework target.

Reason: convenience must not undermine explicit semantic scope.

---

## D-021 — Original implementation sequence becomes historical; Master Plan becomes active roadmap

Status: ADOPTED

The original `11-implementation-sequence.md` remains useful as historical design intent and checklist, but its chronology no longer reflects the proven prototype state.

Current rule:

```text
v11 implementation sequence -> historical/specification reference
MASTER-PLAN.md               -> active execution order
```

This avoids losing old requirements while preventing already-proven work from appearing unfinished.

---

## Future delta rule

For each new fact that changes a previous assumption, append:

```text
ID
status
old assumption (if any)
new decision/fact
evidence
scope/impact
```

Do not erase the original v11 wording from the historical specification.

## D-022 — VSIX packages a framework-dependent .NET worker artifact

Status: ADOPTED / RESOLVES D-017 FOR 0.1.0

Chosen strategy:

```text
package workers/dotnet/runtime/** in the VSIX
normal installed users do not compile extension-owned C# code
source-tree development may publish the worker as a fallback
```

The packaged artifact is framework-dependent rather than self-contained. The current build is about 41 MB uncompressed and yields a complete VSIX of about 15.35 MB compressed.

Reason: xUnit support already requires `dotnet` to analyze and, for parameterized tests, build the user's configured test project. Shipping the extension-owned worker removes a redundant first-run worker compilation step without claiming the user's project toolchain can be bundled away.

Evidence on the authoritative Windows environment:

```text
isolated VS Code user-data/extensions directories
VSIX install -> local-prototype.feature-projection-prototype-p0@0.0.12
extension loaded from isolated installed extension directory
packaged worker path used directly
Vitest cases=2
xUnit cases=2
joined=3
diagnostics=0
external source edit -> Stale
installed smoke marker -> PASS
```

Scope/remaining limitation: Windows installed-VSIX behavior is proven. Cross-platform packaging/runtime compatibility of the same framework-dependent artifact is not yet independently accepted.

---


## D-023 — Configure 0.0.13 is explicitly single-root

Status: ADOPTED FOR 0.0.13

Current extension resolution, watchers, and Refresh are first-workspace-folder based. Therefore Configure must reject multi-root workspaces with an actionable message in 0.0.13 rather than merely choosing a folder and then resolving runtime paths against a different root.

Trigger to revisit: explicit product work on multi-root support, at which point configuration identity, watchers, Refresh workspaceRoot and installed acceptance must all become folder-aware together.

---

## D-024 — FeatureSource id is an explicit Configure field

Status: ADOPTED FOR 0.0.13

`FeatureSourceConfig.id` is required semantic/project metadata and must be explicit or explicitly confirmed by the user. Configure may suggest a default such as the role name, but must validate uniqueness inside the selected FeatureSpace before persistence.

Reason: silently deriving ids from role fails when a FeatureSpace contains more than one source of the same role.

---

## D-025 — Vitest configFile is relative to frameworkProject

Status: ADOPTED / IMPLEMENTATION PREPARATION

Optional Vitest `configFile` is represented on `FeatureSourceConfig`, resolved relative to `frameworkProject`, validated for existence during non-runtime config validation, and forwarded to the Vitest worker as a resolved path.

This mirrors the framework-target semantics already used by xUnit `projectFile` while keeping source discovery `root` distinct.

---

## D-026 — Configure uses validate-before-persist transaction

Status: ADOPTED FOR 0.0.13

```text
collect choices
-> build draft
-> structural/filesystem validation only
-> if blocking: show diagnostics, do not persist
-> one workspace-settings update
-> re-read/revalidate
-> existing configuration-change handler rebuilds watchers and marks Stale
```

Configure never starts framework materialization. This avoids persisting a known-invalid draft and avoids duplicate watcher/Stale transitions.

---

## D-027 — Configure acceptance starts from an empty temporary workspace copy

Status: ADOPTED FOR 0.0.13 ACCEPTANCE

The checked-in fixture already contains valid Feature Projection settings, so it cannot prove that Configure persisted anything. Installed acceptance must use a temporary fixture copy with Feature Projection settings removed/empty, run the same Configure transaction through deterministic test input, assert the written settings, and only then execute explicit Refresh.

Reason: otherwise a no-op Configure implementation could falsely pass by consuming the fixture's pre-existing configuration.

---


## D-028 — Configure uses one shared transaction for UI and acceptance

Status: CONFIRMED / IMPLEMENTED IN 0.0.13

The public `Feature Projection: Configure` prompt flow and deterministic host/installed acceptance converge on the same configuration transaction:

```text
applySourceConfigurationChange
-> validatePrototypeConfig
-> workspace featureSpaces update
-> re-read / revalidate
```

The automated seam bypasses only interactive VS Code prompt widgets. It does not bypass merge, validation, persistence, or stale-state behavior.

Evidence: clean temporary workspace starts with no Feature Projection featureSpaces; an invalid draft is rejected without persistence; frontend and backend sources are then persisted and explicit Refresh produces all three joined Situations with zero blocking diagnostics.

---

## D-029 — Existing symlink/junction paths are canonicalized during Vitest case correlation

Status: CHANGED / HARDENED IN 0.0.13

During Configure acceptance development, a temporary workspace built entirely from Windows directory junctions exposed a path-identity gap:

```text
static TestDefinition path -> junction-visible workspace path
Vitest moduleId            -> real target path
plain normalized comparison -> no match
```

Current behavior canonicalizes existing source/module paths through filesystem realpath before framework-path comparison while retaining Windows case-insensitive identity.

A regression creates a real symlink/junction path and proves a parameterized Vitest case correlates to the TestDefinition behind the alternate path identity.

Impact: this is product hardening, not only test-harness work; real workspaces that expose project directories through symlinks/junctions no longer hit this specific correlation failure.

---

## D-030 — Default worker timeout increased from 15s to 30s

Status: CHANGED IN 0.0.13

A clean installed-VSIX acceptance run observed cold Roslyn analysis reach the old 15-second worker limit and get killed exactly at timeout. Earlier warm runs were around 10–12 seconds, leaving insufficient startup margin.

Current default:

```text
featureProjection.workerTimeoutMs = 30000
```

The setting remains user-configurable. Existing fixtures that explicitly pin 15000 continue to exercise that tighter value, while clean Configure acceptance now omits a timeout override and therefore proves the product default.

Evidence after change: installed 0.0.13 clean workspace used the default, completed .NET analysis/materialization, produced 3 joined Situations with zero blocking diagnostics, and completed the installed Configure smoke successfully.

---

## D-031 — Trust boundary includes Roslyn/MSBuild project analysis

Status: ADOPTED / CURRENT 0.0.13 GAP TO FIX BEFORE 0.1.0

Workspace Trust protects more than final framework-case materialization. Any path that evaluates/loads the configured project or framework environment belongs behind the trusted-workspace boundary.

Required untrusted behavior:

```text
no Vitest runtime/materialization worker
no Roslyn/MSBuild project-analysis worker
no dotnet build
no xUnit materialization
```

TypeScript source-only AST extraction may remain available. For C# in Restricted Mode, project-backed semantic evidence must be explicit partial/unresolved until a separately proven syntax-only safe path exists.

Reason/evidence: in 0.0.13 the xUnit path invokes the .NET analysis worker, which opens the configured project through `MSBuildWorkspace.OpenProjectAsync(...)`, before the trust check that currently gates project build/materialization. Treating that as inert static parsing would make the trust contract weaker than stated by D-005.

Impact: this is a pre-0.1 correctness/security requirement, not a deferred enhancement.

---

## D-032 — Second-workspace acceptance must prove FeatureScope isolation

Status: ADOPTED

A second layout must exercise at least two FeatureSpaces and intentionally repeat the same canonical Feature + Outcome + Situation identities across them.

Acceptance rule:

```text
FeatureScope = FeatureSpaceId + logicalFolderKey
```

must prevent any cross-FeatureSpace join even when all lower-level semantic names are identical.

Reason: unique names in one fixture cannot expose an accidental loss of scope identity.

---

## D-033 — Public buildTimeoutMs must control trusted xUnit project builds

Status: CONFIRMED CURRENT GAP / MUST FIX BEFORE 0.1.0

`featureProjection.buildTimeoutMs` is a public setting whose description includes trusted xUnit project builds. In 0.0.13 the extension reads the setting, but `fullEngine.ts` derives the project-build timeout from `workerTimeoutMs` instead of consuming `buildTimeoutMs`.

Required behavior before 0.1.0:

```text
configured buildTimeoutMs
-> trusted xUnit project-build timeout
```

Reason: a public setting that is accepted but ignored has false semantics.

---

## D-034 — 0.1.0 release target is Windows-first alpha

Status: ADOPTED

Current authoritative acceptance is real Windows VS Code + external Node + .NET + installed VSIX. 0.1.0 will state Windows x64 as its accepted platform unless a later explicit decision expands the release target.

Cross-platform packaging/runtime compatibility remains release-hardening work after the Windows-first alpha; it is not silently implied by the framework-dependent worker packaging.

Required prerequisite statement for 0.1.0:

```text
Vitest sources require a supported external Node installation
xUnit sources require a compatible .NET SDK/runtime for the configured project
```

---

## D-035 — Hidden automation hooks are test-mode only before 0.1.0

Status: ADOPTED PRE-0.1 RELEASE HARDENING

Deterministic host acceptance currently uses hidden commands such as Configure/debug test seams. They are valuable for proving the same transaction as the public UI, but normal installed users do not need them.

Before 0.1.0, hidden automation/debug commands must only be registered under an explicit test-mode switch/environment and must be absent from a normal installed extension session.

---

## D-036 — Runtime prerequisite failures need actionable product diagnostics

Status: ADOPTED PRE-0.1 RELEASE HARDENING

Before 0.1.0, missing runtime prerequisites must produce specific diagnostics rather than generic worker/spawn failure text.

Minimum cases:

```text
Vitest source -> external Node executable unavailable
xUnit source  -> required .NET SDK/runtime unavailable/incompatible
```

This is a release usability gate, not a change to semantic projection rules.

---

## D-037 — Installed VSIX must carry its TypeScript runtime dependency and acceptance must be outside source-module ancestry

Status: CHANGED / CONFIRMED IN 0.0.14

Observed defect during 6.3a acceptance:

```text
installed VSIX activation
-> dist/adapters/vitestSource.js requires `typescript`
-> VSIX had excluded all node_modules
-> activation failed with Cannot find module 'typescript'
```

Why earlier smoke passed: the installed extension directory lived under the development checkout (`artifacts/.../extensions/...`), so Node resolution could climb to the checkout's `node_modules/typescript`. The test therefore proved extension-path identity but did not prove JavaScript runtime-dependency isolation.

Current packaging rule:

```text
production dependency: typescript@5.8.3
VSIX includes node_modules/typescript/**
no dev dependency tree is packaged
installed smoke root is under OS temporary storage, outside source checkout ancestry
```

Evidence: VSIX file listing contains only TypeScript under `node_modules`; installed smoke explicitly checks `node_modules/typescript/lib/typescript.js`; trusted and Restricted Mode installed flows both activate and pass from the isolated `%TEMP%` location.

Impact: the old stronger phrase "no runtime node_modules" is superseded. The intended product property is "no runtime npm install and no undeclared dependency on the development checkout."

---

## D-038 — Full project-evaluating/runtime path is now gated by Workspace Trust

Status: CONFIRMED / IMPLEMENTED IN 0.0.14

D-031 identified the 0.0.13 gap. The xUnit branch now checks Workspace Trust before worker existence/bootstrap or Roslyn/MSBuild analysis. Extension Refresh also avoids resolving external Node or bootstrapping the .NET worker while untrusted.

Installed Restricted Mode acceptance deliberately makes both runtimes unusable:

```text
nodePath -> nonexistent executable
packaged FeatureProjection.DotNetWorker.dll -> temporarily unavailable
```

and still produces an explicit partial projection with:

```text
worker/untrusted-workspace
worker/untrusted-project-analysis
```

The Feature Projection Output log contains no Vitest spawn, Roslyn/MSBuild analysis spawn, dotnet build spawn, or xUnit materialization spawn. TypeScript source-only extraction remains available; C# project-backed evidence remains unresolved until trust is granted and Refresh is explicit.

Impact: 6.3a is complete; installed source-navigation acceptance (6.3b) is the next unit.

---

## D-039 — Primary projection navigation must survive Markdown Preview

Status: CONFIRMED / IMPLEMENTED IN 0.0.15

The projection document is the primary explanatory surface. Navigation therefore cannot depend only on editor CodeLens, because CodeLens is not rendered in VS Code Markdown Preview.

Required behavior:

```text
projection editor -> Frontend/Backend navigation works
Markdown Preview -> Frontend/Backend are real clickable source links
Testing API -> Frontend/Backend source URI/range remains available
all targets -> workspace test sources, never installed-extension files
```

Parameterized Situations remain definition-level navigation in this slice; exact row/case navigation is still P2 work under D-019.

Implementation may improve Markdown structure for preview readability, but it must preserve the semantic hierarchy and literal assertion text. No behavior may be inferred or rewritten merely to make the preview prettier.

Impact: 6.3b now covers installed navigation across all three current user-facing navigation surfaces: projection editor, Markdown Preview, and Testing API.

Automated evidence in `0.0.15-navigation`:

```text
npm test                                                    34/34 PASS
real Vitest                                                 3/3 PASS
real backend xUnit                                          3/3 PASS
real xUnit concrete materialization                         2 cases PASS
real E2E projection                                         3 Situations PASS
real Windows Extension Host navigation assertions           PASS
installed VSIX 0.0.15 outside source checkout               PASS
installed projection source actions                         6/6 workspace targets PASS
installed editor Frontend + Backend openSource navigation   PASS
installed Testing API part source URI/range                 6/6 PASS
installed Markdown native vscode://file links               6/6 PASS
Restricted Mode regression                                  PASS
```

Manual installed-VSIX acceptance also confirmed both generated Markdown Preview links: one Frontend link and one Backend link each opened the expected workspace test definition/range. This closes D-039 acceptance and 6.3b. The href mechanism is `vscode://file`, chosen because the built-in VS Code Markdown Preview explicitly permits `vscode:` links.


---

## D-040 — Framework concrete-case correlation is scoped by framework project identity

Status: CHANGED / CONFIRMED IN 0.0.16

Old implementation assumption:

```text
adapterId + frameworkDefinitionKey
```

was sufficient to correlate every concrete framework case back to its static TestDefinition across one Refresh.

Second-workspace acceptance disproved that assumption. Two independent Vitest framework projects intentionally used the same relative feature-test path and line, producing the same frameworkDefinitionKey. Because `expandDefinitions()` grouped concrete cases without project identity, both projects' concrete cases were attached to each definition and emitted duplicate-Situation diagnostics before semantic join.

Current correlation identity:

```text
adapterId + canonical frameworkProject + frameworkDefinitionKey
```

`TestDefinitionRef` now carries framework-project identity. Vitest static definitions and xUnit analysis/materialization both propagate it; Windows project-path identity is separator-normalized and case-insensitive at the correlation key boundary.

This does not change Feature identity. `frameworkProject` is framework/transport correlation identity only. Semantic join remains:

```text
FeatureScope = FeatureSpaceId + logicalFolderKey
inside FeatureScope: FeatureName + Outcome + Situation
```

Evidence:

```text
pre-fix regression: 34 PASS / 1 FAIL, with two duplicate-Situation diagnostics
post-fix regression: 35/35 PASS
second real workspace: definitions=6 cases=8 parts=10 joined=6 diagnostics=0
installed 0.0.16 from empty settings: accounts + billing isolation PASS
adversarial accounts Frontend-only vs billing Backend-only manual_review rows remain unmatched PASS
primary fixture real E2E and installed trust/navigation regressions PASS
```

Impact: 6.4 and D-032 acceptance are complete. A framework-local definition key is no longer treated as globally unique across independent configured projects.


---

## D-041 — 0.1.0 automated release gate closes D-033, D-035 and D-036

Status: CONFIRMED / IMPLEMENTED IN 0.1.0 RELEASE CANDIDATE

The pre-0.1 release gaps recorded by D-033, D-035 and D-036 are now implemented and proven automatically.

```text
D-033: config.buildTimeoutMs -> trusted xUnit dotnet-build timeout
D-035: featureProjection.__configureTest and __debugState register only when FEATURE_PROJECTION_TEST_MODE=1
D-036: missing Node -> worker/node-runtime-missing with install/PATH/nodePath guidance
D-036: missing/incompatible .NET -> worker/dotnet-prerequisite-unavailable with SDK/runtime/PATH guidance
```

Installed acceptance additionally proves that a normal installed session does not expose either hidden command, while test-mode installed acceptance still drives the shared Configure/debug transaction. The installed VSIX runs under `%TEMP%` outside source-checkout ancestry and contains only `typescript` under `node_modules`, preserving D-037 dependency isolation.

Evidence:

```text
npm test                                           40/40 PASS
real primary Vitest/xUnit/E2E                      PASS
installed second-workspace FeatureScope acceptance PASS
normal installed hidden commands absent            PASS
trusted missing-Node diagnostic                     PASS
trusted incompatible-.NET diagnostic                PASS
trusted installed Configure/navigation              PASS
installed Restricted Mode                           PASS
```

The only remaining 6.5 item is the intentionally manual ordinary-user install/Configure/Refresh/inspect click-through. Therefore this delta closes the automated technical gaps but does not by itself mark 6.5 DONE.


---

## D-042 — 0.1.0 Windows-first alpha accepted after ordinary-user manual click-through

Status: CONFIRMED / RELEASE GATE COMPLETE

Automated release acceptance from D-041 was followed by the deliberately manual final gate in an ordinary, non-isolated user VS Code session using the packaged `0.1.0` VSIX and a clean prepared workspace.

```text
install 0.1.0 VSIX                                      PASS
clean workspace starts without Feature Projection config PASS
first Configure -> app / 1 source                       PASS
second Configure -> app / 2 sources                     PASS
Configure leaves projection Stale                       PASS
explicit Refresh                                        PASS
projection renders and works                            PASS
source navigation works                                 PASS
```


---
## D-043 — Duplicate Situation uniqueness and ambiguity are scoped to the exact semantic identity

Status: CONFIRMED / POST-RELEASE P1 7.1

The old `expandDefinitions` deduplication key omitted FeatureName and Outcome, causing false duplicate diagnostics for otherwise distinct features/outcomes sharing a Situation. A genuine same-identity duplicate emitted a blocking diagnostic but kept the first part as trusted evidence, allowing arbitrary first-wins projection.

The corrected uniqueness key is FeatureSpaceId + logicalFolderKey + FeatureName + Outcome + Situation + PartRole. Any genuinely ambiguous part identity suppresses **all** conflicting parts and produces `feature-test/unique-situation` / projection-safety / error / blocks-part. A rejected key stays ambiguous even if additional duplicates arrive. The original E2E join and framework-project-scoped transport identity are unchanged.

Two regression assertions failed before this correction and passed afterwards. The 11-scenario P1 safety matrix passes `npm test` 48/48; real primary Vitest+xUnit E2E passes with three joined Situations. These are source-checkout changes after the accepted 0.1.0 release. The 0.1.0 VSIX and release ZIP are unchanged.


## D-044 — Narrow code-first registered business responsibility proof through Roslyn symbols

Status: CONFIRMED / POST-RELEASE P1 7.2

The original v11 assertion/configuration contract requires an explicitly registered business method, not generic mock-verification syntax. The isolated xUnit v3/Moq fixture at `fixtures/responsibility-proof/` implements the prototype-shaped C# source configuration `IFeatureProjectionConfiguration.Configure(IFeatureProjectionBuilder)` with `RegisterResponsibility<User>(x => x.Authenticate(default(string)!))`. The Roslyn worker does not invoke this configuration.

The worker resolves the registration's method through Roslyn `IMethodSymbol`, stores its `OriginalDefinition`, and requires symbol equality with the invocation inside a Moq `Verify` lambda. It projects the literal complete verification statement with `kind=responsibility`, while ignoring unregistered `logger.Verify` and a same-named `Authenticate(int)` overload. Existing xUnit assertions remain unchanged.

Proof: `node scripts/verify-responsibility-proof.mjs` PASS / exit 0; fixture build and direct xUnit v3 execution 1/1 PASS; Roslyn definitions=1, diagnostics=0, assertions=2 (registered responsibility plus Assert.True); TypeScript normalization and semantic projection joined=1 with literal source preserved; `npm test` 48/48 PASS; primary real Vitest + xUnit E2E exit 0.

Limits: the configuration interfaces are local fixture contracts, **not** a released NuGet/C# SDK; this implements the one required proof, not a general extensible responsibility configuration product or additional mock-framework adapters. The packaged worker runtime and accepted 0.1.0 VSIX/ZIP are unchanged.


## D-045 — Explicit symbol-safe C# custom assertion registration proof

Status: CONFIRMED / POST-RELEASE P1 7.3

Original v11 states `RegisterAssertion(helperSymbol)`, forbids name-similarity inference, and requires literal source text. The narrow Windows proof uses a compiled fixture-local interface `FeatureProjection.IFeatureProjectionBuilder.RegisterAssertion(Expression<Action>)`, invoked in source as `builder.RegisterAssertion(() => FeatureChecks.AssertDenied(default(bool)))`. Configuration code is analyzed with Roslyn and not executed; the fixture throws from `Configure()` if it ever runs.

The worker resolves `RegisterAssertion` on the actual builder interface, resolves the helper invocation's `IMethodSymbol.OriginalDefinition`, and recognizes only a direct top-level test-statement invocation of that exact registered symbol. The helper is projected as `kind=assertion` with unmodified source text/range. `FeatureChecks.AssertDenied(string)`, `UnrelatedChecks.AssertDenied(bool)`, `Telemetry.Track(...)`, and same-named `PretendBuilder.RegisterAssertion(...)` are not treated as registered assertions. Existing Xunit.Assert and registered-responsibility handling remain intact.

Evidence: prior worker returned only built-in Assert.True (red proof), after fix Roslyn returns 1 definition/0 diagnostics/2 assertions, with exactly one registered helper and one Xunit.Assert. `node scripts/verify-assertion-helper-proof.mjs` PASS, real fixture xUnit v3 1/1 PASS, TypeScript normalization + semantic join + Markdown literal text PASS, P1/7.2 responsibility regression PASS, `npm test` 48/48 PASS, primary Vitest/xUnit real E2E exit 0 with 3 joined Situations and 3 Frontend/3 Backend.

This completes only the narrow 7.3 symbol-safe **C# proof**. It does not ship a public C# registration SDK, introduce a TypeScript helper-registration API, prove installed post-release P1 VSIX, or alter the accepted 0.1.0 VSIX/ZIP. Stable public normalized export (7.4) remains LATER.


## D-046 — Post-P1 installed Windows candidate accepted without replacing 0.1.0 release

Status: CONFIRMED / ISOLATED INSTALLED TECHNICAL ACCEPTANCE / NOT A PUBLIC RELEASE

Following completion of P1/7.1–7.3, a separate internal VSIX candidate was packaged with the newly published .NET worker runtime: `artifacts/feature-projection-prototype-p0-0.1.0-p1-acceptance-candidate.vsix` (20,460,132 bytes; SHA-256 `44284D06F1A5C67A24CDF52B03F372A7D12249C3258A2A1F6C2823061D751989`). The manifest retains internal version 0.1.0 solely for isolated testing. Original 0.1.0 VSIX and ZIP SHA-256 remain byte-for-byte unchanged. Packaged worker DLL and installed isolated worker DLL have matching SHA-256 `F9F93557E08D7F926DE84EBA77C322EC0FE6FD6A276B3E4C5582FED98A03E661`.

The unchanged historical `scripts/verify-installed-vsix.ps1` would repackage over the original VSIX and delete a fixed temp test root. Instead, independent P1 scripts `scripts/verify-installed-p1.ps1` and `scripts/verify-installed-p1-scope.ps1` use a separate candidate path and unique isolated VS Code user-data/extensions locations. They use CLI, no automation of the user's primary desktop.

Installed acceptance PASS: normal installed mode hides test/debug commands; Configure/Refresh, source actions and native links work; Node and .NET prerequisites report actionable blocking diagnostics; Restricted Mode runs without project workers; the P1 trusted workspace presents registered Moq responsibility verification and custom C# assertion in literal source form, 2 Situations / 2 source actions / Fresh / 0 diagnostics, without unregistered verifications; separate installed FeatureScope isolation has accounts+billing, 6 Situations, 10 source actions, 2 explicit unmatched parts, Fresh. All seven smoke result JSON markers have ok=true.

This decision closes isolated **Windows installed technical acceptance** for the specific P1 candidate. It does not turn that candidate into the original released 0.1.0 VSIX, assert an ordinary-user manual post-P1 click-through, prove a public C# contract SDK, or establish cross-platform readiness. P1/7.4 versioned normalized export stays LATER; P2/8.1 exact parameterized source navigation is NEXT.


## D-047 — Ordinary-user manual P1 acceptance confirms installed navigation and literal evidence

Status: CONFIRMED / POST-RELEASE P1 MANUAL ACCEPTANCE / 2026-10-10

After separate installed technical acceptance (D-046), the user installed the P1 candidate in ordinary VS Code and opened the clean trusted `C:\Users\alexa\Downloads\feature-projection-p1-manual-acceptance` workspace. Refresh showed Fresh, two independent Backend-only scopes (`assertions/access`, `responsibility/auth`), and Situations `invalid_token` and `invalid_password` with explicit unmatched Frontend.

The projection showed literal `FeatureChecks.AssertDenied(false);`, `user.Verify(x => x.Authenticate("invalid"), Times.Once);`, and `Assert.True(true);`, without unrelated `logger.Verify` or `Authenticate(42)` evidence. In Markdown Preview, Backend links opened `responsibility/Features/auth/AccessFeatureTests.cs` at line 7 and `assertions/Features/access/AccessFeatureTests.cs` at line 6. The user confirmed VS Code's `vscode://file` external-application warning using **Yes**; screenshots showed correct targets and cursor lines. The warning did not constitute a navigation failure, and the cause of `projection.md` appearing in Preview was not independently established.

**Manual P1 acceptance PASS.** Historical 0.1.0 released VSIX/ZIP remain unchanged; the internal P1 candidate is not a separately published release. P2/8.1 exact parameterized concrete-case source navigation remains unproven and NEXT.


## D-048 — Exact concrete-case navigation requires unambiguous source anchors, never payload-derived Situation

Status: CONFIRMED / P2 8.1 STATIC SUBSET / WINDOWS

Native runtime discovery was independently probed. Vitest 5 provides framework case ids and native [situation:...] labels but locates multiple test.each concrete cases at one shared call site. xUnit v3 provides unique concrete case ids and TestLabel but no source row in the existing materializer. Neither native output alone proves the exact source row for dynamic providers.

The source analyzers now collect *optional* static caseSourceAnchors: for Vitest, only a literal test.each array of object rows with a directly bound [situation:$caseId] property and unique static labels; for xUnit, only symbol-resolved Xunit.InlineDataAttribute entries with unique literal Label assignments and no other test-data provider. After runtime materialization, expandDefinitions looks up the already validated framework-native Situation label in these anchors. The semantic FeatureScope join and Situation derivation are unchanged. If there is no unique anchor, navigation stays on the test definition. Definition source and literal assertion text/ranges are never overwritten: navigationSource is separate and used only by Markdown source links, editor actions and Test Explorer part nodes.

Two real framework/transport-correlation defects were reproduced while implementing the proof:
(1) multiline Vitest test.each expression begins at line 3, but task.location is at the title invocation on line 6, resulting in feature-test/unresolved-test-definition; correlation now uses explicit framework task line/column, not semantic identity.
(2) xUnit reflection exposed System.Boolean while Roslyn BuildDefinitionKey used bool, resulting in missing concrete-case correlation; Roslyn now serializes parameter CLR type names without C# special-type aliases. Neither fix changes FeatureName/Outcome/Situation join rules.

Safety limits: computed Vitest buildCases() and xUnit MemberData currently supply no trustworthy static row source and retain definition-level navigation. Duplicate or nonliteral anchors are never selected. A separate adversarial probe with two xUnit InlineData rows having identical arguments but different Label produced only one native concrete case; the engine must never invent a second case from the two source attributes.

Evidence: scripts/verify-parameterized-navigation.mjs PASS (2 frameworks, 4 materialized concrete cases, 2 exact joined Situations, 4 source actions); real fixture Vitest 2/2 and xUnit v3 2/2 PASS; npm test 50/50 PASS; primary real E2E 3 Situations PASS; P1 responsibility and helper proofs PASS. Broad dynamic-provider exact navigation is NOT claimed.

## D-049 — P2 static navigation isolated installed VSIX technical acceptance

Status: CONFIRMED / P2 8.1 STATIC SUBSET / ISOLATED WINDOWS INSTALL

A separately named internal candidate was built with updated TypeScript and packaged Roslyn worker: artifacts/feature-projection-prototype-p0-0.1.0-p2-navigation-candidate.vsix (20,462,673 bytes; SHA-256 6F54B99A8D250BBFAD0BC114D37C22E7C2558EF6A36EAC9530B07BAB782AA0C8). The manifest continues to say 0.1.0 solely for this internal test, not as a new public release.

scripts/verify-installed-p2-navigation.ps1 uses an isolated VS Code user-data/extensions profile and separate workspace. Installed extension reported Fresh, zero blocking diagnostics, two joined Situations expired/locked and four verified source actions: Vitest frontend lines 4/5 and xUnit backend lines 5/6. Native Markdown links, Test Explorer rows and extension openSource navigation use the exact static concrete-case declarations. The original release VSIX and ZIP and the P1 candidate SHA-256 were verified unchanged before/after packaging.

This is installed *technical* acceptance for the constrained static case patterns, not an ordinary-user P2 manual click-through, proof for dynamic MemberData/buildCases providers, full P2 completion, or a new published version. The historical 0.1.0 release acceptance remains independent.


## D-050 — P2/8.1 dynamic-provider navigation is intentionally definition-level without framework-backed row source

Status: CONFIRMED / P2 8.1 BOUNDED CONTRACT / WINDOWS / 2026-10-10

This decision closes the dynamic-provider *feasibility investigation*, not arbitrary dynamic-row navigation. Direct Vitest 5 collection of the primary `test.each(buildCases())` fixture returned distinct native framework IDs and explicit `[situation:...]` labels for `passwords_dont_match` and `email_has_invalid_format`, but both tasks had the identical source location line 11, column 24. Inspected their exposed keys; no concrete-row location was available. Direct xUnit v3 materialization of the primary `MemberData(nameof(Cases))` fixture returned two distinct `UniqueID`/`TestLabel` values but no concrete-row source coordinate. Reflection inspection of the local xUnit v3 `IXunitTest`/`XunitTest` interfaces/classes showed case identity, method, arguments and labels but no trustworthy per-row source location. Legacy xUnit abstraction source-information properties do not prove a concrete v3 theory data-row coordinate.

Both providers execute code to materialize cases. Finding similar label strings in the provider's source, correlating by row order, or inspecting business payload would not prove identity against a framework case. This is not evidence that all possible xUnit/Vitest integrations can never provide source coordinates; only the present native collection/materialization contracts lack the evidence required for safe generic source mapping.

Accordingly, `caseSourceAnchors` remain exclusive to statically proven unambiguous source declarations (Vitest literal `test.each([...])` object rows and Roslyn-bound xUnit literal `InlineData(Label = ...)`). Arbitrary `buildCases()` and `MemberData` keep **definition-level navigation** in Markdown, editor actions, and Test Explorer. Situation identity still comes solely from framework-native labels; Expected Behavior from canonical test names; assertions are literal source text. Do not manufacture a source row or concrete case. Broader provider-specific mapping requires new evidence and explicit design review.

Repeatable `scripts/verify-dynamic-provider-fallback.mjs` PASS: two native cases per framework, three joined Situations total, two dynamic Situations each showing Frontend definition line 11 and Backend definition line 26, four correct definition actions and zero exact-row claims. Follow-up regression: `npm test` 50/50 PASS and `scripts/verify-parameterized-navigation.mjs` static exact-row proof PASS. Prior isolated installed P2 candidate technical acceptance remains valid; no VSIX was rebuilt and no ordinary-user P2 manual acceptance is claimed.

P2/8.1 is now **DONE for its bounded evidence-backed contract**, not universal dynamic-case navigation. NEXT is P2/8.2 Projection/Test Explorer cross-navigation. 7.4 normalized export remains LATER.


## D-051 — P2/8.2 cross-navigation binds Projection and Test Explorer to one full-scoped Situation identity

Status: CONFIRMED / POST-RELEASE P2 / WINDOWS INSTALLED TECHNICAL ACCEPTANCE

Projection and native Test Explorer now share the deterministic Situation TestItem ID formed from FeatureSpaceId + logicalFolderKey + FeatureName + Outcome + Situation. The Projection editor supplies a `Reveal Situation in Test Explorer` CodeLens using the documented `vscode.revealTestInExplorer(TestItem)` command. Test Explorer supplies a `testing/item/context` action `Open Situation in Projection` for Situation and part nodes; its command locates the matching literal `Situation: ...` line in the virtual projection document.

The extension indexes only published concrete Situation TestItems and projection positions. Indices are rebuilt on explicit Refresh. It does not resolve identity from short Situation labels or fuzzy substring matches. Invalid/stale IDs fail without navigating to a different Situation; an unmatched/unresolved part does not synthesize one.

Evidence: test/cross-navigation.test.mjs checks duplicate Feature/Outcome/Situation names under accounts and billing, verifies exact IDs against published Testing API tree, and verifies projection line mapping; `npm test` 54/54 PASS. Installed Windows smoke on two FeatureSpaces exercised six bidirectional command transitions, CodeLenses, context-menu manifest and unknown-ID refusal, with 6 Situations / 10 matched source actions / 2 unmatched parts / Fresh PASS. The actual user interaction with the Testing item context menu was not manually clicked; menu contribution and programmatic dispatch, not real mouse UX, are proven.

## D-052 — Assertion source navigation remains literal and independent of part navigation

Status: CONFIRMED / POST-RELEASE P2 / WINDOWS INSTALLED TECHNICAL ACCEPTANCE

P2/8.2 also gives each recognized assertion or registered business verification its own source link and projection-editor CodeLens. Markdown Preview uses the existing native VS Code source-deep-link mechanism; editor commands call `featureProjection.openSource` with the literal assertion's original SourceRange. A separate `assertionSourceActions` collection keeps old Frontend/Backend `sourceActions` and exact parameterized navigation unchanged. Assertion code fences still render unmodified source text.

`test/projection-actions.test.mjs` independently proves separate part line 7 and verification/assertion lines 13 and 16. Isolated installed smoke on accounts/billing verifies 10 assertion links plus their CodeLenses and executes source navigation for both Frontend and Backend. Source regression `npm test` 54/54 PASS; real primary E2E 3 Situations PASS; Vitest/xUnit static exact-row and dynamic safe definition fallback proofs PASS; both P1 proof scripts PASS.

Separate intermediate candidate SHA-256 `F6EA46AB06D48A5067D68405863DB1280EC7C1564972EC0F4659E8DB71E434BB` stays untouched. Final acceptance candidate: `artifacts/feature-projection-prototype-p0-0.1.0-p2-cross-navigation-assertions-candidate.vsix`, 20,463,808 bytes, SHA-256 `88E8030EC53220D05682F077D7F7E9FEC25A91C05F59902F45A9673528412F62`. Both use manifest 0.1.0 internally but are not new public releases. Historical 0.1.0 VSIX/ZIP and earlier P1/P2 candidates were verified unchanged. Ordinary-user P2 manual click-through remains a follow-up.


## D-053 — P2/8.2 manual reveal blocked; add unambiguous Command Palette route for retest

Status: MANUAL ACCEPTANCE BLOCKER / RECHECK REQUIRED / 2026-10-10

The user installed the 8.2 assertions cross-navigation candidate in ordinary VS Code and refreshed the independent accounts/billing manual workspace. The projection showed all six Situations; the Testing view contained Feature Projection and correctly scoped accounts/billing trees. However, clicking the supposed `Reveal Situation in Test Explorer` CodeLens did not visibly expand or select the requested `expired` or `locked` test; screenshots showed Frontend `access.feature.test.ts` opened at shared definition line 11 and the target Testing branch stayed collapsed. Therefore P2/8.2 ordinary-user reveal is **FAIL/not accepted**, despite previous isolated tests returning true for command dispatch.

Underlying click-vs-command ambiguity was not resolved from screenshots; a successfully resolved `vscode.revealTestInExplorer` promise does not supply a selected/expanded Test Explorer node as a result. Testing tree itself was verified correct. A diagnostic probe found the private `_testing.getExplorerSelection` command unavailable via the extension command interface, so selected-node state is not established through the current installed smoke.

A first repair attempt included unsupported `workbench.view.testing`; real isolated Extension Host logs produced `command 'workbench.view.testing' not found`. This candidate (SHA-256 6C3F45B0D3469AD4B9AF7BAE81724D6AEF0C96C604B18F82D4B06E2C86FE15EA) is a **failed experimental probe**, not for user installation.

Corrected candidate exposes `Feature Projection: Reveal Situation in Test Explorer` via Command Palette. With no CodeLens argument, it presents concrete Situations using their **full FeatureSpace-qualified** labels and IDs via QuickPick; a selected ID goes to the original public `vscode.revealTestInExplorer(TestItem)` API, with request/dispatch logging. No unsupported view command, label-only fallback, extra runner profiles, or semantic identity changes. Successful dispatch is still NOT treated as proof of visible selection.

Corrected candidate: `artifacts/feature-projection-prototype-p0-0.1.0-p2-reveal-palette-fixed-candidate.vsix`, SHA-256 `D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107`, 20,464,402 bytes. Windows source tests 54/54 PASS; isolated installed technical smoke PASS (Fresh, 2 FeatureSpaces, 6 Situations, 10 assertion links, 10 part links, palette command registered, no unmatched mix-up). Original historical release and candidate artifacts checksum-verified unchanged.

**Next gating step:** user installs the corrected VSIX and tests the new Command Palette action for `billing/shared · locked` with `billing/shared` initially collapsed. Only an actual visible reveal/expand can resolve this manual blocker. Do not mark manual PASS based on command-dispatch smoke.

## D-054 — Corrected P2/8.2 Command Palette workflow passes ordinary-user manual acceptance

Status: CONFIRMED / P2 8.2 MANUAL ACCEPTANCE / 2026-10-10

D-053 documented an ordinary-user failure to visibly reveal a target TestItem when using the inline `Reveal Situation in Test Explorer` CodeLens: the Testing branch remained collapsed while a shared frontend definition was opened. This historical failure and click-origin ambiguity remain recorded; it must not be silently reclassified as an earlier PASS.

The user installed the separately built corrected candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-reveal-palette-fixed-candidate.vsix` in ordinary Windows VS Code and used the prepared trusted `feature-projection-p2-manual-acceptance` workspace (two FeatureSpaces, accounts and billing). The user expressly confirmed that the **Command Palette** `Feature Projection: Reveal Situation in Test Explorer` workflow works after Refresh. In the subsequent one-action-at-a-time manual follow-up, the user confirmed that right-click `billing/shared → denied → locked` and choose `Feature Projection: Open Situation in Projection` works. The user then confirmed `Open assertion source` from Backend Assertions for `billing/shared / locked` opens `services/billing-api/Features/shared/AccessFeatureTests.cs` at **line 22**, the literal `Assert.False(testCase.Allowed);` statement (rather than test definition line 19).

Result: **P2/8.2 ordinary-user manual acceptance PASS for the corrected Command Palette workflow, Test Explorer context-menu reverse jump, and assertion-source navigation.** The original inline CodeLens forward-reveal interaction remains *not separately verified* and is not included in this PASS. The latter manual confirmations were concise user reports rather than additional screenshots; do not overstate the evidence. Prior screenshots confirmed six Situations and correct independent accounts/billing Testing groups.

The corrected VSIX is still an internal manifest-version-0.1.0 test candidate, **not** a new public release. Size 20,464,402 bytes; SHA-256 `D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107`. Source regression 54/54 PASS and isolated Windows installed technical smoke PASS were already completed before this manual check. Historical 0.1.0 VSIX/ZIP and all P1/P2 acceptance candidates, including the intentionally rejected unsupported-view experimental candidate, remain separate and checksum-unchanged. P2/8.3 usage/refactoring feasibility may now be investigated; P1/7.4 normalized JSON/export remains LATER.


## D-055 — P2/8.3 symbol-safe C# registered usages are feasible read-only; Rename not proven

Status: CONFIRMED / 8.3a FEASIBILITY PROOF / WINDOWS / 2026-10-10

The retained v11 usage/refactor backlog was investigated against real P1 source fixtures after user-accepted P2/8.2. Current projection assertion snippets already preserve source ranges but do not offer the semantic registered-symbol → all references graph required for a dependable Usage View. Treat raw string-search by identifier as insufficient evidence for any refactor.

Added an internal worker research command, `probe-registered-usages`, implemented in `workers/dotnet/RoslynUsageFeasibilityProbe.cs` and dispatched from `workers/dotnet/Program.cs`. It inspects `FeatureProjection.IFeatureProjectionConfiguration.Configure` in an MSBuildWorkspace *without executing it*, resolves `IFeatureProjectionBuilder.RegisterResponsibility/RegisterAssertion` and each single-invocation registration lambda through Roslyn symbols, then queries `SymbolFinder.FindReferencesAsync` for exactly those `IMethodSymbol.OriginalDefinition` targets. Output is read-only: `probeOnly:true`, `mutationSupported:false`, symbol identities plus project-local literal `SourceRange` references grouped as configuration registrations, feature tests, or other configured project sources. A reference must be from the configured project, not a transitive or similarly named project. Duplicate same-symbol registration or unresolved registration returns diagnostics with **zero targets**, never a misleading partial list.

Real fixture proof `scripts/verify-usage-symbol-feasibility.mjs` (native worker and real Roslyn compilation) PASS:
- `User.Authenticate(string)` → registration line 33; direct feature-test invocation line 12; registered Moq verification lambda line 13. Wrong `Authenticate(int)` overload and logger verification are absent.
- `FeatureChecks.AssertDenied(bool)` → registration line 48; feature-test invocation line 8. `AssertDenied(string)`, `UnrelatedChecks.AssertDenied(bool)`, and same-named fake builder registration are absent.
- An isolated temporary clone with duplicate same-symbol registration fails closed: one diagnostic, zero returned targets; no project or user source file was modified by the probe.
- Every returned reference span identifies the symbol name in the original source. C# project scope is honored.
- `npm test` 54/54, primary real Vitest+xUnit E2E, P2 static exact-row and dynamic safe fallback proofs, and both P1 registered responsibility and custom assertion proofs PASS after this worker change.

This **does not implement** a VS Code Usage View, Find References/Rename UI, cross-language reference resolution, actual code edits, or semantic rename safety. Even correct C# symbol references cannot establish how to rename canonical Feature/Outcome/Situation names or runtime Vitest/xUnit labels. No user source edits, workbench installations, VSIX/ZIP rebuild, new published release, or cache/run integration happened. P2/8.3a source feasibility DONE; P2/8.3b trusted read-only Usage View + installed technical acceptance NEXT. Rename/refactor safety is separately deferred until it has symbol-binding, collision, preview and explicit mutation-consent evidence. P1/7.4 export remains LATER.


## D-056 — P2/8.3b registered C# Usage View: scoped read-only UI and Windows installed technical acceptance

Status: TECHNICAL ACCEPTANCE PASS / USER MANUAL PENDING / 2026-10-10

After D-055's real C# semantic `SymbolFinder.FindReferencesAsync` feasibility, implemented a public, explicitly invoked VS Code command `Feature Projection: Show Registered C# Usages`. The workflow requires a **trusted, single-root workspace**, validates the existing FeatureSpace/source configuration, then asks the user to select one FeatureSpace-qualified `xunit-v3` source. It resolves and checks the project, project file and source root against physical workspace ancestry, launches the *packaged* dotnet worker for `probe-registered-usages` only on user request, and treats any process/JSON/identity/path/coordinate error as failure. Missing registrations yield an explanatory read-only view; ambiguous worker registrations yield diagnostics with **zero partial targets**.

The resulting independent, source-specific virtual document `feature-projection:/usages/<FeatureSpace>/<source>.md` presents exact Roslyn-identified responsibilities and assertion helpers, distinguishing their configuration registration, in-feature-test references and other project-source references. Each reference has the existing `vscode://file` source deep link and a separate VS Code editor CodeLens invoking `featureProjection.openSource` with the validated original file/line/column. Per-URI cached view content and actions isolate repeat labels, adjacent FeatureSpaces and switching tabs. **No text matching substitutes for symbol identity**; there is no Rename, `WorkspaceEdit`, filesystem edit, automatic worker run on editor save, or new public release.

The first intermediate candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-registered-usages-candidate.vsix`, SHA-256 `8D33A18EA642410EC31946B826A45AB34E0EA8F12E262FBCAE4ACE3B0D1BBB31`, **FAILED its isolated installed UI smoke** because a single shared `/usages.md` virtual document returned previous-scope content immediately after switching source. It is a rejected research artifact. Replaced with per-source URIs and new, separately packaged candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-registered-usages-scoped-candidate.vsix`, size 20,474,162 bytes, SHA-256 `7C259D336C89C961E61827E0AD6E92508BB0125CE5C0776946C17D0067275CE1`.

Proof of **8.3b installed technical PASS**, not manual PASS: `npm test` 58/58; 8.3a real Roslyn overload exclusion and duplicate-registration fail-closed proof; installed VS Code 1.141 in fresh isolated profiles shows exact symbols `User.Authenticate(string)` (one registration plus 2 usages) and `FeatureChecks.AssertDenied(bool)` (one registration plus 1 usage); correct scope-specific docs, actions, CodeLenses, and editor source navigation; public menu command registered; test-only hooks absent from normal installed profile; unknown source refused. In separate **installed Restricted Mode** test, Usage View was denied and the C# usage worker was never spawned. Same installed scoped candidate passed the original P2/8.2 installed 2-FeatureSpace 6-Situation / 10 assertion/source action cross-navigation regression. All older accepted release artifacts and previous P1/P2 candidates verified checksum-unchanged.

**Boundary:** no ordinary-user manual click-through for this 8.3b build yet, no cross-language usage discovery, no general VS Code Find References integration, and **no safe automatic Rename**. NEXT is manual acceptance in `C:\Users\alexa\Downloads\feature-projection-p1-manual-acceptance` (existing fully configured responsibility/assertions C# proof workspace). Only then consider a separate opt-in rename feasibility stage with collision/preview/consent.


## D-057 — P2/8.3b ordinary-user registered C# Usage View acceptance PASS (bounded)

Status: ORDINARY-USER MANUAL ACCEPTANCE PASS / WINDOWS / 2026-10-10

Following D-056's separate **Windows installed technical PASS**, the user installed the corrected `artifacts/feature-projection-prototype-p0-0.1.0-p2-registered-usages-scoped-candidate.vsix` in ordinary VS Code, opened the existing trusted `C:\Users\alexa\Downloads\feature-projection-p1-manual-acceptance` workspace and invoked `Feature Projection: Show Registered C# Usages`. The assistant explicitly advised that **Refresh is unnecessary** because this is an explicitly requested Roslyn symbol query and does not depend on projection freshness.

Evidence from two user screenshots:
- FeatureSpace `responsibility`, source `backend` shows `User.Authenticate(string)`, `Registration · FeatureProjectionConfig.cs:33`, `Feature test · Features/auth/AccessFeatureTests.cs:12`, and `Feature test · Features/auth/AccessFeatureTests.cs:13`. Unrelated `Authenticate(int)` overload absent. Editor CodeLens labels `Open registration source` / `Open feature test source` displayed over links.
- FeatureSpace `assertions`, source `backend` shows `FeatureChecks.AssertDenied(bool)`, `Registration · FeatureProjectionConfig.cs:48` and `Feature test · Features/access/AccessFeatureTests.cs:8`. Unrelated `AssertDenied(string)` and other-type `UnrelatedChecks.AssertDenied(bool)` not incorrectly listed. Independent `backend.md` views support correct scope separation.

Evidence from two follow-up user screenshots after `Open feature test source` CodeLens clicks:
- `responsibility/Features/auth/AccessFeatureTests.cs` opened with caret on line **12**, `user.Object.Authenticate("invalid");`.
- `assertions/Features/access/AccessFeatureTests.cs` opened with caret on line **8**, `FeatureChecks.AssertDenied(false);`, not the overload or unrelated type calls at lines 9–10.

Result: **P2/8.3b manual PASS for the two scoped Usage View displays, exactly matched Roslyn registrations and reference locations, and these two editor CodeLens source-navigation actions.** This does not prove standalone manual Markdown Preview link clicking, generalized Find References, rename safety, cross-language usage, Runtime Run/Debug or any source mutation; do not claim those. The earlier shared-URI failed intermediate candidate remains rejected as documented by D-056. Technical installed PASS remains unchanged: 58/58 unit tests, source reference guards, isolated installed trusted + Restricted Mode and P2/8.2 regression. The corrected candidate is internal version 0.1.0, **not a new release**, and older VSIX/ZIP artifacts are preserved.

Next planned investigation is **P2/8.3c Rename/refactor safety feasibility**; research must start read-only and avoid edits until semantics, scope, conflict detection, edit preview and explicit consent are independently demonstrated. P1/7.4 JSON/export remains LATER.

## D-058 — P2/8.3c in-memory Roslyn Rename feasibility, not a general Rename feature

Status: SOURCE PROOF PASS / READ-ONLY RESEARCH / WINDOWS / 2026-10-10

The approved P2/8.3b user-facing feature remains the read-only registered C# Usage View (D-056/D-057). P2/8.3c explored **whether semantic rename previews are technically possible without touching user code**, after moving the canonical source to the GitHub-backed checkout `C:\Users\alexa\Repos\feature-projection`.

Added `workers/dotnet/RoslynRenameFeasibilityProbe.cs` and an explicitly selected internal command `probe-registered-rename` in the existing .NET worker; request metadata gains optional `symbol` and `newName` properties. The worker resolves exact `FeatureProjection.IFeatureProjectionConfiguration` registrations through Roslyn symbols (it never executes `Configure()`). It refuses ambiguous/duplicate registrations, unknown or unregistered overloads, non-identifiers/keywords/no-op names, and any existing same-name member on the declaring type, including a differently typed overload. A selected project must be a single loaded C# project with no compilation errors. The worker uses `Renamer.RenameSymbolAsync` to obtain an **immutable in-memory Solution only**. It rejects edits outside the project, additional/removed documents, or compiler errors after the hypothetical rename.

Roslyn's `GetTextChangesAsync` can express a one-token rename as *an insertion or a partial substitution*, so checking that every raw `TextChange` equals a full method name was an overly strict first probe and was correctly rejected. The accepted proof instead binds each proposed text change to exactly one previously resolved **declaration/reference identifier span**, reconstructs that whole token in memory, and requires its value to equal the requested new identifier. Changes to any other text or multiple token owners fail closed. The preview reports only those validated token locations, not an applicable `WorkspaceEdit`.

Repeated Windows source proof `scripts/verify-rename-feasibility.mjs` **PASS**:
- `User.Authenticate(string) → AuthenticateCredentials`: 4 token previews, declaration (20), registration (33), feature-test calls (12, 13). `Authenticate(int)` unaffected.
- `FeatureChecks.AssertDenied(bool) → AssertAccessDenied`: 3 token previews, declaration (20), registration (48), call (8). Other overload/type unaffected.
- Refusals with **zero edits**: `Authenticate(int)` unregistered; no-op requested name; reserved keyword; invalid identifier; new name colliding with a different overload; duplicate same-symbol registration in disposable temporary clone.
- SHA-256 snapshots of original C# source and .csproj files before and after previews were equal. Any temporary cloned fixture changes were deleted; no original user source files were written.
- Previous `npm test` 58/58 and primary Vitest+xUnit real E2E PASS after the worker change.

**Boundary:** proof is read-only, not an implemented user Rename feature. It does not prove safe renaming across referenced projects, Features/Outcomes/Situations, generated/runtime labels, dynamic/reflection string callers, workspace race/staleness, file names, or conflicting workspace edits. No public extension command, editor RenameProvider, source mutation, VSIX or release is supplied. Do not claim safe Rename merely because a one-project in-memory preview compiles.

**Next:** 8.3d explicit-user-opt-in Rename UX/policy and deeper cross-project/conflict proof before any hypothetical mutation. Read-only Usage View remains supported; P1/7.4 normalized export remains LATER.

## D-059 — P2/8.3d read-only registered C# Rename Preview, installed technical PASS

Status: INSTALLED TECHNICAL PASS / ORDINARY-USER MANUAL PENDING / 2026-10-10

Build upon D-058's **in-memory** Roslyn method rename proof, without exposing an actual mutating Rename. Added the contributed Command Palette `Feature Projection: Preview Registered C# Rename (Read-Only)`. This requires a trusted single-root workspace, explicit selection of the FeatureSpace-qualified xUnit source, the exact registered C# method symbol and a proposed method name. The command first checks existing semantic registration evidence, refuses dirty project documents, invokes the packaged .NET `probe-registered-rename` worker only on explicit request, then validates the returned `probeOnly:true`, `mutationSupported:false`, `projectScopeOnly:true` contract and literal token positions against files/project/workspace. A rejected Roslyn rename may display diagnostics, but **never partial edits**. Positive previews contain only exact original C# token positions with original/new identifier and CodeLens/Markdown links. Dedicated `feature-projection:/rename-preview/<FeatureSpace>/<source>/<symbol>/<newName>.md` documents and per-URI source actions prevent scope/tab mixing. No `WorkspaceEdit`, `RenameProvider`, `ApplyChanges`, file writing or confirmation/apply UX exists.

The first intermediate VSIX `artifacts/feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-candidate.vsix` (SHA-256 `65420265212EE335093A08D5A1735D588DC96F1C2E71649DFD9A344BC0E384FA`) was **not accepted**: its installed smoke failed because the test-mode dispatcher omitted `p2-rename-preview` and invoked an unrelated Configure test. A separate PowerShell verifier iteration also lost `$LASTEXITCODE`; corrected before re-running. This failure is a **harness error**, not evidence that the editor preview passed or failed. It is retained as historical diagnostic artifact and not for user installation.

The corrected independently packaged VSIX is `artifacts/feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-fixed-candidate.vsix`, **20,489,453 bytes**, SHA-256 `23C01AC1CEFFE89DE9D2A38A5CEC17ED2494636F7D9E9BFB7EDA47409753B416`. Repeatable full validation `scripts/verify-p2-rename-preview-fixed-acceptance.ps1` PASS:
- Registered-symbol Roslyn usage proof and 8.3c in-memory Rename proof PASS (4 responsibility, 3 helper token changes; collision/unregistered/duplicate fails closed).
- Source `npm test` **62/62 PASS**, including new result normalization, file ancestry, stale span, duplicate identity and mutating-worker rejection.
- Installed Windows 1.141 in isolated normal profile: command contributed, no hidden test commands; installed trusted two-scoped preview PASS, correct independent virtual document content, seven CodeLens/source locations; refused no-op name renders diagnostics and zero links; an unregistered overload refused.
- Installed Restricted Mode: public preview action refused, and neither `registered-usages` nor `rename-preview` worker spawned.
- Existing P2/8.2 installed cross-navigation regression on *same installed VSIX* PASS: 2 FeatureSpaces, 6 Situations, 10 assertion/source links and no identity mixing.
- Older 0.1.0 release and P1/P2 candidates were checksum-verified unchanged. No new public release or user-installed test was performed.

**Boundaries:** technical PASS is NOT user manual PASS. Correctness across other projects, dynamic/reflection use, files changing after display, new-name conflicts outside the selected declaring type, Vitest/xUnit dynamic labels, and any actual source mutation remain unproven. A *read-only one-project preview* is not an authorized rename plan. Next P2/8.3d manual UX acceptance in `feature-projection-p1-manual-acceptance` using the corrected VSIX; 8.3e cross-project diff/consent/rollback policy and actual Rename remain LATER. P1/7.4 export also LATER.

## D-060 — Batch manual acceptance once at the next stable MVP release gate

Status: PROCESS DECISION / ACTIVE / 2026-10-10

The user approved replacing feature-by-feature ordinary-user VSIX installs and
screenshots with **one final consolidated user acceptance session**. This
changes verification scheduling, not the meaning of PASS or the semantics
of any capability. The previously accepted 0.1.0 Windows-first alpha and
D-054/D-057 ordinary-user evidence remain unchanged. The read-only Rename
Preview in D-059 remains **installed technical PASS / manual PENDING**;
we deliberately defer, rather than silently waive, the manual gate.

Next MVP candidate scope: accepted Configure/Refresh/Projection/Testing API;
P1 C# symbol-aware responsibility/assertion fixtures; P2 bounded case
and Test Explorer cross-navigation; read-only Usage View; and the
strictly read-only experimental Rename Preview. No general/mutating Rename,
JSON export, incremental cache, Run profiles, new adapters or broad runtime
expansion in this release gate without a new decision.

Developer cadence: scoped GitHub commits; source unit/Roslyn proofs per
change; Windows GitHub Actions source job; cumulative isolated installed
VSIX technical acceptance before manual testing; preserve every historical
VSIX/ZIP and its checksum; only then build **one** cumulative candidate.
Ordinary-user acceptance will be a short single checklist (~10–15 min)
covering installation, explicit Refresh, navigation, read-only Usage and
Rename Preview/refusal, and verification that source files do not change.
No screenshots for successful steps unless evidence is otherwise uncertain.

Artifact boundaries: source CI checks do not constitute installed VSIX
acceptance; installed technical smoke does not count as ordinary-user
acceptance; previewing C# edits does not authorize Apply/RenameProvider.
Actual release version bump, tag, licensing/publication and any source
mutation still require explicit separate user approval.

Authoritative gate checklist: `docs/plan/MVP-RELEASE-GATE.md`.

## D-061 — Single cumulative VSIX installed technical acceptance PASS; manual pending

Status: WINDOWS INSTALLED TECHNICAL PASS / ORDINARY-USER MANUAL PENDING / 2026-10-10

The D-060 batched-verification policy was executed against one SHA-pinned
prebuilt candidate installed once into a **fresh isolated VS Code extensions
directory**, with independent user profiles/workspaces for each scenario.
Implemented `scripts/verify-mvp-installed-aggregate.ps1` and a separate
reconciling report validator `scripts/verify-mvp-aggregate-report.ps1`.
Tests do not overwrite earlier accepted or rejected builds, do not use
the ordinary user's VS Code profile, and require exact candidate SHA-256.

Candidate for ONE later combined ordinary-user acceptance:
`artifacts/feature-projection-prototype-p0-0.1.0-mvp-batched-acceptance-candidate.vsix`,
20,490,576 bytes, SHA-256
`54D4B3D1F5C17B3657C91AA299A129B66D146A72178633221FBC2FB0A3D83A29`.
Internal extension version remains 0.1.0; this is **not** a new public release.

Evidence from fresh aggregate runs on both the previous D-059 candidate
and the final cumulative candidate: source `npm test` **62/62 PASS**,
8.3a registered symbol usage and 8.3c in-memory Rename proof PASS;
isolated installed normal profile with hidden test hooks absent PASS;
trusted Configure -> explicit Refresh / Stale marker PASS;
two-FeatureSpace registered Usage View PASS;
two-FeatureSpace read-only Rename Preview (4+3 semantic token links,
exact CodeLens jumps, rejected name produces zero edits) PASS;
Restricted Mode refuses analysis and spawns no C# usage/rename worker PASS;
prior P2/8.2 cross-navigation on the *same installed candidate* PASS
(accounts/billing, 6 Situations, 10 assertion source actions);
historical VSIX/ZIP SHA-256 unchanged.

The final run initially exited nonzero **only while writing the summary
JSON report**: Windows PowerShell 5.1 lacks `System.IO.Path.GetRelativePath`.
All six installed result markers and actual assertions were already PASS.
The reporting step was moved to a compatible dedicated script using
validated repo-relative substring paths. Independently re-reading all
six persisted installed result markers against the isolated extension
and pinned candidate yielded `MVP_AGGREGATE_RESULTS_RECONCILED=PASS_MANUAL_PENDING`.
Local evidence persists under `artifacts/local-acceptance-results/` (Git-ignored);
historical test profiles remain in the Windows temporary smoke root.

**Boundary:** installed technical PASS is not a human UX PASS, and the
candidate is not tagged, version-bumped, publicly released or published.
One combined ordinary-user acceptance session remains REQUIRED by D-060.
Mutating/cross-project Rename, P1/7.4 JSON/export, P3–P6 remain LATER.

## D-062 — Defer experimental Rename Preview from the user-facing MVP

Status: USER-APPROVED SCOPE CHANGE / INSTALLED TECHNICAL PASS / MANUAL PENDING / 2026-10-10

During the single MVP manual acceptance session, the user entered a new
name for `FeatureChecks.AssertDenied(bool)` and saw 3 proposed positions
in the read-only Markdown Rename Preview (declaration, registration and
the feature-test call). The user verified that the third CodeLens action
opened `assertions/Features/access/AccessFeatureTests.cs:8`. The UX was
confusing because the user expected a complete Rename but saw only an
unapplied list of source references. The assistant proposed removing
this experimental feature from the imminent MVP until a semantic
rename flow with review, explicit consent and safe application exists;
the user explicitly approved this exclusion.

**Release scope change:** Do not expose Rename Preview in the normal
VS Code Command Palette, activation events or publicly registered
commands. Preserve `src/core/renamePreview.ts`, source/Roslyn worker
research and automated fail-closed proofs. In the installed regression
environment, hidden test hooks can still exercise its read-only
implementation; **this does not constitute a shipped user capability**.
Both the public command's absence and direct invocation rejection are
required independent installed normal-profile assertions.

Replacement VSIX (internal 0.1.0, never overwrite earlier artifacts):
`artifacts/feature-projection-prototype-p0-0.1.0-mvp-no-rename-preview-candidate.vsix`
20,490,605 bytes; SHA-256
`09E71D305560DD7E3ECCF7E161DA35FA6585D05992B4E9CE36AFD7B25FCB68A0`.
The previous D-061 cumulative candidate is historical, not accepted
for the next public release. The release gate now checks only supported
Configure/Refresh, Projection, Test Explorer cross-navigation, scoped
registered C# usages and source navigation in the manual UX session.

**Acceptance boundary:** only the observed 3-token read-only preview
display and the single source jump were manually exercised in that
session; they are not acceptance of a complete Rename feature or
the wider MVP. The acceptance session has been **paused** pending
installation of a newly tested replacement VSIX. No general Rename,
WorkspaceEdit, source mutation, version bump or public release has
been authorized. D-059/D-061 technical history remains intact.

Installed technical check completed on the D-062 replacement VSIX:
`powershell -NoProfile -File scripts/verify-mvp-installed-aggregate.ps1`
**PASS**; `npm test` **62/62**; existing Roslyn usages and in-memory
Rename proofs PASS. Isolated installed normal profile confirms:
no Rename Preview contribution, activation or registered command,
and direct `featureProjection.previewRegisteredRename` invocation
is rejected. Hidden isolated test hooks can still exercise 4+3
read-only Roslyn previews, including refusal and links. The same
installed candidate passes Configure/Refresh, two-scoped registered
Usage View, Restricted Mode (no workers launched), and prior P2
cross-navigation (6 Situations and 10 assertion links).
Machine-local JSON report records `publicRenamePreview: EXCLUDED`
and `researchRenamePreview: PASS_TEST_MODE_ONLY`. Ordinary-user
manual acceptance remains PENDING and previously accepted release
and intermediate candidate hashes are preserved.

## D-063 — P1/7.4 internal normalized JSON feasibility (NOT a public export)

Status: SOURCE + REAL VITEST/XUNIT PROOF PASS / WINDOWS CI PENDING / 2026-10-11

After the user reported the shortened MVP checklist appears to work and
asked to resume implementation, the next bounded development unit is
**internal normalization feasibility** for deferred P1/7.4. This
decision intentionally does not approve a public, stable/versioned
export schema, new Command Palette action, workspace JSON writes or
further user manual acceptance.

Added `src/core/normalizedSnapshot.ts`: a **pure, experimental,
read-only** transformation of existing framework-backed
`JoinedSituation`/`TestDefinition`/`Diagnostic` values. It retains
exact `FeatureSpaceId + logicalFolderKey`, Feature/Outcome/Situation,
frontend/backend role, expected behavior, assertion order/literal
source snippets, trust state, exact source/navigation coordinates
and structured diagnostics. Missing parts are explicit `null`;
unresolved parameterized definitions are in a separate collection
instead of being silently omitted or invented as concrete cases.

Normalized source paths are workspace-relative and POSIX-delimited.
Every source is physically resolved and must remain under the trusted
single workspace root; invalid positions, unexpected part identity,
duplicate Situation identity, and duplicate unresolved definition
identity fail closed. Arrays are sorted lexically by semantic identity
and diagnostic content; result excludes timestamps and does not mutate
the engine input. `serializeExperimentalSnapshot()` emits deterministic
JSON text with `experimental:true` and has **no stable schema version**.

Evidence: new tests in `test/normalized-snapshot.test.mjs` cover
precise identity, unmatched parts, source snippets, source anchors,
degraded trust, unresolved evidence, ordering/repeatability, path
escape/refusal, invalid coordinates and duplicate identity. Node
source regression expanded **62/62 → 68/68 PASS**. The real end-to-end
proof `node scripts/verify-experimental-json-snapshot.mjs` runs the
existing trusted Vitest 5 + xUnit v3 fixtures through
`runFullPrototype`, verifies 3 concrete Situations, 6 matched
frontend/backend parts, 6 literal assertions, normalized relative
paths and identical JSON for reversed discovery order. It writes
**no user source files** and exposes no public export functionality.

Added the real proof to `.github/workflows/windows-source-proof.yml`,
with fixture Vitest `npm ci` and xUnit project restore prerequisites.
GitHub-run PASS must be independently checked after push; merely
adding CI YAML is not a successful CI run.

Limitations requiring a separate public scope decision: schema/version
migration policy; API/CLI/UI export mechanism; conflict/unresolved
error policy; diagnostic message privacy (messages may contain
environment-specific paths); absolute-path policy; sanitization;
snapshot freshness/dirty VS Code documents; file atomicity, user
confirmation and security review. P1/7.4 **stable JSON/export remains
LATER**. The D-062 user-facing no-Rename MVP and its manual/release
status are unchanged.

## D-064 — Internal metadata-only JSON disclosure draft; no public export

Status: SOURCE + REAL FIXTURE PROOF PASS / WINDOWS CI PENDING / 2026-10-11

Following D-063, internal normalized evidence still contains potentially
private free-text diagnostic messages (including machine paths) and
literal source snippets from feature tests. A public JSON/export contract
must not accidentally expose these fields before explicit informed user
review and consent. The next bounded unit implements a **non-publishable
metadata-only disclosure draft**, not a shipping exporter.

New `src/core/exportDraft.ts` consumes a trusted in-memory
`NormalizedSnapshot` and reconstructs an allowlisted result:
`kind: feature-projection/disclosure-draft`, `publishable: false`,
`requiresExplicitConsent: true`, `containsUserAuthoredIdentifiers: true`,
`diagnosticMessages: omitted`, `assertionSourceCode: omitted`.
FeatureSpace/feature/outcome/situation identity, part roles, trust,
expected behavior, assertion kind/source location and structured
diagnostic rule/severity/impact/source remain available.
Unmatched parts stay null and unresolved definitions remain explicit.

Every normalized path is independently checked as workspace-relative
POSIX and every coordinate is validated when copied into the draft.
Source objects are copied, not shared with the underlying snapshot.
The serializer rejects unknown JSON property names at all depths
(including any reintroduced diagnostic `message`, raw `sourceCode`,
or injected secret field), absolute/traversal/backslash paths,
and any attempt to set `publishable: true` or disable consent.

The draft includes a disclosure summary with situation count,
unmatched part count, unresolved definition count, count of literal
assertions omitted, count of diagnostic messages omitted and whether
blocking evidence exists. It is deliberately deterministic and
contains no timestamps, file writes, workspace mutations, new
VS Code commands or stable public schema/version claims.

Source unit tests expanded **68/68 -> 73/73 PASS**. Dedicated
`test/export-draft.test.mjs` tests adversarial diagnostics containing
absolute machine paths/Bearer-looking text, raw assertion snippets,
scope/structure retention, consent flags, nested field injection,
traversal/absolute path refusal, clone separation and determinism.
The real Vitest 5 + xUnit v3 proof
`scripts/verify-experimental-json-snapshot.mjs` also verifies the
metadata-only draft: 3 Situations, 6 literal snippets omitted,
byte-for-byte deterministic when source discovery is reversed,
no user-source writes and `publishable: false`.
Windows CI's existing real fixture step runs the expanded proof.

**IMPORTANT PRIVACY LIMIT:** although diagnostics and snippets are
omitted, user-authored FeatureName/Outcome/Situation/ExpectedBehavior,
file names and unresolved definition IDs can themselves contain
private data. The draft does **not** certify arbitrary user strings
as safe for external sharing. No actual JSON file export, clipboard,
network upload, public command or automated disclosure is permitted.
Before a public exporter: separately decide schema/version policy,
UX consent and review, data classification, dirty/fresh snapshot
checks, atomic output handling and path/identifier privacy policy.
D-062 no-Rename MVP/release scope and manual pending status remain
unchanged. Do not mistake this technical proof for release approval.

## D-065 — P3 portable HTML view from the canonical Projection model

Status: SOURCE/REAL FIXTURE + FINAL SHA-PINNED INSTALLED PASS;
ordinary-user browser/localhost acceptance **PENDING** (2026-10-11).

User clarified that an **existing separate localhost app** will host or
embed the finished Projection; Feature Projection itself must not start
another server. The user wants Markdown inside VS Code and a complete
HTML Projection outside VS Code, with possible links back to exact
source lines. JSON is the shared *internal data model*, not a separate
public export button. The user approved proceeding.

Implemented a detached, JSON-compatible in-memory
`ProjectionDocument` from `JoinedSituation[]`, rendered as both:
VS Code Markdown (existing `renderProjection`) and standalone,
script-free HTML (`renderPortableProjection`). HTML preserves exact
FeatureScope/Outcome/Situation identities, Frontend/Backend, literal
assertions, expected behavior, trust and source/navigation links;
unmatched parts are explicit. Case anchors use encoded complete
Testing API identity, never labels alone.


Added `featureProjection.portableHtmlDirectory` (optional **absolute**
directory). On a trusted, non-blocking, non-stale **explicit Refresh**,
the extension atomically writes a generated `projection.html` into
this directory. Without configuration, it uses a stable workspace-
qualified folder beneath extension global storage, outside project
source. The "Open HTML Projection" command opens the last fresh file;
no separate "Export" command, JSON file, server or network requests.

HTML uses escaped text/attributes, protocol-restricted `vscode://file`
links and a restrictive Content Security Policy; no scripts, dynamic
DOM or generated JS. Generated-file ownership marker and atomic
replacement refuse overwriting unrelated `projection.html`.
No automatic writes happen in Restricted Mode or after blocking/stale
Refresh. Existing files may remain **stale** until next good Refresh.
The caller's existing localhost static file route/port/server is
outside this extension's responsibility.


Technical source evidence: **79/79** Node tests, including 6 new
tests for detached internal document, two-scope rendering, HTML
escaping/link guards, stable storage, no clobber, repeat updates,
unmatched states and duplicate identity refusal. Real Vitest+xUnit
proof: 3 Situations, 6 literal assertions, same snapshot powering
Markdown and generated HTML, atomic file under isolated temporary
storage. Existing D-063 and D-064 source proofs stay green.
Added installed VSIX checks for the normal public "Open HTML"
command, trusted Refresh generating the actual HTML, source links,
no writes during Stale, and Restricted Mode no-publish safety.

**Not demonstrated/approved yet:** actual human browser/iframe
behavior, externally served localhost path, automatic page reload,
browser external URI confirmation, multi-root scope, public release
or release/version bump. The old D-062 MVP candidate and historical
artifacts remain untouched. This P3 change is separate from the
older accepted scope and requires its own manual acceptance before
any release. No broad web access or automatic publication is enabled.


### D-065 watcher-safe revision and candidate

Because the user may configure their localhost static directory
under a watched frameworkProject, the first generated HTML could
otherwise self-invalidate the VS Code projection as Stale.
`isPortableHtmlOutputPath` therefore excludes only the exact
`projection.html` and 24-hex atomic `.projection-*.tmp` files
inside the configured directory. Other files remain watched.
Added source unit and installed trusted smoke checks proving
that a successful Refresh to such a configured directory remains
Fresh while a genuine feature-test edit still makes it Stale.

Original P3 candidate: `...p3-dual-projection-candidate.vsix`
20,500,133 bytes, SHA-256
`1E99142C54B9CD559EE883F371F1BB73ADBDC12A8D7F7F005B33B6C351B270C7`.
The watcher-safe final candidate was packaged **separately** at
`artifacts/feature-projection-prototype-p0-0.1.0-p3-dual-projection-watcher-fixed-candidate.vsix`,
20,500,451 bytes, SHA-256
`A995A0690144E343EEF500D5CB16A20D6E0C40E1B6E9B804C8C879B3935C84F5`.
All older candidate bytes were preserved. Manual localhost/browser
acceptance and release approval remain PENDING.


### D-065 final candidate — confirmed event-watcher wiring

Source review found that the watcher exclusion helper existed in
the second P3 VSIX but its call was not present in the VS Code
`isRelevantUri` function. It was explicitly wired and independently
confirmed by searching the activation source; the final candidate is
`artifacts/feature-projection-prototype-p0-0.1.0-p3-dual-projection-source-watch-fixed-candidate.vsix`,
20,500,477 bytes; SHA-256
`4468280CE13A55FFDAE69CA7F086F6FC68F9342DF9EC7C393692688AB4091380`.
Earlier P3 candidates are immutable historical test evidence, not the
recommended candidate. Unit suite **79/79 PASS**; real fixture proof
PASS. The final installed Windows regression is separately verified.
No ordinary-user browser acceptance, release or public export is
assumed.

## D-066 - Browser/localhost integration gate preflight, no new feature

Status: PREFLIGHT VERIFIED / ORDINARY-USER BROWSER ACCEPTANCE PENDING
(2026-10-11). The nearest open D-065 successor is the **one**
browser/localhost manual gate, not a repeat D-065 implementation,
public JSON export, alternative server, or new candidate packaging.

GitHub `main` and clean Windows checkout were both
`c466a4fe16a63bbe6290594d4a97dd1b3d19a047`.
New Windows `npm test` was 79/79 PASS; real
`verify-experimental-json-snapshot.mjs` PASS (3 Situations,
6 assertions, shared Markdown/HTML and D-063/D-064 regressions).
Final existing D-065 VSIX SHA/size and ignored installed report were
rechecked; the prior **isolated** installed PASS remains valid.

Ordinary installed VS Code extension 0.1.0 lacks the public Open HTML
command and renderer; it is not the final D-065 candidate. Do not
replace the user's ordinary installation without explicit approval.
The prepared fixture exists; actual app static directory/route remains
unknown. The final manual gate is described in
`docs/plan/PORTABLE-PROJECTION-INTEGRATION.md`.
Browser/iframe, `vscode://` clicks, real localhost serve, user
approval and release all remain PENDING. No new VSIX or release tag.

### D-066 ordinary installation following preflight (2026-10-11)

User approved replacing the older ordinary VS Code extension after
candidate recheck, and deferred any integration with their own
localhost application. Final D-065 VSIX size/SHA and archive modules
matched expected; original isolated installed technical report still
PASS. The older ordinary extension was archived in a separate ignored
local ZIP before replacement. The VS Code CLI installation returned
exit 0. Confirmed ordinary installed Open HTML contribution, matching
command set and identical compiled main/portable modules vs the VSIX.
Installed `package.json` has only expected VS Code `__metadata`.

**Ordinary installation: VERIFIED ON DISK.** UI window reload and
actual standalone browser/VS Code external protocol behavior are not
yet verified. Localhost app path/route/iframe intentionally DEFERRED
at the user's instruction; do not request or configure it now.
No manual browser PASS, new implementation, release or publication.
Evidence and local backup hash: REVIEW-LOG D-066 continuation.

## D-067 - P3 explicit Refresh phase timing baseline (2026-10-11)

Status: SOURCE/REAL FIXTURE PROOF; incremental caching NOT implemented.
With the user's direction to continue development after D-066, added
optional read-only `FullRunOptions.onTiming` measurements for validated
config, per-scope Vitest/xUnit static/materialization/build phases,
expansion, join and Markdown rendering. Each record has phase,
elapsed milliseconds and at most FeatureSpace/source IDs: no raw
assertion source, diagnostic messages, file snippets, external
telemetry, storage or extra worker invocation. The observer's errors
are swallowed rather than changing analysis/fail-closed results.
Normal VS Code Refresh records phase times in its existing local
Feature Projection Output; it remains explicit and manual.

Two sequential real fixture runs (Windows, same source):
full engine 23,411.0 ms then 13,402.4 ms; Vitest materialization
1,979.8-2,059.2 ms; xUnit static 7,884.1-10,264.8 ms;
xUnit build 2,891.0-10,227.1 ms; xUnit materialization
556.8-873.2 ms; expand/join/render each <= 33.4 ms.
Measurements are illustrative, not general user-project SLA.

`npm test` **81/81 PASS** (+2 observer semantics/trust checks).
`node scripts/measure-refresh-baseline.mjs 2` **PASS**:
3 concrete Situations, zero blocking diagnostics and identical
joined output/diagnostics on consecutive trusted real runs.
The benchmark checks fixture source-input hashes before and after.
Existing D-063/D-064/D-065 real fixture regression is also rerun.

Decision: optimize only with evidence. The dominant sample cost is
C# analysis/build, not Projection rendering; do NOT enable persistent
caches, reuse stale runtime cases, skip verification of changed inputs,
or auto-run workers from file-watch events. Future limited proof must
design invalidation keys for source/config/project/transitive inputs
and dirty editor states, demonstrate equal results against uncached
runs, and preserve Stale/Restricted/blocking fail-closed behavior.

D-065 ordinary installed candidate stays unchanged. This is a source
change requiring no immediate replacement VSIX/manual clicks.
D-066 standalone-browser check remains PENDING, own localhost-app
integration DEFERRED, public release unapproved.

## D-068 - Conservative dependency drift probe without cache reuse

Status: Windows SOURCE PROOF PASS; GitHub CI to verify after push.
Developed bounded `observeRefreshInputs` and
`compareObservedRefreshInputs` as **opt-in** pure read-only probes,
not extension cache wiring. Content-hashes known files in each
FeatureSpace framework project/source root and hashes the effective
configuration, with distinct observed-change/observed-unchanged/
unverifiable outcomes. Every result explicitly refuses reuse
(`reusePermitted:false`). No results are cached or skipped.

Safety rationale: xUnit/MSBuild and Vitest can depend on packages,
targets/configs and source outside those roots; ignored build,
node_modules and other generated trees are explicitly NOT in the
observed closure. Files can change while scanning. Dirty editor
state must be explicitly supplied and empty, and even that does
not prove completeness of external/runtime dependencies.
No user-facing Fresh or trust changes may rely on this fingerprint.

Verified eight new unit tests: content edits with preserved timestamp
and length, additions/deletions/renames, project props and config,
scope isolation, dirty/unknown/untrusted editor state, escapes/
missing paths, excluded package trees, junctions and duplicate
scope IDs. Source suite **89/89 PASS**.
Real two-source Vitest+xUnit fixture probe **PASS** with stable
hashes and no authorized reuse. Existing real D-063/D-064/D-065
Projection proof **PASS**. Added both proof stages to the Windows CI
workflow; remote result requires separate post-push confirmation.

D-065 ordinary VS Code installation not touched; no VSIX, external
localhost server, JSON Export, Rename, or release. D-066 standalone
browser manual gate PENDING; own localhost app integration DEFERRED.

## D-069 - Bounded static Vitest caching proof, not deployed

Status: source-only opt-in proof; public Refresh cache is OFF.
D-068 Windows CI for `08dfa7c` independently confirmed SUCCESS:
https://github.com/AlexPastukhh/f-proj/actions/runs/38116681639

The source adapter now supports a captured set of exact test-file
contents for parsing. A per-instance `VitestStaticCache` observes
the same test-file discovery list and content, hashes complete
effective configuration, scope/source properties, TypeScript version
and relative file paths, and scans twice before retaining data.
Returns detached deep copies; invalid paths, alias/junction, unknown
dirty state, unsaved buffers or untrusted scope use authoritative
uncached parsing. Bounded LRU is per process, not persistent.
This is an explicit optional `runFullPrototype` argument only.
No runtime cases, Roslyn/.NET, HTML or materialization is cached.

Unit tests cover cold/hit and mutation isolation, same-length
same-mtime content changes, file enumeration edits, FeatureSpace/
config isolation, unknown/dirty/untrusted cases, linked paths
and bounded eviction. Real `verify-vitest-static-cache.mjs`
runs the full Vitest5+xUnit3 engine with cold cache, warm cache,
then without cache; it asserts identical full results and
continued runtime materialization. CI runs this proof on Windows.

Decision: no automatic cache deployment. The measured static
Vitest phase is too small to assume a meaningful user benefit;
evaluate total scan/hash/parse cost and dirty editor/watcher race
handling before opting into the live installed extension.
D-066 browser manual pending; own-app localhost DEFERRED.
No new VSIX, version, tag, release or publication.

### D-069 portability correction - hosted Windows runner

Original CI run for `1469b99` failed 8 new cache tests:
the expected cache miss was an actual fail-closed bypass.
Adjusted source-path validation to tolerate a differently
canonicalized workspace root while still refusing source/project
junctions and file aliases. Added a positive workspace-alias test,
retaining the negative source-junction test. Local tests now 98/98
PASS; CI confirmation must be checked on the correction commit.
No ordinary Refresh cache or release is permitted by this fix.

### D-069 corrected source gate - final Windows CI SUCCESS

Commit `95398c8`: GitHub Actions Windows run `38118508738`
completed SUCCESS (98 unit tests and exact Vitest static-cache
full-engine equivalence). Original `1469b99` CI failure
was corrected and is retained as historical evidence.
D-069 source feasibility proof is DONE, **not** a decision to
enable the cache in ordinary Refresh. Browser/localhost/release
status remains unchanged.

## D-070 - Reject automatic Vitest static cache activation

Status: SOURCE-ONLY safety/cost proof; NOT installed. D-069 CI
for `95398c8` and final documentation commit `d7d6b37`
completed SUCCESS (Windows).
The bounded D-069 static cache now checks supplied dirty editor
state AGAIN after its second filesystem snapshot, on cold and warm
paths. Deterministic mutation hooks confirm a same-run file change,
arrival of a new Feature test, or editor becoming dirty between
captured reads forces uncached analysis. In-memory snapshots and
synthetic fixtures only; no user's source edits.

Local Windows 12-run medians: maintained 1-file fixture direct
2.834ms, cache-hit 7.542ms; generated temporary 120-file fixture
direct 42.814ms, cache-hit 196.241ms. Cache incurs two full
content scans, and in these tests it is slower than re-parsing.
These are samples, not cross-project guarantees. No defensible
performance benefit has been demonstrated.

**Decision:** NO-GO for wiring static Vitest cache into the
ordinary extension. Keep the opt-in experiment for research only.
Do not cache Vitest runtime materialization, xUnit/Roslyn workers,
results in dirty editors, or partial source snapshots. The dynamic
editor state is not yet observed from a live VS Code Refresh.
A second synchronous scan reduces observable races but cannot
guarantee atomicity versus external writes after the final read.

D-070 adds 5 deterministic race/dirty tests and a reproducible,
non-gating benchmark. Windows local source suite 103/103 PASS,
the D-069 real cached/uncached full engine and D-063/D-064/D-065
regressions PASS. CI runs benchmark without a speed threshold.
Do not build or install another VSIX, integrate the user's app,
or publish a release. D-066 browser manual acceptance PENDING.
