# Feature Projection — Master Plan

Status: `0.1.0` Windows-first alpha accepted; P1 DONE, P2/8.1 navigation DONE, P2/8.2 technical/manual PASS (D-054), P2/8.3a usages DONE (D-055), P2/8.3b Usage View technical/manual PASS (D-056/D-057), P2/8.3c Rename feasibility DONE (D-058). D-059/D-061 read-only Rename Preview technical history preserved, but **excluded from the imminent user-facing MVP by explicit user decision D-062**. Replacement no-Rename candidate **passed isolated installed acceptance** (D-062, 62/62 tests, public command absent, prior P2 regression PASS); one consolidated ordinary-user manual acceptance remains PENDING. No public release/version bump or source mutation.

This document is the active work sequence. It does not replace the original v11 semantic/design specification. When prototype evidence conflicts with an old assumption, the explicit record in `DECISIONS-AND-DELTAS.md` supersedes only that assumption.

## 1. Planning/source-of-truth hierarchy

1. Original v11 specification — durable semantic/product invariants and original rationale.
2. `DECISIONS-AND-DELTAS.md` — explicit empirical changes and post-v11 decisions.
3. `MASTER-PLAN.md` — current status, execution order and acceptance criteria.
4. Tests/verification artifacts — evidence that a unit is actually complete.

Do not rewrite the old specification retroactively to make history look consistent.

## 2. Product goal

Build a VS Code extension that reconstructs an end-to-end feature projection from existing feature-level tests and framework metadata.

Authoritative inputs:

```text
project tests
+ project code
+ framework metadata
+ explicit workspace/project configuration
+ code-first symbol configuration where required
```

Derived result:

```text
Feature
└─ Outcome
   └─ Situation
      ├─ Frontend
      │  ├─ ExpectedBehavior
      │  └─ Assertions[]
      └─ Backend
         ├─ ExpectedBehavior
         └─ Assertions[]
```

Truthfulness rule:

```text
unknown / unresolved / unmatched
is preferable to inferred or fabricated behavior
```

## 3. Durable semantic contract

These v11 rules remain current unless a delta explicitly supersedes them.

### 3.1 Scoped join

```text
FeatureScope = FeatureSpaceId + logicalFolderKey
```

Inside one FeatureScope:

```text
FeatureName + Outcome + Situation
```

Matching is exact canonical identity. No fuzzy matching or alias layer is part of the current contract.

### 3.2 Test-description grammar

Non-parameterized:

```text
<feature>__<outcome>__<situation>__<expected-behavior>
```

Parameterized definition:

```text
<feature>__<outcome>__<expected-behavior>
```

Parameterized `Situation` comes from explicit framework-native concrete-case identity, never arbitrary payload fields.

### 3.3 Fixed feature-test contract

```text
one parameterized TestDefinition
= one ExpectedBehavior
+ one fixed assertion set
+ N concrete Situations
```

Direct control flow that breaks this contract is rejected by convention validation.

### 3.4 Assertions

Projection shows literal source snippets. Framework assertions and explicitly registered project assertions/responsibility verifications may be recognized. Unknown ordinary calls are not guessed into assertions.

## 4. Status vocabulary

```text
DONE       acceptance evidence exists
PARTIAL    useful implementation exists but original/current acceptance is incomplete
NEXT       next executable unit
LATER      retained roadmap item, not currently scheduled
DEFERRED   intentionally postponed
OPEN       decision/mechanism not fixed yet
```

## 5. Proven baseline — 0.0.11

### 5.1 Core vertical slice — DONE

Proven on the real Windows development machine:

```text
TypeScript / Vitest 5.0.3 source extraction
C# / xUnit.net v3 4.0.1 source extraction
Vitest concrete-case materialization
xUnit CreateTests() -> TestLabel materialization
four-part non-parameterized tests
three-part parameterized definitions
exact Situation join
Frontend + Backend projection
literal assertions
FeatureScope pairing
blocking/degraded diagnostics
worker timeout/process boundaries
```

Current fixture projection:

```text
invalid_user_input
  email_has_invalid_format
    Frontend + Backend
  passwords_dont_match
    Frontend + Backend

session_expired
  refresh_token_expired
    Frontend + Backend
```

### 5.2 Real VS Code Extension Host — DONE

Proven in a real Windows VS Code Extension Host:

```text
trusted explicit Refresh
external Node/Vitest worker
.NET worker bootstrap
Roslyn backend analysis
backend project build
xUnit materialization
read-only projection
Testing API semantic tree
source navigation
Fresh / Stale / Error state
external disk edit -> Stale
runtime diagnostics / Output channel
```

Evidence:

```text
verify-real-p0.ps1          exit 0
verify-extension-host.ps1  exit 0
Node/core regression suite 25/25
```

### 5.3 Testing API — ADOPTED

Use Testing API as a secondary semantic/navigation surface:

```text
Feature -> Outcome -> Situation -> Frontend / Backend
```

Current policy:

```text
publish-only TestController
no Feature Projection Run/Debug profile yet
primary explanatory surface remains projection document
```

### 5.4 Original v11 residuals — intentionally retained

The old P0 definition contained work not actually proven in 0.0.11:

```text
registered business/domain responsibility proof       PARTIAL / not implemented
custom assertion helper registration                  DEFERRED
full projection-safety failure fixture matrix         PARTIAL
stable public normalized JSON export                  DEFERRED
multiple FeatureSpaces exercised end-to-end           PROVEN IN 0.0.16
case-level parameterized source navigation            NOT YET IMPLEMENTED
additional language adapters                          NOT STARTED
stronger sandboxing                                   POST-P0
```

These are not erased by calling the core P0 hypothesis proven.

## 6. NEXT — 0.1.0 Usable Extension

Goal:

```text
install extension
-> open ordinary workspace
-> configure
-> explicit trusted Refresh
-> inspect projection/Test Explorer
-> navigate to source
```

without developer-only setup.

### 6.1 VSIX packaging and clean first run — DONE in 0.0.12; runtime dependency isolation corrected in 0.0.14

Implemented:

```text
installable .vsix
compiled extension JS/resources plus only explicit production runtime dependencies (`typescript`)
framework-dependent .NET worker packaged under workers/dotnet/runtime/
Vitest worker packaged as workers/vitest-materialize.mjs
source-tree-only .NET publish fallback retained for development
isolated installed-VSIX smoke
```

Packaging decision resolved:

```text
A. package framework-dependent .NET worker artifact
```

Reason: xUnit support already requires `dotnet` to analyze/build the user's configured project, so shipping the extension-owned worker artifact removes an unnecessary first-run compilation step without pretending the user's .NET toolchain can be bundled away.

Acceptance evidence:

```text
fresh isolated VS Code user-data/extensions dirs          PASS
install .vsix                                             PASS
loaded target from isolated installed extension path      PASS
no extension-internal npm install at runtime              PASS
no extension-owned worker build at runtime                PASS
packaged .NET worker reached                              PASS
Vitest concrete cases=2                                   PASS
xUnit concrete cases=2                                    PASS
joined Situations=3 / blocking diagnostics=0              PASS
external disk edit -> Stale                               PASS
VSIX ~15.35 MB compressed                                 OBSERVED
```

The original 0.0.12/0.0.13 installed smoke placed its isolated extension directory below the source checkout. That allowed Node module resolution to climb into development `node_modules`, so the stronger claim that the VSIX was self-contained for JavaScript runtime dependencies was not actually proven. 0.0.14 corrected this by declaring/package-including TypeScript as an explicit production runtime dependency and moving installed acceptance outside the source ancestry. Current VSIX size is about 19.51 MB compressed.

`vsce` repository/LICENSE warnings remain packaging metadata work for future publication, not local-install blockers.

### 6.2 Configure UX — DONE in 0.0.13

Implemented public command:

```text
Feature Projection: Configure
```

0.0.13 scope is intentionally single-root. Multi-root Configure stops with an actionable message rather than silently binding semantic paths to `workspaceFolders[0]`.

Implemented one-source transaction:

```text
choose/create FeatureSpace
choose/add/edit source
choose source role
confirm unique FeatureSource id
choose feature source root
choose adapter
choose framework project root
for xUnit choose projectFile
for Vitest choose automatic discovery or configFile
build draft
validate draft without framework execution
persist one workspace-settings update only when valid
re-read and validate persisted config
```

Architecture:

```text
public prompt orchestration
        |
        v
shared applySourceConfigurationChange
        |
        v
shared validatePrototypeConfig
        |
        v
single workspace settings update
```

The deterministic Extension Host/installed-VSIX test seam uses the same merge/validate/persist transaction; it does not implement a second configuration path.

Confirmed behavior:

```text
FeatureSource id is explicit and uniqueness-validated
source root and frameworkProject remain distinct
Vitest configFile is optional and relative to frameworkProject
xUnit projectFile is relative to frameworkProject
blocking draft validation prevents persistence
invalid draft does not run framework workers
successful Configure leaves projection Stale
Configure never auto-Refreshes
existing configuration-change handler rebuilds watchers and marks Stale
```

Acceptance evidence on the authoritative Windows machine:

```text
Node/core tests                                             32/32 PASS
public featureProjection.configure command registered       PASS
empty temporary workspace -> frontend source persisted      PASS
second Configure transaction -> backend source merged       PASS
invalid draft -> settings unchanged                         PASS
Configure -> hasProjection=false / Stale                    PASS
explicit Refresh -> Vitest cases=2                          PASS
explicit Refresh -> xUnit cases=2                           PASS
joined Situations=3 / blocking diagnostics=0                PASS
installed VSIX version/path identity                        PASS
installed VSIX Configure persistence from empty settings    PASS
Fresh -> external edit -> Stale                             PASS
```

The installed acceptance uses a temporary copy of project sources with empty Feature Projection settings, so pre-existing fixture configuration cannot make Configure falsely pass.

Verification limitation: automated acceptance does not mechanically click the VS Code QuickPick/InputBox/OpenDialog widgets. It verifies command registration and drives a deterministic hidden test entry into the exact same merge/validate/persist transaction used by the public prompt flow.

### 6.3 Installed-extension acceptance — DONE in 0.0.15

Run the full workflow from the installed VSIX, not a dev host.

Installed baseline proven through 0.0.15:

```text
installed target version/path identity
packaged .NET worker identity
Configure transaction from empty temporary workspace
invalid Configure draft does not persist
trusted explicit Refresh
3 fixture Situations
Frontend + Backend for all fixture Situations
no blocking diagnostics
Testing API model produced
Fresh -> external source edit -> Stale
```

#### 6.3a Trust-boundary hardening — DONE in 0.0.14

Workspace Trust now gates the entire project-evaluating/runtime path, not only final framework-case materialization.

Restricted Mode behavior:

```text
no external Vitest runtime/materialization worker
no Roslyn/MSBuild project-analysis worker
no dotnet build
no xUnit materialization
no .NET-worker bootstrap/requirement
no external Node runtime resolution/requirement
TypeScript source-only analysis remains available
C# project-backed evidence is explicit partial/unresolved
```

The installed acceptance is intentionally adversarial:

```text
fresh Restricted Mode profile
configured nodePath -> deliberately missing executable
installed .NET worker DLL -> temporarily renamed/unavailable
explicit Refresh
-> partial projection published
-> worker/untrusted-workspace
-> worker/untrusted-project-analysis
-> no worker spawn lines in Feature Projection Output
```

Acceptance evidence on the authoritative Windows machine:

```text
Node/core tests                                      33/33 PASS
real trusted Vitest                                  3/3 PASS
real trusted backend xUnit                           3/3 PASS
real xUnit case materialization                      2 cases PASS
real trusted E2E projection                          3 joined / PASS
installed VSIX loaded outside source checkout        PASS
packaged TypeScript runtime                          PASS
trusted installed Configure + Refresh regression     PASS
installed Restricted Mode: trusted=false             PASS
installed Restricted Mode: no project/runtime spawn  PASS
installed Restricted Mode: explicit partial/error    PASS
```

During this acceptance, a real packaging defect was exposed: `vitestSource` requires the TypeScript compiler at extension runtime, while 0.0.12/0.0.13 excluded all `node_modules`. Earlier installed smoke accidentally resolved TypeScript from the source checkout. 0.0.14 packages `typescript@5.8.3` as the sole production Node dependency and runs installed smoke from `%TEMP%`, outside source-module ancestry.

#### 6.3b Installed source-navigation + Markdown Preview acceptance — DONE in 0.0.15

The projection document is the primary explanatory surface. Navigation must therefore survive both the normal virtual Markdown editor view and VS Code Markdown Preview; CodeLens alone is not sufficient.

Automated 0.0.15 acceptance now proves:

```text
installed-VSIX Frontend navigation opens the exact workspace test source       PASS
installed-VSIX Backend navigation opens the exact workspace test source         PASS
Projection editor navigation opens the expected source line/range               PASS
Testing API Frontend/Backend items carry workspace source URI/range              PASS
Markdown contains native vscode://file links for all six Frontend/Backend parts  PASS
no navigation target points into the installed extension tree                   PASS
parameterized Situation navigation remains definition-level in this slice       CONFIRMED
```

Manual installed-VSIX acceptance also passed:

```text
Markdown Preview Frontend link -> expected workspace frontend test definition/range  PASS
Markdown Preview Backend link  -> expected workspace backend test definition/range   PASS
```

This closes 6.3b and overall 6.3.

Implementation constraint:

```text
preserve Feature -> Outcome -> Situation -> Frontend/Backend semantics
preserve literal assertion text
improve Markdown structure/readability without inventing behavior
keep editor CodeLens only as an additional navigation surface, not the sole one
```

Overall 6.3 acceptance:

```text
Configure succeeds
trusted Refresh is explicit
3 fixture Situations are present
Frontend + Backend present for all fixture Situations
no blocking diagnostics
status = Fresh
projection opens read-only
Testing API tree populated
Projection editor Frontend/Backend source navigation works
Markdown Preview Frontend/Backend source links work
Testing API Frontend/Backend source navigation works
all navigation targets remain workspace sources, never installed-extension files
external source edit -> Stale
automatic framework execution does not occur
untrusted workspace starts no project-evaluating/runtime worker and reports partial/unresolved evidence explicitly
```

### 6.4 Second-workspace acceptance — DONE in 0.0.16

A second executable fixture now uses a materially different repository layout:

```text
repo/
  apps/account-web/...
  apps/billing-web/...
  services/account-api/...
  services/billing-api/...
```

It starts from empty Feature Projection settings and is configured through four invocations of the same Configure transaction used by the extension: Frontend + Backend for `accounts`, then Frontend + Backend for `billing`.

The fixture deliberately makes both FeatureSpaces use `logicalFolderKey=shared` and the same canonical semantic identities:

```text
Feature: access
Outcome: denied
Situations: expired, locked
```

It also contains adversarial unmatched evidence with the same lower-level semantic identity in different FeatureSpaces:

```text
accounts/orphan -> orphan/pending/manual_review -> Frontend only
billing/orphan  -> orphan/pending/manual_review -> Backend only
```

This exposed a real pre-join correlation defect: concrete framework cases were keyed only by `adapterId + frameworkDefinitionKey`, so independent framework projects with the same relative test path/line could share a definition key and duplicate cases before semantic join. 0.0.16 scopes framework-case correlation by canonical framework-project identity as well. This is transport/framework identity; semantic Feature identity remains `FeatureSpaceId + logicalFolderKey`.

Acceptance evidence on installed `0.0.16` outside the source checkout:

```text
empty settings -> four Configure transactions                          PASS
FeatureSpaces = accounts, billing                                     PASS
Configure does not auto-Refresh / remains Stale                       PASS
trusted explicit Refresh -> Fresh                                     PASS
real engine definitions=6 / cases=8 / parts=10 / joined=6             PASS
blocking diagnostics=0                                                 PASS
identical access/denied/{expired,locked} stay isolated by FeatureSpace PASS
accounts orphan remains Frontend-only                                 PASS
billing orphan remains Backend-only                                   PASS
Testing API explicit unmatched part nodes=2                           PASS
all Testing API source targets remain workspace files                 PASS
account Vitest 3/3 / billing Vitest 2/2                               PASS
account xUnit 2/2 / billing xUnit 3/3                                 PASS
Node/core regression suite                                             35/35 PASS
primary real fixture regression                                        PASS
installed trusted Configure/navigation regression                      PASS
installed Restricted Mode regression                                   PASS
```

This closes D-032 acceptance and proves the current semantic contract on two materially different executable workspace layouts.

### 6.5 0.1.0 release gate — DONE

0.1.0 is accepted as a Windows-first alpha. Cross-platform installed acceptance remains later hardening rather than being implied by the current Windows proof.

Release-gate evidence:

```text
featureProjection.buildTimeoutMs controls trusted xUnit project builds                 PASS
hidden automation/debug commands absent from normal installed sessions                  PASS
hidden automation/debug commands available only under explicit test mode                PASS
missing configured/external Node -> actionable worker/node-runtime-missing               PASS
missing/incompatible .NET -> actionable worker/dotnet-prerequisite-unavailable           PASS
installed VSIX runs outside source-checkout ancestry                                     PASS
installed VSIX packages TypeScript as its sole production Node dependency                PASS
release acceptance does not resolve runtime dependencies from development node_modules   PASS
primary real Vitest/xUnit/E2E regression remains green                                   PASS
second-workspace FeatureScope isolation remains green                                    PASS
installed trusted Configure/navigation regression remains green                          PASS
installed Restricted Mode regression remains green                                       PASS
ordinary-user manual install/Configure/Refresh/navigation click-through                   PASS
```

Automated evidence:

```text
Node/core tests                                  40/40 PASS
primary real Vitest                              3/3 PASS
primary real backend xUnit                       3/3 PASS
primary xUnit concrete cases                     2 PASS
primary real E2E projection                      3 Situations PASS
second installed workspace                       2 FeatureSpaces / 6 Situations / Fresh PASS
normal installed session hidden commands         absent PASS
trusted missing-Node diagnostic                  worker/node-runtime-missing PASS
trusted incompatible-.NET diagnostic             worker/dotnet-prerequisite-unavailable PASS
installed VSIX trust/config/navigation smoke     PASS
```

Manual ordinary-user acceptance on 2026-10-10:

```text
install 0.1.0 VSIX in normal user VS Code          PASS
open clean prepared workspace                      PASS
Configure frontend -> app / 1 source               PASS
Configure backend -> app / 2 sources               PASS
Configure leaves Feature Projection: Stale         PASS
explicit Refresh                                   PASS
projection works                                   PASS
Frontend/Backend source navigation                 PASS
```

Release scope:

```text
acceptance platform: Windows x64
Vitest runtime prerequisite: supported external Node.js installation
xUnit runtime prerequisite: compatible .NET SDK/runtime for the configured project
```

6.5 is complete. The 0.1.0 Windows-first alpha is accepted; marketplace publication metadata remains separate work.

## 7. P1 hardening — first language pair

After 0.1.0 is product-usable, finish retained first-pair work before broadening adapters.

### 7.1 Complete projection-safety fixture matrix — DONE (post-release working checkout)

Add explicit acceptance fixtures for:

```text
malformed canonical name
missing parameterized Situation identity
non-canonical Situation identity
duplicate Situation
unresolved TestDefinition correlation
direct if/else
unsupported top-level control flow
wrong FeatureScope
no recognized assertions
worker timeout
partial worker failure
```

Each fixture verifies diagnostic semantics and projection impact. Current acceptance is source-level and synthetic-worker testing on Windows; the accepted 0.1.0 VSIX is not repackaged for these post-release changes.

| Fixture | Diagnostic rule | Category / severity / impact | Projection effect |
| --- | --- | --- | --- |
| malformed canonical name | `feature-test/canonical-name` | projection-safety / error / blocks-part | invalid definition absent |
| missing parameterized Situation identity | `feature-test/missing-situation-id` | projection-safety / error / blocks-part | no invented concrete Situation |
| non-canonical Situation identity | `feature-test/invalid-situation-id` | projection-safety / error / blocks-part | invalid case absent |
| duplicate Situation | `feature-test/unique-situation` | projection-safety / error / blocks-part | **all** ambiguous parts suppressed |
| unresolved TestDefinition correlation | `feature-test/unresolved-test-definition` | projection-safety / error / blocks-part | unmatched case not projected |
| direct if/else | `feature-test/no-if` | projection-safety / warning / blocks-part | test part absent |
| unsupported top-level control flow | `feature-test/unsupported-control-flow` | projection-safety / warning / blocks-part | test part absent |
| wrong FeatureScope | none by design: distinct identities | no diagnostic / n.a. / n.a. | separate unmatched parts; never joined |
| no recognized assertions | `feature-test/no-recognized-assertions` | projection-safety / warning / degrades-part | part retained with degraded trust and no invented assertions |
| worker timeout | `worker/materialization-timeout` | runtime / error / blocks-part | no parameterized cases/part |
| partial worker failure | `worker/vitest-materialization-failed` plus `feature-test/resolvable-situation` | runtime / error / blocks-part; projection-safety / warning / blocks-part | source-only non-param part retained; missing concrete cases absent |

Acceptance evidence:

```text
npm test                                      48/48 PASS
real primary Vitest + xUnit E2E projection    3 joined Situations / exit 0 PASS
duplicate reproduction (two regression tests) red before fix, green after fix
release ZIP and VSIX                       original SHA-256 unchanged
```

The duplicate handling fix restores the original exact semantic scope: `FeatureSpaceId + logicalFolderKey + FeatureName + Outcome + Situation + PartRole`. Multiple conflicting definitions for one scoped part are not arbitrarily resolved using first-wins. 7.1 does not claim a new installed-VSIX acceptance or replace the already accepted 0.1.0 release gate.

### 7.2 Registered responsibility proof — DONE (post-release Windows working checkout)

Implement one narrow code-first proof:

```text
RegisterResponsibility(User.Authenticate)
-> semantic symbol resolution
-> matching verification recognized
-> literal verification source projected
```

Technical/mock calls remain ignored unless explicitly registered.

The proof uses `fixtures/responsibility-proof/` (separate xUnit v3 + real Moq project) and `scripts/verify-responsibility-proof.mjs`. A project source class implementing `FeatureProjection.IFeatureProjectionConfiguration` registers `User.Authenticate(string)` via `IFeatureProjectionBuilder.RegisterResponsibility<User>(x => x.Authenticate(...))`. The Roslyn worker statically resolves the registration to `IMethodSymbol.OriginalDefinition` and compares it to the method symbol within Moq verification lambdas. It does **not execute** `Configure`.

Observed results:

```text
worker build                                            PASS
isolated xUnit/Moq fixture build and direct v3 run      1/1 PASS
Roslyn definitions=1 / diagnostics=0                    PASS
registered user.Verify(string) -> responsibility        PASS
same-name Authenticate(int) -> ignored                  PASS
unregistered logger.Verify -> ignored                   PASS
Xunit Assert.True -> literal assertion                  PASS
TS normalization + semantic projection -> joined=1     PASS
literal source preserved in projection markdown         PASS
npm test                                                 48/48 PASS
primary real Vitest + xUnit E2E                         3 Situations / exit 0 PASS
```

The compile-time configuration interfaces in this isolated fixture are **local proof contracts**, not yet a separately distributed public C# SDK/contracts package. This unit proves the narrow v11 registration mechanism on a real MSBuild/Roslyn project, not broad mock-framework support or installed-VSIX acceptance. The accepted 0.1.0 VSIX and release ZIP have not been rebuilt.

### 7.3 Custom assertion helper registration — DONE (post-release Windows working checkout)

A narrow real C# symbol-safe proof is implemented in `fixtures/assertion-helper-proof/` and verified by `scripts/verify-assertion-helper-proof.mjs`.

```text
builder.RegisterAssertion(() => FeatureChecks.AssertDenied(default(bool)))
-> Roslyn semantic method symbol
-> FeatureChecks.AssertDenied(false) recognized as assertion
-> literal source/range projected into the backend Situation
```

The analyzer reads a compiled project with Roslyn and never runs the project's `Configure()` method (the fixture intentionally throws if invoked). Recognition requires the exact `IMethodSymbol.OriginalDefinition` in a direct top-level test statement and the real `FeatureProjection.IFeatureProjectionBuilder.RegisterAssertion` declaration.

Negative assertions prove that the following are **not** projected: `FeatureChecks.AssertDenied(string)` (wrong overload), `UnrelatedChecks.AssertDenied(bool)` (wrong declaring type), `Telemetry.Track(...)` (ordinary technical call), and a fake `PretendBuilder.RegisterAssertion(...)` method with the same spelling. No unknown-helper diagnostic is fabricated.

Evidence:

```text
red before worker change: only Assert.True recognized, custom helper absent
worker build                                         PASS
isolated xUnit v3 fixture                           1/1 PASS
Roslyn definitions=1, diagnostics=0, assertions=2   PASS
literal helper source/range preserved                PASS
TS normalize -> expanded part -> joined situation   PASS
Markdown includes only recognized literal snippets  PASS
node scripts/verify-assertion-helper-proof.mjs       PASS
7.2 responsibility proof regression                 PASS
npm test                                             48/48 PASS
primary real Vitest + xUnit E2E                     3 Situations / 3 Frontend / 3 Backend / exit 0 PASS
```

Scope: proof-only C# code-first contracts are local to the fixture, not a distributed SDK; this does not claim general user-configurable multi-language helper discovery or post-release installed-VSIX acceptance. The historical 0.1.0 VSIX and release ZIP are unchanged.

### 7.3a Installed P1 candidate acceptance — DONE (isolated Windows VS Code, separate VSIX)

Created a **separate** candidate at `artifacts/feature-projection-prototype-p0-0.1.0-p1-acceptance-candidate.vsix`, keeping manifest version `0.1.0` for this internal test only. The accepted original 0.1.0 release VSIX/ZIP were not changed. The candidate packages the republished post-P1 .NET runtime. Its packaged and isolated-installed worker DLL hashes match exactly.

Repeatable scripts: `scripts/verify-installed-p1.ps1` builds/packages a fresh candidate and runs the installed baseline/P1 smoke; `scripts/verify-installed-p1-scope.ps1 -SmokeRoot <isolated-smoke-root>` reuses the installed candidate to run the second-workspace scope-isolation regression without repackaging. Both operate through CLI with separate VS Code user-data/extensions directories, not the user's main installed environment.

Acceptance on Windows:

```text
candidate package/install to isolated profile            PASS
packaged TypeScript; only declared Node dependency       PASS
normal installed session hides test/debug commands      PASS
installed Configure / Refresh and source navigation      PASS
trusted missing-Node and incompatible-.NET diagnostics   PASS
installed Restricted Mode blocks all project workers     PASS
P1 installed workspace: registered user.Verify           PASS
P1 installed workspace: registered custom assertion      PASS
P1 literal source, 2 Situations, 2 source actions         PASS
P1 excludes unregistered/wrong-overload verifications    PASS
P1 workspace Fresh / zero diagnostics                    PASS
second installed workspace: 2 FeatureSpaces, 6 Situations PASS
second workspace: 10 source actions, 2 unmatched, Fresh  PASS
historical 0.1.0 ZIP and both VSIX SHA-256                UNCHANGED
```

Candidate: `20,460,132` bytes; SHA-256 `44284D06F1A5C67A24CDF52B03F372A7D12249C3258A2A1F6C2823061D751989`. Isolated smoke result JSON files remain under a unique temp directory. This proves installed Windows technical acceptance for P1/7.1–7.3; it is not a new public release, a separate ordinary-user manual click-through, a public C# contracts SDK, or a cross-platform proof.

### 7.3b Ordinary-user manual P1 candidate acceptance — DONE (Windows VS Code)

The user installed the separate P1 candidate in ordinary VS Code, opened the prepared trusted `feature-projection-p1-manual-acceptance` workspace, and explicitly refreshed the projection.

Manual screenshot evidence: status **Feature Projection: Fresh**; two independent scopes `assertions/access` and `responsibility/auth`, Situations `invalid_token` and `invalid_password`, both Backend-only with explicit unmatched Frontend. The projected literal assertions include `FeatureChecks.AssertDenied(false);`, `user.Verify(x => x.Authenticate("invalid"), Times.Once);`, and `Assert.True(true);`. Unregistered `logger.Verify` and wrong-overload `Authenticate(42)` are absent from projected evidence.

From **Markdown Preview**, the user clicked the Backend links. VS Code showed its `vscode://file` external-application confirmation; after **Yes**, navigation opened `responsibility/Features/auth/AccessFeatureTests.cs` at **line 7**, then `assertions/Features/access/AccessFeatureTests.cs` at **line 6**. Both screenshots show the correct test definition and cursor line. The confirmation is user-visible security UX, not a failed navigation. The reason `projection.md` sometimes opens in Preview was not independently determined and no product defect is established from it.

**Ordinary-user P1 manual acceptance: PASS** (after separate installed technical PASS). This does not prove exact parameterized concrete-case navigation, public C# contracts, cross-platform readiness, or a separately published release. Historical original VSIX/ZIP remain unchanged.

### 7.4 Normalized JSON feasibility — INTERNAL PROOF DONE (D-063); stable/public export LATER

A **source-only, read-only internal normalization feasibility proof** is complete (D-063).
It does not expose a command, create files, version a public schema or change
user-facing MVP scope. A public/versioned export remains deferred until a
separate contract/privacy/freshness and UX decision.

Must preserve at least:

```text
FeatureScope
FeatureName
Outcome
Situation
PartRole
ExpectedBehavior
Assertions[]
Source
diagnostic/trust state
```

## 8. P2 — Navigation and IDE value

### 8.1 Exact parameterized case navigation — DONE (bounded contract: exact static rows, safe dynamic fallback)

The **statically declared, unambiguous** concrete-case subset is implemented and passes isolated Windows installed-VSIX acceptance for both Vitest 5 and xUnit v3.

Framework materialization remains the **only source of Situation identity**. Separate `caseSourceAnchors` merely associate an already materialized framework-native label with its exact source row. The semantic FeatureScope join, expected behavior, literal assertion source and definition-level diagnostics are unchanged. If an anchor is missing, duplicated, dynamic, or otherwise not proven, navigation safely falls back to the shared definition.

Supported proof patterns:

```text
Vitest: test.each([{ caseId: 'expired', ... }, { caseId: 'locked', ... }])
        canonical title includes [situation:$caseId]; source array and label
        binding must be static, unique, and literal
        expired -> frontend source line 4; locked -> frontend line 5

xUnit:  [InlineData(false, Label = "expired")]
        [InlineData(true, Label = "locked")]
        attribute must semantically resolve to Xunit.InlineDataAttribute;
        Label must be unique static literal
        expired -> backend source line 5; locked -> backend line 6
```

Real framework discovery confirmed Vitest `task.location` reports the **shared** invocation, not an individual row. For multiline `test.each`, the invocation location differed from the source adapter's expression start (line 6 vs 3); transport correlation now uses the precise framework task invocation line/column. Real xUnit discovery uses `System.Boolean` for a method parameter, while Roslyn previously emitted `bool`; the canonical framework definition key now uses fully qualified CLR type names. These are **framework/transport identity** fixes only, not modifications to semantic Feature identity.

The new `navigationSource` is independent of `source`: projection Markdown/native `vscode://file` links, editor source actions and Test Explorer part nodes use the exact case row when proven; assertion snippets and definition diagnostics keep their original literal sources.

Evidence:

```text
scripts/verify-parameterized-navigation.mjs           PASS
actual Vitest navigation fixture tests                2/2 PASS
actual xUnit v3 navigation fixture tests              2/2 PASS
full engine: 4 concrete cases / 2 joined Situations   PASS
exact source actions and Test Explorer rows           [4,5,5,6] PASS
ambiguous/unmatched anchors never guessed             PASS
dynamic Vitest buildCases() fallback                  PASS
dynamic xUnit MemberData fallback                     PASS
npm test                                              50/50 PASS
primary real Vitest+xUnit E2E                         3 Situations / exit 0 PASS
P1 registered responsibility/custom assertion proofs  PASS
separate Windows installed P2 navigation VSIX         Fresh / 2 Situations / 4 source actions / 0 blocking diagnostics PASS
```

Installed verifier: `scripts/verify-installed-p2-navigation.ps1` uses a separate candidate and isolated VS Code profile/workspace. Candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-navigation-candidate.vsix`, 20,462,673 bytes, SHA-256 `6F54B99A8D250BBFAD0BC114D37C22E7C2558EF6A36EAC9530B07BAB782AA0C8`. Historical original 0.1.0 release artifacts and prior P1 candidate are unchanged.

**Dynamic-provider feasibility conclusion (D-050):** directly inspected raw Vitest 5 collected tasks for both concrete Situations of `test.each(buildCases())`. They have separate framework IDs and labels but the *same* shared invocation location (11:24); there is no per-row source coordinate in the exposed collection fields. Direct xUnit v3 materialization for `MemberData` exposes distinct native `TestLabel`/`UniqueID` with no source row. Reflection on current xUnit v3 `IXunitTest`/`XunitTest` reveals label and runtime case identity but no case-row location; the legacy xUnit abstractions' source-information property is not proof of a per-row coordinate in these concrete v3 tests.

Repeatable `scripts/verify-dynamic-provider-fallback.mjs` exercises the real full engine: 2 native cases per dynamic provider, 3 joined Situations total, 4 *definition-level* actions for two parameterized Situations, Frontend line 11 and Backend line 26, zero falsely claimed exact-row sources. Framework-native labels and canonical Expected Behavior are preserved; literal assertions and Test Explorer navigation remain intact. PASS / exit 0. `npm test` 50/50 PASS and `scripts/verify-parameterized-navigation.mjs` static exact-row proof PASS on repeat.

The prior adversarial xUnit probe with two `InlineData` rows having identical arguments but different Labels materialized only one native concrete case. Never invent a missing case from source.

**Contract decision:** 8.1 is closed only for the *supported, provably safe scope*. For arbitrary dynamic providers (including `buildCases()` and `MemberData`), exact per-row navigation is **unsupported**, not silently guessed. Definition-level fallback is the intended user-facing behavior. Broader provider-specific source mapping requires new trustworthy evidence and a separate decision; never derive Situation or a coordinate from business payload/error, ordinal position, or fuzzy label-text matching. Existing isolated P2 candidate has technical acceptance, not ordinary-user manual P2 click-through or a new public release.

### 8.2 Projection/Test Explorer cross-navigation — DONE (Windows installed technical + bounded ordinary-user manual acceptance)

The Projection editor now exposes a `Reveal Situation in Test Explorer` CodeLens on each concrete Situation. It uses the officially supported `vscode.revealTestInExplorer(TestItem)` API. The Test Explorer situation/part context menu exposes `Feature Projection: Open Situation in Projection` and jumps to the exact Situation line in the virtual `projection.md` editor.

Both directions use the same **full scoped Situation TestItem ID**:
```text
FeatureSpaceId + logicalFolderKey + FeatureName + Outcome + Situation
```
The Test Explorer index contains only published concrete Situations, rebuilt on explicit Refresh. No lookups by labels, first matches or partially scoped IDs. Missing/stale/unknown IDs return false without selecting another Situation, and unmatched/unresolved parts cannot create an invented Situation. Frontend/Backend part source actions and existing parameterized static-row/definition-level fallback navigation remain unchanged.

Assertions and registered responsibilities additionally expose native Markdown Preview links and dedicated editor CodeLenses to **their own literal source ranges** (not the shared test definition). Snippet text inside code fences is preserved verbatim. The added `assertionSourceActions` collection remains separate from existing `sourceActions` and does not change semantic joining, test roles or Expected Behavior.

Windows proof:

```text
npm test                                                  54/54 PASS
full primary real Vitest+xUnit E2E                        3 Situations / exit 0 PASS
static parameterized exact-row navigation proof          PASS
dynamic native-case definition fallback proof            PASS
registered responsibility + custom helper proof          PASS
isolated installed VSIX / 2 FeatureSpaces                 accounts + billing PASS
installed concrete Situations                            6 PASS
Projection ↔ Test Explorer ID/command navigation          6 bidirectional PASS
duplicate situation labels across FeatureSpaces          no cross-scope leakage PASS
unknown TestItem ID                                       refused PASS
Frontend/Backend source actions                           10 PASS
literal assertion source links/CodeLenses                 10 PASS
installed Test Explorer unmatched parts                   2 explicit PASS
installed state                                           Fresh PASS
```

Technical acceptance scripts: `scripts/verify-installed-p2-cross-navigation.ps1` and `scripts/verify-p2-cross-navigation-assertion-acceptance.ps1`. Final internal candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-cross-navigation-assertions-candidate.vsix` (20,463,808 bytes; SHA-256 `88E8030EC53220D05682F077D7F7E9FEC25A91C05F59902F45A9673528412F62`). Earlier intermediate P2 cross-navigation candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-cross-navigation-candidate.vsix` (SHA-256 `F6EA46AB06D48A5067D68405863DB1280EC7C1564972EC0F4659E8DB71E434BB`) remains untouched. Original 0.1.0 release artifacts and the P1/previous P2 candidates remain unchanged.

**Scope limitation:** this is an isolated installed *technical* acceptance. Programmatic commands and menu contribution are verified, but the user has not manually clicked the real Test Explorer context menu or assertion links. Do not claim ordinary-user P2 acceptance, a published/newly versioned VSIX, Run/Debug, or cross-platform behavior. Manual click-through remains an explicit follow-up.

**Ordinary-user P2/8.2 acceptance — PASS for corrected Command Palette route (D-054, 2026-10-10).** The earlier inline CodeLens forward-reveal check failed or remained ambiguous (D-053); do not retroactively call it passed. The user installed the separate `p2-reveal-palette-fixed-candidate.vsix` and confirmed: (1) `Feature Projection: Reveal Situation in Test Explorer` via Command Palette, (2) `billing/shared → denied → locked` right-click `Open Situation in Projection`, and (3) Backend `Open assertion source` opening `services/billing-api/Features/shared/AccessFeatureTests.cs:22` with literal `Assert.False(testCase.Allowed);`. User confirmations for these three steps are conversational, not new screenshots. The original inline CodeLens interaction remains unverified as an independent route. Corrected candidate 20,464,402 bytes, SHA-256 `D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107`. Technical installed acceptance for this candidate and source 54/54 tests passed separately. This is **not** a new public release.

### 8.3 Usage/refactoring — PARTIAL (8.3a feasibility + 8.3b technical/manual DONE; Rename LATER)

Retain from v11:

```text
usage views
rename/refactor support
registered responsibility usages
helper navigation
```

#### 8.3a C# registered-symbol read-only reference feasibility — DONE (D-055)

Implemented an **internal, non-UI research worker command** `probe-registered-usages` in `workers/dotnet/RoslynUsageFeasibilityProbe.cs` using the existing MSBuildWorkspace, semantic registration resolution and `SymbolFinder.FindReferencesAsync`. Registration is accepted only when the containing configuration type implements the exact `FeatureProjection.IFeatureProjectionConfiguration` contract, the builder method resolves to `FeatureProjection.IFeatureProjectionBuilder.RegisterResponsibility/RegisterAssertion`, and the lambda body resolves to exactly one method symbol.

The proof returns per-symbol read-only links classified as `registration`, `feature-test`, or `project-source` within the configured C# project. Only one Roslyn symbol identity may underlie a target; overloads and same-named methods in other types do not match. Duplicate registrations or unresolved targets **fail closed**: no partial usages are returned. Reference queries are restricted to the configured MSBuild project and do not silently merge other loaded projects or FeatureSpaces. Configuration is inspected but `Configure()` is **never executed**. This research command does not produce a `WorkspaceEdit`, call Renamer or modify files.

Repeatable proof: `node scripts/verify-usage-symbol-feasibility.mjs`.

```text
User.Authenticate(string):
    configuration registration at line 33
    feature-test call at line 12
    feature-test Moq.Verify at line 13
    User.Authenticate(int) excluded

FeatureChecks.AssertDenied(bool):
    configuration registration at line 48
    feature-test assertion at line 8
    string overload, UnrelatedChecks, fake builder excluded

same-symbol duplicate registration:
    diagnostics=1 / targets=0 / fail closed
all reference SourceRanges:
    slice(start,end) is the exact symbol text
```

`P2_8_3_READONLY_SYMBOL_USAGE_FEASIBILITY_PASS`; worker builds on Windows; `npm test` **54/54 PASS**, primary real Vitest+xUnit E2E PASS, P2 static-row and dynamic-provider fallback proofs PASS, both P1 registered responsibility/custom helper proofs PASS. This is **source-only feasibility evidence**, not a newly packaged VSIX, installed technical acceptance or ordinary-user feature.

**NOT delivered:** a visible Usage View, user-facing Find References/Rename command, rename edit safety, cross-language references or complete v11 refactoring semantics. Merely knowing where a symbol is referenced cannot prove that renaming a Feature/Outcome/Situation string, an xUnit Label, a Vitest marker or business method is safe across FeatureSpaces and frameworks. No automatic edits or rename capability may be claimed.

#### 8.3b Read-only registered C# Usage View — DONE (Windows installed technical acceptance, D-056)

Contributed **Feature Projection: Show Registered C# Usages** in the normal VS Code Command Palette. On explicit invocation in a trusted, single-root workspace, choose a **FeatureSpace-qualified C# source** via QuickPick. The extension validates configuration and canonical project/workspace ancestry, executes the already established Roslyn `probe-registered-usages` command using the packaged `.NET worker`, normalizes each read-only result, and opens a dedicated virtual Markdown editor under `feature-projection:/usages/<FeatureSpace>/<source>.md`. Unlike an earlier rejected single-`usages.md` probe, **each FeatureSpace/source has an independent document URI, source link set and CodeLens map**, avoiding cross-scope stale-content leakage.

The view groups C# symbol names under **Responsibility** and **Assertion helper**, and identifies `Registration`, `Feature test`, and `Project source` links. Every item has a native VS Code source deep link and editor CodeLens `Open ... source`; paths, precise literal source spans and line/column locations are validated after the worker returns. Missing/ambiguous worker data, duplicate identity, stale/mismatched spans and project/workspace escapes fail closed. Any diagnostic yields **zero partial targets**. No `WorkspaceEdit`/`Renamer`, text replacement or file modification; no automatic worker execution on file changes or simple editor opening. Restricted Mode refuses the UI action before spawning any worker.

Independent **Windows installed technical acceptance**:
```text
npm test                                                       58/58 PASS
8.3a symbol identity + duplicate registration fail closed       PASS
VSIX installed in isolated real VS Code profile                 PASS
normal profile: hidden test commands absent                     PASS
responsibility / User.Authenticate(string)                     3 links (registration + 2 usages) PASS
assertions / FeatureChecks.AssertDenied(bool)                   2 links (registration + 1 usage) PASS
separate virtual scopes and source coordinates                  PASS
clickable Markdown source links and editor CodeLens actions     PASS
unknown FeatureSpace/source refused                             PASS
installed Restricted Mode: Usage View blocked, no worker        PASS
same installed VSIX: P2 cross-navigation + assertions           6 Situations / 10 links PASS
previous release and P1/P2 candidate SHA-256                   unchanged PASS
```

Final **8.3b technical candidate**: `artifacts/feature-projection-prototype-p0-0.1.0-p2-registered-usages-scoped-candidate.vsix`, 20,474,162 bytes, SHA-256 `7C259D336C89C961E61827E0AD6E92508BB0125CE5C0776946C17D0067275CE1`. Verification scripts: `scripts/verify-p2-registered-usages-scoped-acceptance.ps1` and `scripts/verify-p2-registered-usages-restricted.ps1`; installed older P2 regression: `scripts/verify-installed-p2-reveal-palette.ps1`. The original single-URI probe VSIX `...p2-registered-usages-candidate.vsix` (SHA-256 `8D33A18EA642410EC31946B826A45AB34E0EA8F12E262FBCAE4ACE3B0D1BBB31`) is a **rejected investigation artifact**, not an install recommendation.

**Initial acceptance boundary:** at packaging time this was technical-only acceptance. Ordinary-user acceptance followed and is recorded in D-057; preserve the historical chronology and rejected intermediate prototype. No public release was made.

**Ordinary-user P2/8.3b acceptance — PASS (D-057, 2026-10-10).** The user installed the corrected `p2-registered-usages-scoped-candidate.vsix` and opened `feature-projection-p1-manual-acceptance` (trusted workspace). Two screenshots confirm `responsibility/backend` lists registered `User.Authenticate(string)` with registration `FeatureProjectionConfig.cs:33` plus feature-test uses `Features/auth/AccessFeatureTests.cs:12, :13`, and `assertions/backend` lists `FeatureChecks.AssertDenied(bool)` with registration `FeatureProjectionConfig.cs:48` plus feature-test use `Features/access/AccessFeatureTests.cs:8`. Unregistered overloads and same-named unrelated methods are absent. Two later screenshots confirm editor CodeLens `Open feature test source` opens the correct C# files with cursor at `responsibility/Features/auth/AccessFeatureTests.cs:12` (`user.Object.Authenticate("invalid");`) and `assertions/Features/access/AccessFeatureTests.cs:8` (`FeatureChecks.AssertDenied(false);`). This **manual PASS covers displayed scopes/references and exactly these two editor CodeLens source jumps**; it is not evidence for unclicked Markdown Preview links, rename safety, other projects or source mutations. No public release was made.

#### 8.3c Read-only Roslyn registered C# Rename feasibility — DONE (D-058)

Implemented a **non-UI, research-only** .NET worker command `probe-registered-rename` and repeatable proof `node scripts/verify-rename-feasibility.mjs`. The command accepts an **exact registered C# method signature** and desired C# identifier, resolves registration semantically via Roslyn (does not execute `Configure()`), then computes `Renamer.RenameSymbolAsync` on an **immutable in-memory Solution**. **There is no `Workspace.TryApplyChanges`, filesystem write, `WorkspaceEdit`, installed command, or new VSIX.**

Strict guards: selected project must be a single loaded C# project, the target must be uniquely registered, the proposed identifier must be valid and different from the current name, and any existing same-named member (including another overload) on the declaring type is refused. Project must compile before and after the in-memory transformation; new project files or edits outside that project are refused. Every Roslyn text change must be fully contained within **one pre-resolved token span** (symbol declaration or `SymbolFinder` use); reconstructing that token must produce exactly the requested identifier. This deliberately refuses arbitrary line/block rewrites, changes to comments/strings, unknown files and partial ambiguous results. All previews contain exact original line/column, original/new token spelling, and **`mutationSupported:false`**.

Proof results (native Windows .NET 8 Roslyn, no mutation of original fixture sources):

```text
User.Authenticate(string) -> AuthenticateCredentials:
    4 identifier previews: declaration 20, registration 33, usages 12/13
    Authenticate(int) overload unchanged                              PASS
FeatureChecks.AssertDenied(bool) -> AssertAccessDenied:
    3 identifier previews: declaration 20, registration 48, usage 8
    AssertDenied(string) / UnrelatedChecks unchanged                   PASS
unregistered Authenticate(int)                                       REFUSED
same-name/no-op, reserved keyword, malformed C# identifier           REFUSED
collision with proposed name on other overload of declaring type     REFUSED
duplicate same-symbol registration                                    REFUSED
original fixture source SHA-256 snapshots before/after                IDENTICAL
```

`P2_8_3C_READONLY_ROSLYN_RENAME_FEASIBILITY_PASS`; `npm test` 58/58 and primary real Vitest+xUnit E2E PASS. This **proves only bounded in-project in-memory previews**. It does NOT establish safety against external project callers, reflection, string-based dynamic names, other FeatureSpaces, Vitest/xUnit labels, generated code, filesystem collisions, or parallel source edits. **Do not advertise or apply Rename to user projects based on this research proof.**

#### 8.3d Experimental C# Rename Preview — technical history, EXCLUDED from MVP (D-059, superseded by D-062)

Added **Feature Projection: Preview Registered C# Rename (Read-Only)** to the VS Code Command Palette. In a **trusted single-root workspace**, the user explicitly picks one FeatureSpace-qualified xUnit C# source, one **exact registered method symbol**, then types a proposed method name. No Refresh is required. The source-only Roslyn `probe-registered-rename` command computes an immutable in-memory Solution; `src/core/renamePreview.ts` independently validates the read-only result, project/workspace ancestry, real source text spans, exact old/new symbol spellings, line/column, uniqueness and complete accepted/refused contract. Unsaved open documents in the selected project cause a refusal, before or after the worker call.

The result is a **dedicated virtual Markdown document per FeatureSpace/source/symbol/newName** at `feature-projection:/rename-preview/...`. The view explicitly says **READ-ONLY**, lists exact original token positions and proposed spelling, and includes CodeLens navigation to existing source. Refused renames show a reason and **no partial edit list**. There is **no Apply, Confirm, RenameProvider, WorkspaceEdit or source write**. This feature does not claim cross-project, reflected/string, Vitest/xUnit label or external caller safety; **no actual Rename action may be added without a separate safety and explicit mutation-consent gate**.

Evidence from the separately packaged **corrected Windows candidate**:
```text
Source unit suite                                          62/62 PASS
8.3a real Roslyn registered usages                          PASS
8.3c in-memory Roslyn preview (7 tokens), collision guards PASS
Isolated installed normal profile (hidden hooks absent)    PASS
Isolated installed two-scoped preview: 4 + 3 token links   PASS
Read-only/editor CodeLens exact navigation                 PASS
Refused/no-op and unregistered-overload results            PASS (zero partial edits)
Isolated installed Restricted Mode (worker never starts)   PASS
Same installed VSIX: P2/8.2 cross-navigation regression    6 Situations / 10 assertion links PASS
Historical release and candidate hashes                   unchanged PASS
```

Candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-fixed-candidate.vsix` — **20,489,453 bytes**; SHA-256 `23C01AC1CEFFE89DE9D2A38A5CEC17ED2494636F7D9E9BFB7EDA47409753B416`. The first diagnostic `...p2-rename-preview-readonly-candidate.vsix` — SHA-256 `65420265212EE335093A08D5A1735D588DC96F1C2E71649DFD9A344BC0E384FA` — failed its smoke due to an **incorrect test-mode dispatcher**, not a verified product bug; preserved separately and **not recommended**. A generated PowerShell condition also required a correction before the installed acceptance succeeded. Verification scripts: `scripts/verify-p2-rename-preview-fixed-acceptance.ps1` and `scripts/verify-p2-rename-preview-restricted.ps1`. No public release or manifest version bump.

**Acceptance boundary:** technical installed PASS only. **Ordinary-user manual acceptance PENDING** in existing trusted `feature-projection-p1-manual-acceptance` workspace. The user should install the corrected candidate, launch the public Rename Preview Command Palette action, inspect `responsibility/backend / User.Authenticate(string)` with new name `AuthenticateCredentials`, confirm 4 proposed locations and that the C# source remains unchanged; then check `assertions/backend`. This preview is not an authorization to mutate user projects.

#### 8.3e Cross-project Rename safety, consent and apply policy — LATER

Investigate multi-project reference graphs, generated code, reflection/string uses, dirty editors, concurrent file changes, semantic collision handling, full diff, opt-in consent and rollback semantics **before** adding any mutating Rename operation. P1/7.4 export remains LATER.

## 9. P3 — Incremental refresh and cache

Goal: performance without changing the explicit runtime safety policy.

```text
file/config change
-> mark Stale
-> determine affected FeatureScope
-> explicit Refresh
-> invalidate only affected static/runtime evidence
-> rejoin affected projection
```

Potential caches:

```text
static extraction cache
framework concrete-case cache
normalized join cache
```

Rules:

```text
authoritative source wins over cache
cache keys include relevant config/tool/framework versions
runtime materialization never starts automatically from a file change
```

## 10. P4 — Run Situation spike

Only after projection/navigation is stable, evaluate Testing API Run profiles.

Possible actions:

```text
Run Frontend
Run Backend
Run Both
```

This is a separate runner-integration problem. Do not let it redefine the projection engine or unnecessarily duplicate existing Vitest/xUnit runner extensions.

## 11. P5 — Additional adapters

Original v11 candidates remain:

```text
Python / pytest
Go / testing
Rust / standard harness and/or rstest
Java / JUnit
```

Every adapter must satisfy the same normalized contract:

```text
static TestDefinition
+ concrete framework cases when parameterized
+ explicit Situation identity
+ literal assertions
+ source ranges
+ diagnostics
-> FeaturePartScenario
```

Do not broaden the adapter matrix before the first pair is product-usable.

## 12. P6 — Runtime/discovery hardening

Retain the v11 direction:

```text
worker protocol versioning
cache/version invalidation
advanced timeout/cancellation policy
failure/retry diagnostics
data minimization
stronger isolation/sandboxing if required
broader deferred/delayed enumeration support
```

Runtime discovery remains derived evidence, never source of truth.

## 13. Current known limitations

```text
only Vitest 5.0.3 + xUnit.net v3 4.0.1 are proven
only Windows installed-VSIX acceptance is proven
two materially different executable workspace layouts are proven; broader real-world layout diversity remains future hardening
parameterized navigation is definition-level
narrow business responsibility and custom assertion registration proofs exist in the working checkout; public reusable C# contracts and installed post-release P1 acceptance are not yet implemented
no public stable JSON export
no Feature Projection Run/Debug profile
no incremental recomputation/cache
full multi-root workspace support is not implemented
```

## 14. Current open questions

Non-blocking for starting 0.1.0:

```text
humanized display labels vs canonical IDs
common assertion factoring
adapter-specific description override mechanism
future optional feature segment
namespace policy for unrelated same-name features
ordering for future additional feature parts
```

Packaging strategy is resolved by D-022. 0.1.0 is planned as a Windows-first alpha (D-034); cross-platform packaging/runtime acceptance remains later release hardening. Runtime-prerequisite diagnostics and test-hook gating are explicit 0.1 release-gate work rather than implicit cleanup.

Blocking before exact parameterized source navigation acceptance:

```text
what source identity each framework can expose without changing Situation semantics
```

## 15. Verification policy

### Core/semantic changes

Must pass deterministic regression tests and applicable real framework fixture tests.

### Framework/process/runtime/VS Code changes

Container/local unit tests are not sufficient.

Required evidence:

```text
real Windows environment
real VS Code host or installed VSIX, depending on stage
real external Node/Vitest worker
real .NET/Roslyn/xUnit worker
```

The connected Windows environment used to prove 0.0.11 is the authoritative host-level acceptance environment until a broader CI matrix exists.

### Baseline change rule

When new evidence changes an old assumption:

```text
record a delta
state the old assumption
state the new fact/decision
state evidence
state scope/impact
update Master Plan status separately
```

## 16. Immediate execution order

```text
DONE-1  package/installable VSIX spike (0.0.12; JS runtime dependency isolation corrected in 0.0.14)
DONE-2  Configure command + config-validation UX (0.0.13)
DONE-3  6.3a trust-boundary hardening + installed Restricted Mode acceptance (0.0.14)
DONE-4  6.3b installed editor/Test Explorer/Markdown Preview source-navigation acceptance (0.0.15)
DONE-5  6.4 second-workspace acceptance + framework-project-scoped case correlation (0.0.16)
DONE-6  6.5 0.1.0 Windows-first release gate
DONE-7  7.1 high-value projection-safety fixture matrix + duplicate ambiguity fix (post-release checkout)
DONE-8  7.2 real xUnit/Moq registered responsibility symbol proof (post-release checkout)
DONE-9  7.3 real C# custom assertion helper symbol proof (post-release checkout)
DONE-10 P1 isolated installed-VSIX acceptance (primary, trust/prerequisites, 7.2/7.3 proof, second FeatureScope workspace)
DONE-11 Ordinary-user P1 VSIX candidate acceptance (2 Situations, literal assertions, two Markdown Preview source links)
DONE-12 P2/8.1 static explicit-label navigation (Vitest+xUnit real cases and isolated installed VSIX technical acceptance)
DONE-13 P2/8.1 dynamic-provider metadata feasibility and real 4-case definition-level fallback proof
DONE-14 P2/8.2 full-scoped Projection ↔ Test Explorer + assertion source navigation, installed Windows technical PASS
DONE-15 P2/8.2 corrected Command Palette forward reveal, reverse Test Explorer context navigation, and assertion-source ordinary-user manual PASS (D-054)
DONE-16 P2/8.3a C# symbol-safe read-only registered method usage proof (2 targets, overload exclusion, ambiguous registration fail closed)
DONE-17 P2/8.3b read-only registered C# Usage View, scoped virtual documents, isolated installed Windows + Restricted Mode technical PASS (D-056)
DONE-18 Ordinary-user P2/8.3b registered C# Usage View and two exact C# editor source navigations, manual PASS (D-057)
DONE-19 P2/8.3c registered C# Roslyn Rename in-memory symbol-token proof (7 edits, collision/overload/duplicate refusal, no file writes) D-058
DONE-20 P2/8.3d read-only registered C# Rename Preview Command Palette, 7 exact token previews, Restricted Mode + prior P2 regression installed technical PASS (D-059)
DONE-21 One cumulative 0.1.0 MVP candidate, installed Windows aggregate technical PASS (62 tests; Configure/Refresh; two Usage scopes; Rename; Restricted Mode; 6 Situations / 10 assertion links), D-061
DONE-22 D-062 replacement MVP candidate without user-visible Rename Preview: source 62/62, isolated installed normal + Restricted Mode + Usage View + cross-navigation PASS, research hooks retained
NEXT-1  Resume ONE ordinary-user acceptance checklist **without** Rename Preview; no new release until explicit approval
DONE-23 P1/7.4 internal normalized JSON feasibility (68 unit tests, real Vitest+xUnit 3 Situations / 6 parts, deterministic workspace-relative source links), D-063; PUBLIC export still deferred
DONE-24 P1/7.4 metadata-only JSON disclosure draft (D-064): excludes diagnostic message and literal assertion source, explicit no-publication/consent flags, 73 unit tests and real Vitest+xUnit proof PASS; public export LATER
DONE-25 P3/9.1 Portable Projection: one internal JSON-compatible document for Markdown and standalone HTML, 79 source tests and real fixture proof (D-065); watcher-safe final installed acceptance and browser/localhost manual pending
LATER-1  P1/7.4 stable normalized JSON/export requires separate scope/privacy/version decision
```

Do not start new language adapters, custom Run profiles, or cache architecture without evidence-driven reprioritization. The 7.1–7.3 proofs, isolated installed technical acceptance, and ordinary-user manual P1 candidate acceptance passed on Windows. P1 candidate is not a new public release; no public C# configuration SDK is claimed. P2/8.1 bounded scope is complete: static labeled-case exact navigation installed-technically accepted; dynamic-provider source fallback independently verified. P2/8.2 original inline CodeLens reveal failed or was ambiguous (D-053); subsequent corrected Command Palette forward navigation, Test Explorer context-menu reverse navigation, and direct assertion-source link passed ordinary-user manual acceptance (D-054). Direct inline CodeLens reveal is not independently verified. P2/8.3a C# symbol-usage feasibility DONE (D-055); P2/8.3b trusted read-only Usage View installed technical PASS (D-056) and ordinary-user manual PASS (D-057), scoped editor source jumps included. P2/8.3c **in-memory read-only Rename preview feasibility DONE** (D-058); general rename/cross-project safety remains unproven and no Rename UX exists. P2/8.3d explicit read-only Rename Preview installed technical PASS (D-059); cumulative MVP candidate installed technical PASS (D-061) with one SHA-pinned VSIX, consolidated report and prior regression. Ordinary-user manual remains PENDING, deferred (not waived) to the single final MVP gate (D-060). Cross-project/apply/consent Rename policy LATER (8.3e), 7.4 export LATER.

## 17. Batched MVP acceptance and release policy — D-060

**Current focus:** stabilize and automate the existing Feature Projection
MVP, then produce a single cumulative VSIX with one ordinary-user manual
acceptance session. Intermediate candidates receive **technical only**
acceptance, never a false ordinary-user PASS.

Source-of-truth checklist: `docs/plan/MVP-RELEASE-GATE.md`.
On push/PR, `.github/workflows/windows-source-proof.yml` is intended
to run Node unit tests plus .NET/Roslyn read-only proofs on Windows.
GitHub CI does not replace installed VS Code smoke: isolated trusted,
Restricted Mode and previous P2 navigation regressions still gate the
cumulative VSIX. Document any failing/unavailable CI run honestly.

The P2/8.3d ordinary-user manual result remains PENDING until the one
bundled final checklist. Do not ask for repeated VSIX installations or
success screenshots during development. No user-source mutations,
license choice, release tag, version bump or Marketplace publish without
separate explicit authorization.

## 18. Cumulative MVP installed technical acceptance — PASS (D-061)

The Windows one-install aggregate technical gate is implemented at
`scripts/verify-mvp-installed-aggregate.ps1`; its separate cross-version
safe reporter is `scripts/verify-mvp-aggregate-report.ps1`.
The gate pins VSIX SHA-256, runs 62 Node/TypeScript unit tests,
two Roslyn symbol/rename proofs, installs a *single* candidate into a
fresh VS Code extensions directory, and runs independent isolated
profiles for normal hook security, read-only Rename Preview, scoped
Usage View, Configure/explicit Refresh, Restricted Mode and earlier
P2/8.2 bidirectional navigation. Historic VSIX/ZIPs are not overwritten.

Final cumulative 0.1.0 MVP **acceptance candidate**,
`artifacts/feature-projection-prototype-p0-0.1.0-mvp-batched-acceptance-candidate.vsix`,
20,490,576 bytes, SHA-256
`54D4B3D1F5C17B3657C91AA299A129B66D146A72178633221FBC2FB0A3D83A29`:
**isolated Windows installed technical PASS** for all stages.
The first run failed at JSON report output only due to a PowerShell
5.1-incompatible relative-path call; the corrected standalone reporter
independently revalidated all six saved test result markers, and the
machine-local report is now persisted under Git-ignored
`artifacts/local-acceptance-results/`. See D-061 for evidence boundaries.

**NEXT**: one consolidated ordinary-user manual session per
`docs/plan/MVP-RELEASE-GATE.md` (PENDING, not waived).
Only after manual PASS and explicit release authorization should a
new version/tag or publication be considered. Do not claim safe
mutating Rename, cross-platform installed acceptance, JSON export,
Run profiles, caching or additional adapters.

## 19. User-approved MVP scope reduction — Rename Preview DEFERRED (D-062)

The user examined the 3-token read-only Rename Preview for
`FeatureChecks.AssertDenied(bool)` and successfully followed its
source link, but found the preview confusing because nothing could
be applied. The user explicitly approved removing it from the
near-term MVP until complete semantic Rename with consent exists.

The public contribution, activation and command registration for
`featureProjection.previewRegisteredRename` are now removed.
The read-only research implementation, Roslyn feasibility worker
and internal test hooks remain in the source repository. The
normal installed profile **must not expose or accept** the command;
the isolated research smoke must still pass using test-only hooks.

Replacement internal 0.1.0 candidate:
`artifacts/feature-projection-prototype-p0-0.1.0-mvp-no-rename-preview-candidate.vsix`
(20,490,605 bytes; SHA-256
`09E71D305560DD7E3ECCF7E161DA35FA6585D05992B4E9CE36AFD7B25FCB68A0`).
The earlier D-061 candidate remains a historical byte-preserved artifact.

**Next user-facing gate**: one consolidated acceptance of Configure,
Refresh, Projection, Test Explorer scoped navigation, registered
C# Usage View and source links. Rename UI, preview/refusal links
and Rename application are not manual acceptance requirements.
Manual MVP PASS and public release still require explicit evidence
and independent user approval.

## 20. Internal normalized JSON feasibility — DONE (D-063)

After the user's invitation to resume implementation, the bounded
P1/7.4 next step is **internal normalization**, not a public export.
New `src/core/normalizedSnapshot.ts` consumes actual joined
Feature/Outcome/Situation data, unresolved parameterized definitions
and diagnostics. Its output preserves FeatureScope, roles, literal
assertions, navigation/source, trust and unmatched/blocked evidence.
Files are normalized to workspace-relative POSIX paths. The transform
refuses identities/paths outside a trusted workspace, ambiguous
Situations and duplicate unresolved definitions, and sorts
output without relying on locale-specific comparison or timestamps.

**Source unit suite 68/68 PASS** (+6 new normalization tests).
`node scripts/verify-experimental-json-snapshot.mjs` real Vitest+xUnit
proof PASS: 3 concrete Situations, 6 parts and 6 literal assertions;
same output when discovery order is reversed, no user source writes.
Windows CI adds the real proof with explicit fixture dependencies.

**Boundary:** no VS Code command, JSON file creation, public schema
version, Release/VSIX or user source mutation. This is not a
stable export contract. A future public P1/7.4 decision must
address diagnostic-message path redaction, privacy, schemas,
compatibility, edit freshness and explicit export UX/consent.
Existing D-062 no-Rename MVP manual acceptance remains provisional;
no release authorization has been inferred.

## 21. Metadata-only disclosure draft — INTERNAL SOURCE PROOF DONE (D-064)

The D-063 normalized snapshot still includes untrusted free-text
diagnostics and literal snippets. Added `src/core/exportDraft.ts`
to construct a **separately tagged, non-publishable disclosure draft**.
It retains exact semantic scope, parts/trust, assertion kind and
workspace-relative location, unresolved cases and diagnostic codes.
By default **all raw diagnostic messages and literal assertion
source text are omitted**. The result records how many were omitted,
whether blocking evidence remains and requires explicit consent.

The draft serializer rejects extra fields at every depth, so future
accidental `message`, `sourceCode` and secret-field regressions fail
instead of silently entering JSON. All paths are independently
validated as workspace-relative POSIX and source locations cloned.

Source tests **73/73 PASS**. The real Vitest+xUnit proof verifies
3 Situations, 6 omitted literal snippets and deterministic result
across reversed discovery order, no filesystem mutation.
Windows source CI includes the expanded real proof; its status
requires independent confirmation after the D-064 commit is pushed.

**No public export yet.** Identifiers, expected behavior and
filenames remain user-authored content, possibly private. A future
explicit public contract requires review/consent UX, redaction
policy beyond diagnostic messages, schema version and compatibility,
freshness checks and safe file-output behavior.
D-062 no-Rename MVP and ordinary-user manual pending are unchanged.

## 22. P3/9.1 Portable Projection — dual Markdown + HTML (D-065)

User requirement: one Projection shown as Markdown inside VS Code and
as `projection.html` served/embedded by the user's **existing**
localhost app; no separate server or manual JSON Export step.

`buildProjectionDocument()` detaches the engine's `JoinedSituation[]`
into a single JSON-compatible semantic model. The existing VS Code
Markdown renderer and a new script-free HTML renderer use that exact
document. HTML preserves Feature/Outcome/Situation, roles, expected
behavior, unmatched evidence and literal assertion snippets. Its
scoped Situation permalink is derived from full Testing API identity.
Source links use the configured VS Code URI handler when supported.

Explicit trusted Fresh Refresh atomically updates `projection.html`.
Default output is in workspace-qualified extension global storage,
not the source repository. The optional **absolute**
`featureProjection.portableHtmlDirectory` setting targets the
static asset directory of the user's already-running localhost app.
The command `Feature Projection: Open HTML Projection` opens the
existing Fresh document. No server, external upload, editor source
mutation or new generic Rename is introduced. Stale/blocked/Restricted
Refresh cannot write a new HTML file, and collisions with unrelated
`projection.html` files are rejected.

Technical evidence: Node 79/79 source PASS, real Vitest+xUnit dual-view
proof (3 Situations, 6 assertions, atomic file outside workspace) PASS.
Isolated installed VSIX proof of generation/freshness/restricted mode
is separately required before technical acceptance. **Human browser,
iframe, localhost routing, protocol-handler prompts and browser reload
remain MANUAL PENDING**. Full HTML contains literal user source and is
not a share-safe export: never serve it publicly without user review.
Candidate `artifacts/feature-projection-prototype-p0-0.1.0-p3-dual-projection-candidate.vsix`,
20,500,133 bytes, SHA-256
`1E99142C54B9CD559EE883F371F1BB73ADBDC12A8D7F7F005B33B6C351B270C7`
is not a public release and does not replace the D-062 manual gate.
