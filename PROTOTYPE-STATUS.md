# Prototype status — 0.1.0 Windows-first alpha

Master Plan units 6.1 through 6.5 are complete. `0.1.0` has passed both automated installed-VSIX release acceptance and the final ordinary-user manual install/Configure/Refresh/navigation click-through.

## Current packaged shape

- Version: `0.1.0`
- Artifact: `artifacts/feature-projection-prototype-p0-0.1.0.vsix`
- VSIX size: ~19.51 MB compressed
- `.NET worker`: framework-dependent artifact under `workers/dotnet/runtime/`
- Runtime Node dependency: `typescript@5.8.3`, explicitly packaged
- Installed acceptance runs outside source-checkout ancestry.
- Normal installed sessions do not register hidden automation/debug commands.

## Release acceptance

```text
npm test                                      40/40 PASS
primary real Vitest                           3/3 PASS
primary real backend xUnit                    3/3 PASS
primary xUnit concrete cases                  2 PASS
primary real E2E projection                   3 Situations PASS
second installed workspace                    2 FeatureSpaces / 6 Situations / Fresh PASS
normal installed hidden automation commands   absent PASS
trusted missing-Node diagnostic               PASS
trusted incompatible-.NET diagnostic          PASS
trusted installed Configure/navigation        PASS
installed Restricted Mode                     PASS
packaged TypeScript runtime                    PASS
no undeclared packaged Node dependencies       PASS
ordinary-user manual click-through             PASS
```

## Release scope

`0.1.0` is accepted as a Windows x64 alpha. Vitest materialization requires a supported external Node.js installation. xUnit analysis/materialization requires a compatible .NET SDK/runtime for the configured project.

## Post-release P1 working checkout / next

7.1 projection-safety fixture matrix is DONE in the source checkout: all 11 planned scenarios are covered, a duplicate-situation correctness bug is fixed, `npm test` is 48/48 PASS and the real primary Vitest+xUnit E2E projection exits 0 with three joined Situations. These are **post-release** changes; the already accepted 0.1.0 VSIX and clean release ZIP were not rebuilt.

7.2 Registered Responsibility Proof is also DONE in the post-release working checkout: an isolated real xUnit v3/Moq project uses source-level `RegisterResponsibility<User>(x => x.Authenticate(...))` configuration. Roslyn matches the actual method symbol against `user.Verify(...)`, ignores unregistered `logger.Verify(...)` and the wrong `Authenticate(int)` overload, and preserves the exact verification text through TypeScript normalization into the projection. `node scripts/verify-responsibility-proof.mjs` exits 0; isolated xUnit fixture 1/1 PASS. The contracts are local to the proof fixture, not yet a distributed public configuration SDK; subsequent installed-VSIX evidence is recorded below.

7.3 Custom Assertion Helper Registration is DONE in the post-release working checkout. A separate xUnit v3 fixture statically registers `FeatureChecks.AssertDenied(bool)` through `IFeatureProjectionBuilder.RegisterAssertion`, and Roslyn includes exactly the registered literal assertion while ignoring a same-named overload, another type's helper, telemetry calls and a fake builder API. The repeatable `node scripts/verify-assertion-helper-proof.mjs` exits 0, fixture runs 1/1, 7.2 remains green, `npm test` is 48/48 PASS, and real primary E2E still returns three joined Situations. These are proof-level C# contracts, not yet a public configuration SDK; separate installed P1 acceptance has now passed.

## Post-release P1 installed candidate — Windows technical acceptance PASS

A separate VSIX candidate was packaged at `artifacts/feature-projection-prototype-p0-0.1.0-p1-acceptance-candidate.vsix` (20,460,132 bytes; SHA-256 `44284D06F1A5C67A24CDF52B03F372A7D12249C3258A2A1F6C2823061D751989`). Its manifest still says 0.1.0, but it is **not** the accepted original release artifact and was installed only in isolated VS Code user-data/extensions directories outside the checkout.

Installed technical checks PASS: normal hook gating; installed Configure/Refresh/navigation; missing Node and incompatible .NET diagnostics; Restricted Mode; fresh P1 workspace with 2 Situations, 2 backend source actions, literal registered responsibility and custom assertion evidence, zero diagnostics and no unregistered verifications; and second workspace with accounts+billing / 6 Situations / 10 source actions / 2 unmatched parts / Fresh. The packaged .NET worker DLL is byte-for-byte identical to the installed worker. Original 0.1.0 release VSIX and ZIP SHA-256 remain unchanged.

Evidence scripts: `scripts/verify-installed-p1.ps1` and `scripts/verify-installed-p1-scope.ps1`, with JSON results preserved in the uniquely named isolated temp smoke root. This records **technical installed-candidate acceptance**. A separate ordinary-user manual P1 click-through was subsequently completed (see below). Neither constitutes a new published release.

**Ordinary-user manual P1 acceptance: PASS.** In normal VS Code, the user installed the P1 candidate, opened the prepared trusted `feature-projection-p1-manual-acceptance` workspace and explicitly refreshed. Status: **Fresh**; scopes `assertions/access` and `responsibility/auth`; Situations `invalid_token` and `invalid_password`, each with unmatched Frontend. Literal `FeatureChecks.AssertDenied(false);`, `user.Verify(x => x.Authenticate("invalid"), Times.Once);`, and `Assert.True(true);` appeared; unregistered/wrong-overload verifications were absent. Markdown Preview Backend links opened `responsibility/Features/auth/AccessFeatureTests.cs:7` and `assertions/Features/access/AccessFeatureTests.cs:6` after clicking **Yes** on VS Code's external-link confirmation, with correct file and cursor line shown in screenshots. The confirmation is expected security UX, not a failed navigation.

## P2/8.1 static parameterized-case navigation — installed technical PASS (limited scope)

The working checkout now supports **exact case-row navigation only when a unique explicit static label/source anchor is proven**: literal Vitest `test.each([...])` rows with a directly bound `[situation:$caseId]` title, and Roslyn-bound xUnit `[InlineData(..., Label = "...")]` rows. Situation still comes solely from framework-native concrete case identity/label. The separate case navigation range never overwrites the definition or assertion source ranges. Both Markdown source links and Test Explorer use the exact case row when proven.

Fixture `fixtures/parameterized-navigation-proof/`; source proof `node scripts/verify-parameterized-navigation.mjs` PASS; real Vitest fixture 2/2 and xUnit fixture 2/2 PASS; `npm test` **50/50** PASS; original primary E2E **3 Situations** PASS; previous P1 responsibility/assertion proofs PASS. A **separate** isolated P2 installed VSIX candidate passed Fresh with **2 Situations / 4 exact source actions on lines 4,5,5,6 / 0 blocking diagnostics**, including Markdown link, Test Explorer and editor command navigation.

Candidate: `artifacts/feature-projection-prototype-p0-0.1.0-p2-navigation-candidate.vsix` (20,462,673 bytes; SHA-256 `6F54B99A8D250BBFAD0BC114D37C22E7C2558EF6A36EAC9530B07BAB782AA0C8`). This is an **isolated installed technical acceptance**, not a new published release or ordinary-user manual P2 click-through. Historical 0.1.0 and P1 candidate hashes remain unchanged.

**P2/8.1 bounded contract completed.** Dynamic-provider feasibility was checked against real framework outputs. Vitest `test.each(buildCases())` gives distinct native case IDs/labels but the same shared task location at line 11:24, not a row coordinate. xUnit v3 `MemberData` returns native Labels/UniqueIDs but no independently trustworthy per-row source; the current xUnit v3 test reflection API exposes no proven row position. The reproducible `scripts/verify-dynamic-provider-fallback.mjs` reports PASS (4 real concrete cases, 3 joined Situations, 4 safe definition-level navigation actions, 0 invented exact-row claims), with Frontend line 11 and Backend line 26 for the two dynamic Situations. Repeated `npm test` 50/50 PASS and the static exact-row navigation proof PASS.

**Supported:** exact row navigation for unambiguous static Vitest/xUnit labels, already installed-technically accepted. **Unsupported but safe:** arbitrary computed Vitest cases and xUnit MemberData navigate to their definitions. Further dynamic source mapping needs separate trustworthy framework-backed evidence; never infer coordinates or Situation from business payload, errors, ordinal order, or fuzzy label matches. No new P2 VSIX was created by this feasibility check, and ordinary-user P2 acceptance remains pending.

## P2/8.2 Projection ↔ Test Explorer + assertion navigation — installed technical PASS

Projection Situation rows now provide a `Reveal Situation in Test Explorer` CodeLens. From Test Explorer's Situation/part context menu, `Open Situation in Projection` targets the precise Situation line in the virtual Markdown editor. Both use a published TestItem ID based on the **full semantic FeatureScope + FeatureName + Outcome + Situation**, never a name-only lookup. Unknown/stale TestItems are refused without navigating to another Situation. Matched Frontend/Backend source links and Test Explorer part-node navigation retain their earlier behavior.

Literal assertion/registered-responsibility code snippets additionally expose dedicated native Markdown Preview source links and editor CodeLenses to their actual assertion ranges. Code content is not paraphrased. Their link actions are separate from existing part source actions; 8.1 static-row navigation and dynamic definition fallback remain unchanged.

Regression: `npm test` **54/54 PASS**, primary real Vitest+xUnit E2E three Situations PASS, P2 static/dynamic proofs PASS, P1 registered responsibility and custom helper proofs PASS. Isolated installed VSIX technical acceptance: two FeatureSpaces (`accounts`/`billing`), six Situations, six bidirectional scoped navigation actions, ten Frontend/Backend actions, ten assertion source links/CodeLenses, two explicit unmatched parts, correct refusal of unknown IDs, and status Fresh — **PASS**.

Final internal candidate: `artifacts/feature-projection-prototype-p0-0.1.0-p2-cross-navigation-assertions-candidate.vsix` — 20,463,808 bytes, SHA-256 `88E8030EC53220D05682F077D7F7E9FEC25A91C05F59902F45A9673528412F62`. The earlier cross-navigation-only candidate and all historical release/P1/P2 candidates remain separate and unchanged.

**Acceptance boundary:** this is an installed technical proof of command dispatch and menu contribution, not a manual ordinary-user click in Test Explorer or Markdown Preview for this P2 build. This candidate retains manifest version 0.1.0 and is not a newly published release.

Next: P2/8.3 usage/refactoring *feasibility review*. Do not begin new adapters or Run/Debug/cache architecture without new evidence. P1/7.4 stable normalized JSON/export remains LATER.

## P2/8.2 ordinary-user forward Reveal — initial FAIL (later resolved via Command Palette in D-054)

Manual Windows VS Code acceptance confirmed six correct Situations and Test Explorer groups under accounts/billing, but the `Reveal Situation in Test Explorer` CodeLens did not visibly expand/select `expired`/`locked`. Screenshots showed Frontend shared `test.each(buildCases())` source instead; exact UI click target remains unproven. Mark **manual P2/8.2 forward Reveal FAIL**, not accepted; the installed technical smoke only validates command dispatch.

D-053 fixes discoverability by adding an explicit Command Palette `Feature Projection: Reveal Situation in Test Explorer` QuickPick with full scoped names. Initial probe attempted a nonexistent VS Code view command and failed isolated smoke; this was removed. New separate technical PASS candidate: `artifacts/feature-projection-prototype-p0-0.1.0-p2-reveal-palette-fixed-candidate.vsix` (20,464,402 bytes, SHA-256 `D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107`). Source 54/54 PASS; isolated installed smoke PASS (6 Situations, 2 FeatureSpaces, 10 assertion actions, 10 source actions, Fresh). This still **does not prove visual reveal**. Require new ordinary-user Command Palette retest before manual acceptance or P2/8.3 work.
**Later resolution — P2/8.2 manual PASS (D-054).** The earlier CodeLens-facing failure recorded above remains historical and should not be erased. The user installed `artifacts/feature-projection-prototype-p0-0.1.0-p2-reveal-palette-fixed-candidate.vsix` in ordinary VS Code, confirmed the explicit `Feature Projection: Reveal Situation in Test Explorer` **Command Palette** workflow works, and then confirmed two more user-visible actions: Test Explorer `billing/shared → denied → locked` context-menu `Open Situation in Projection` opens the matching projected Situation; Backend `Open assertion source` opens `services/billing-api/Features/shared/AccessFeatureTests.cs` at **line 22** (`Assert.False(testCase.Allowed);`). Manual **PASS applies to these three supported paths**, not to separately unverified inline CodeLens behavior. The final confirmations were conversational. Installed technical smoke and 54/54 source tests passed before this manual check. The candidate SHA-256 is `D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107`; it remains internal version 0.1.0 and is not a newly released artifact.

## P2/8.3a C# registered method usage feasibility — read-only proof PASS

A new **internal** research command `probe-registered-usages` in the working .NET worker finds references using Roslyn `SymbolFinder.FindReferencesAsync` after resolving existing code-first `RegisterResponsibility` and `RegisterAssertion` registrations semantically. It reads the configured C# project only, does not execute `Configure()`, excludes same-named overloads and fake builder registrations, and emits literal source spans for registrations and usage sites. Ambiguous duplicate registration yields diagnostics and **zero** usage results (fail closed). No code edits or rename operations exist in this command.

`scripts/verify-usage-symbol-feasibility.mjs` **PASS**:
- `User.Authenticate(string)`: one registration (line 33), direct call (12), Moq verification (13); `Authenticate(int)` excluded.
- `FeatureChecks.AssertDenied(bool)`: registration (48), helper assertion (8); the string overload and unrelated `UnrelatedChecks` excluded.
- Duplicate registration: zero results + explicit diagnostic.

Regression: `npm test` **54/54 PASS**, primary real Vitest+xUnit E2E PASS, P2 static and dynamic case navigation proofs PASS, both P1 responsibility/custom helper scripts PASS. Only the **working source checkout** and worker DLL were changed. No new VSIX, public Usage View, installed acceptance, or user-visible Rename command is claimed; historical release artifacts remain separate.

**8.3a** was a source-only proof; its original result remains valid. **8.3b Windows installed technical acceptance is now PASS (D-056)**, with **ordinary-user acceptance still PENDING**. Rename/refactoring safety requires a later separate semantic-edit/collision proof; do not implement search-and-replace. P1/7.4 normalized JSON/export remains LATER.

## P2/8.3b registered C# Usage View — installed technical PASS + ordinary-user manual PASS (D-057)

Public Command Palette: `Feature Projection: Show Registered C# Usages`. Requires a trusted single-folder workspace and an explicitly chosen scoped xUnit source (`FeatureSpace/source`). Roslyn worker looks up registered responsibilities and assertion helpers; the extension shows a dedicated read-only `feature-projection:/usages/<space>/<source>.md` view with registration, feature-test and project-source links. Markdown Preview native `vscode://file` links and editor CodeLens `Open ... source` navigate to literal Roslyn symbol spans. A separate view/document/action map per scope avoids stale data from another FeatureSpace. Paths are checked against real workspace/project ancestry; invalid/ambiguous symbols and stale coordinates are rejected rather than guessed. This command never performs Rename or a `WorkspaceEdit` and never starts automatically.

First research package `...p2-registered-usages-candidate.vsix` was **rejected** after an installed smoke revealed one shared virtual `usages.md` document could retain the previous source's content. Replaced with **separate scope-qualified URIs**, new candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-registered-usages-scoped-candidate.vsix` — 20,474,162 bytes; SHA-256 `7C259D336C89C961E61827E0AD6E92508BB0125CE5C0776946C17D0067275CE1`.

Proof: source `npm test` **58/58 PASS**; 8.3a Roslyn reference/duplicate guard PASS; installed Windows trusted profile `p2-registered-usages` PASS (P1 fixture proof: `User.Authenticate(string)` 3 links, `FeatureChecks.AssertDenied(bool)` 2 links, native source navigation and scoped CodeLens); installed normal profile hidden test commands absent PASS; installed Restricted Mode refuses usage and spawns no worker PASS; installed P2 cross-navigation regression 6 Situations / 10 assertion links PASS; all historical artifacts checksum-unchanged.

**Later ordinary-user manual acceptance — PASS (D-057).** User installed the corrected scoped candidate and used the existing trusted `feature-projection-p1-manual-acceptance` workspace without Refresh. Screenshot `responsibility/backend`: `User.Authenticate(string)` registration `FeatureProjectionConfig.cs:33`, use `Features/auth/AccessFeatureTests.cs:12`, Moq Verify use `:13`. Screenshot `assertions/backend`: `FeatureChecks.AssertDenied(bool)` registration `FeatureProjectionConfig.cs:48`, use `Features/access/AccessFeatureTests.cs:8`. Both screens show the intended CodeLens actions and isolated symbols/scopes; unrelated overloads are not listed. Later screenshots confirm `Open feature test source` lands on `responsibility/Features/auth/AccessFeatureTests.cs:12` with `user.Object.Authenticate("invalid");` and `assertions/Features/access/AccessFeatureTests.cs:8` with `FeatureChecks.AssertDenied(false);`. Manual **PASS is bounded to these two virtual views and editor CodeLens jumps**. Native Markdown Preview links were technically, but not separately manually, tested. Rename has not been delivered or tested; it requires independent semantic safety feasibility.

**NEXT:** P2/8.3c Rename/refactor **feasibility investigation**, beginning without any mutations or user source file edits; no new public release. P1/7.4 normalized JSON/export remains LATER.

## P2/8.3c read-only C# Rename feasibility — source proof PASS (D-058)

**Worker-only research, no user-facing Rename command or VSIX.** Added `probe-registered-rename` to the .NET worker. It semantically resolves exactly one registered C# method, uses Roslyn `Renamer.RenameSymbolAsync` on an immutable in-memory Solution and returns a read-only list of symbol-token changes. This does not invoke `Workspace.TryApplyChanges`, `WorkspaceEdit`, or filesystem writes. The method project must compile before and after. All proposed edits must occur entirely inside original symbol declaration/reference spans; changes outside one exact identifier, across projects, or colliding with any same-named declaring-type member fail closed.

Repeatable proof: `node scripts/verify-rename-feasibility.mjs` — **PASS**. `User.Authenticate(string) → AuthenticateCredentials` previews 4 tokens (declaration, registration, 2 uses); `FeatureChecks.AssertDenied(bool) → AssertAccessDenied` previews 3 tokens. Wrong overloads and unrelated types do not change. Unregistered overload, no-op name, invalid/keyword identifier, an existing overload with the requested name, and duplicate same-symbol registration all refuse the preview with **zero edits**. Original C# fixture sources remain byte-identical. Existing `npm test` **58/58 PASS** and primary real Vitest+xUnit E2E PASS.

**Limitation:** this proves only bounded one-project previews, not a safe general Rename operation. Cross-project consumers, reflection/strings, generated code, FeatureSpace boundaries, runtime labels, staleness and user consent are still unproven. P2/8.3c feasibility DONE; **NEXT P2/8.3d** define opt-in Rename UX/policy and stronger semantic safety proof. No new VSIX or public release; historic P2/8.3b manual PASS remains unchanged.

## P2/8.3d read-only registered C# Rename Preview — installed technical PASS, manual PENDING (D-059)

A new explicitly invoked **Command Palette** action `Feature Projection: Preview Registered C# Rename (Read-Only)` selects an exact FeatureSpace/source, one Roslyn-registered C# method signature and a proposed new identifier. It computes a **read-only, one-project in-memory Roslyn preview**: no Apply, RenameProvider, WorkspaceEdit, filesystem mutation or automatic refresh. The extension validates the worker response, selected project path, existing token bytes, line/column, expected old and new spelling, unique location and partial-refusal contract. Open unsaved C# project documents cause a refusal. Each preview is stored under its **own FeatureSpace/source/symbol/newName virtual URI** with Markdown links and CodeLens to inspect original source positions. A Roslyn refusal displays diagnostics and zero proposed changes.

**Technical PASS** for corrected internally packaged candidate `artifacts/feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-fixed-candidate.vsix` — **20,489,453 bytes**, SHA-256 `23C01AC1CEFFE89DE9D2A38A5CEC17ED2494636F7D9E9BFB7EDA47409753B416`. Source unit tests **62/62 PASS**; 8.3a and 8.3c read-only Roslyn proofs PASS; installed real VS Code two-scope preview PASS (4 `Authenticate(string)` + 3 `AssertDenied(bool)` references, source CodeLens, refusal with zero edits). Installed normal profile hides test hooks; installed Restricted Mode denies Rename worker; same installed candidate retains P2/8.2 6-Situation/10-assertion-link regression PASS. Historical release/candidate SHA-256 preserved.

**Failed smoke history:** a first experimental candidate `p2-rename-preview-readonly-candidate.vsix`, SHA-256 `65420265212EE335093A08D5A1735D588DC96F1C2E71649DFD9A344BC0E384FA`, was not accepted because the test dispatcher mistakenly invoked the Configure test, not the preview route. The separate corrected candidate above completed installed smoke. Do not recommend the failed probe.

**Acceptance boundary:** ordinary-user manual acceptance is **PENDING**. We do not claim a safe multi-project Rename, editable diff, commit consent/rollback, cross-language usage or new public release. P2/8.3e general mutating Rename safety remains LATER; P1/7.4 export remains LATER.

## Packaging warnings not treated as local-alpha blockers

`vsce` still warns about a missing repository field and LICENSE file. These remain marketplace/publication metadata work; local VSIX packaging and installed acceptance succeed.

## MVP next-release stabilization and one batched manual acceptance — D-060

**Active process decision (2026-10-10):** stop asking the user to
install and manually click through every feature candidate. Stabilize
the existing alpha + accepted P1/P2 navigation/Usage View + experimental
**read-only** P2/8.3d Rename Preview as one bounded MVP. Keep 8.3d
ordinary-user acceptance **PENDING**, despite installed technical PASS
(D-059). Source developer tests, Roslyn proofs and isolated installed
VSIX acceptance remain required for every cumulative release candidate.

New single-source Windows CI specification:
`.github/workflows/windows-source-proof.yml` (Node + .NET source proofs;
not installed VS Code acceptance). Its GitHub-run status must be
verified separately; adding YAML alone does not confer CI PASS.

The final user session will be one 10–15 minute checklist covering
install, Configure/Refresh, Projection/Test Explorer, source links,
scoped Usage View, two read-only Rename previews and a fail-closed
name, with confirmation that no C# files changed. See
`docs/plan/MVP-RELEASE-GATE.md`. No release/version bump or actual Rename
application has been authorized. P1/7.4, P2/8.3e and P3–P6 remain LATER.

## Cumulative MVP single-VSIX installed acceptance — PASS (D-061)

Candidate: `artifacts/feature-projection-prototype-p0-0.1.0-mvp-batched-acceptance-candidate.vsix`
(20,490,576 bytes, SHA-256
`54D4B3D1F5C17B3657C91AA299A129B66D146A72178633221FBC2FB0A3D83A29`).
This is an **internal alpha candidate**, not an authorized public release.

**Installed technical acceptance PASS** with one installed candidate:
62/62 source unit tests; C# usages and read-only Rename Roslyn proof;
normal profile hidden-hook security; Configure/explicit Refresh;
responsibility/assertions scoped Usage View; 4+3 Rename Preview links
and refusal without edits; Restricted Mode with no worker spawn;
accounts/billing P2 cross-navigation (6 Situations, 10 assertion links).
Previous VSIX/ZIP checksums unchanged. The first final candidate run
exited only during report writing because Windows PowerShell 5.1 lacks
`Path.GetRelativePath`; repaired with a separate reporter that independently
verified all six saved installed results. Local JSON evidence is under
`artifacts/local-acceptance-results/` and ignored by Git.

Commands: `powershell -NoProfile -File scripts/verify-mvp-installed-aggregate.ps1`
for a fresh complete technical run; the script pins the final VSIX SHA.

**NEXT:** One combined ordinary-user manual checklist in
`docs/plan/MVP-RELEASE-GATE.md`; manual acceptance PENDING (D-060).
No actual Rename, public release, version bump, tag or Marketplace
publication has been made or authorized.

## D-062 — User-approved Rename Preview deferral (MVP scope change)

The combined manual acceptance surfaced an important user-facing UX
problem: after typing a proposed name the read-only Rename Preview
displayed correct source references but had no useful next step.
The user clicked the feature-test source link and then explicitly
approved **excluding Rename Preview from the imminent MVP**.

Current user-facing scope: Configure/explicit Refresh, Projection,
Testing API and source links, scoped Projection ↔ Test Explorer
navigation and read-only Registered C# Usages. **No public Rename
Preview command, activation event, RenameProvider or Apply action.**

The code-first Roslyn rename worker, strict read-only preview
normalization and internal source/installed proof tests remain for
later opt-in semantic Rename research. These are **test-only** and
not part of the ordinary user interaction.

Replacement internal VSIX:
`artifacts/feature-projection-prototype-p0-0.1.0-mvp-no-rename-preview-candidate.vsix`
size 20,490,605 bytes, SHA-256
`09E71D305560DD7E3ECCF7E161DA35FA6585D05992B4E9CE36AFD7B25FCB68A0`.
The earlier D-061 cumulative candidate remains preserved as
historical technical evidence but is superseded for release scope.

**Manual acceptance PENDING**: the user's screenshot/click confirm
only a particular research preview and source navigation, not
end-to-end MVP acceptance. The final checklist in
`docs/plan/MVP-RELEASE-GATE.md` has removed Rename Preview.
Do not release/tag/version-bump without the remaining manual
acceptance and explicit release authorization.

## D-063 — Internal normalized JSON feasibility (NOT a public export)

New `src/core/normalizedSnapshot.ts` is a pure internal transform
of `JoinedSituation`, unresolved parameterized `TestDefinition`
and `Diagnostic` evidence. Preserves FeatureScope + FeatureName +
Outcome + Situation, exact frontend/backend roles, expected behavior,
literal assertion source, navigation coordinates, source/diagnostics
and trusted/degraded state. Missing parts remain explicit `null`;
unresolved framework data is not fabricated as concrete Situations.
Sources are physically validated under one trusted workspace root,
represented as relative POSIX paths; duplicates/mismatched identities
and malformed coordinates fail closed. Output is deterministic,
does not mutate inputs and carries `experimental:true`, no public
schema version. Diagnostic messages are retained as text and may
still contain environment-specific paths: NOT safe to publish yet.

**Verification:** Node unit tests **68/68 PASS**; real Vitest+xUnit
snapshot proof **PASS** (3 Situations, 6 matching parts, 6 literal
assertions; reversed order produces identical JSON). Proof added to
Windows CI with explicit frontend/npm and backend/.NET prerequisites.
CI result requires independent GitHub confirmation after push.

**No user-visible change** to D-062 MVP: no new public command,
file write, stable JSON/export or Rename operation. The user's
tentative checklist feedback is not a release publication consent;
ordinary-user acceptance formalization and release go/no-go remain
separate. Future P1/7.4 public schema and privacy need a new decision.

## D-064 — Internal metadata-only disclosure draft (no public JSON export)

Added `src/core/exportDraft.ts`, a research-only in-memory JSON
disclosure draft built from the D-063 normalized snapshot.
It retains exact FeatureScope/Situation, role, trust, expected behavior,
structured diagnostic rule/severity/impact and source coordinates.
Raw `Diagnostic.message` and literal `Assertion.sourceCode` are omitted.
Missing parts are explicit null; unresolved cases are preserved.

Every draft has `publishable: false`, `requiresExplicitConsent: true`
and `containsUserAuthoredIdentifiers: true`. Counts of omitted
diagnostic messages and assertion snippets, unmatched parts,
unresolved definitions and blocking evidence are reported.
Paths are rechecked workspace-relative, source locations cloned,
and unknown serializer fields or attempted publication fail closed.

**Source validation:** `npm test` **73/73 PASS**; expanded real
`scripts/verify-experimental-json-snapshot.mjs` PASS on Vitest 5 +
xUnit v3 (3 Situations, 6 snippets withheld, deterministic ordering).
Windows CI runs the same proof; its post-commit status is recorded
separately. No installed VSIX validation is required for this
source-only, non-contributed research module.

**Privacy boundary:** Feature names, expected behavior and file names
can be sensitive even without literal assertions or diagnostic messages.
The draft is not a certificate that content is safe to share.
No new command, JSON file creation, clipboard/network export,
public schema/version, license or user data mutation exists.
The D-062 no-Rename MVP and its release/manual pending boundaries
remain unchanged. Public P1/7.4 export remains LATER.

## D-065 — P3 Portable Projection (single document, Markdown + HTML)

The user's existing localhost app will **serve** the Projection;
Feature Projection itself starts no server. A single detached internal
JSON-compatible `ProjectionDocument` (not D-064's redacted
disclosure/export draft) now feeds Markdown and standalone HTML.
The generated HTML shows exact Situation scope, Frontend/Backend,
expected behavior, literal assertions, and `vscode://file`
editor links. HTML is script-free, escape-safe and has a restrictive CSP.

Trusted, unblocked, non-stale Refresh automatically writes
`projection.html` to a stable workspace-specific folder under
extension storage, or optionally to an explicitly configured absolute
`featureProjection.portableHtmlDirectory` for a local static-asset
server. Writes are atomic; unrelated existing destination files are
not overwritten. Stale/Error/Restricted Mode does not publish a
replacement file. Browser reload is still needed; no live reload.
The public `Open HTML Projection` command opens the last fresh file.

Source: **79/79 tests PASS**; real Vitest/xUnit proof **PASS**
(3 Situations, 6 assertions, linked offline HTML and unchanged
Markdown semantics). P3 candidate VSIX is separate from D-062,
20,500,133 bytes, SHA256
`1E99142C54B9CD559EE883F371F1BB73ADBDC12A8D7F7F005B33B6C351B270C7`.

**Privacy:** HTML contains literal source code; localhost routes
should remain private and bound to loopback. This prototype does NOT
give a public JSON export, release approval, browser/iframe manual
acceptance or general mutating Rename support. D-065 and
`docs/plan/PORTABLE-PROJECTION-INTEGRATION.md` hold details.

## D-066 - D-065 final candidate and browser readiness correction

The first P3 VSIX cited in the historical D-065 section above was
superseded. **Only the final source-watch-fixed D-065 VSIX** is
recommended for any ordinary-user acceptance: 20,500,477 bytes,
SHA-256 `4468280CE13A55FFDAE69CA7F086F6FC68F9342DF9EC7C393692688AB4091380`.
Its installed Windows technical gate passed in an isolated profile.

D-066 preflight (2026-10-11): GitHub/Windows main equal and clean,
source 79/79 PASS, real Vitest/xUnit dual-view PASS. The actual user's
ordinary VS Code extension currently lacks the HTML command/renderer,
so D-065 ordinary browser/localhost/VS Code protocol acceptance
remains PENDING. One permissioned install and a single compact
browser gate are next; no release, new VSIX, source fixture mutation
or localhost server creation occurred. See REVIEW-LOG D-066 and
PORTABLE-PROJECTION-INTEGRATION.md.

### D-066 follow-up - ordinary Windows extension installed

After explicit user permission and repeat candidate integrity checks,
the final source-watch-fixed D-065 VSIX was installed using VS Code
CLI. Its contributed HTML command and compiled projection modules
match the VSIX; the old installation was backed up in ignored local
artifacts (see REVIEW-LOG). Ordinary **on-disk install VERIFIED**,
but Reload Window and browser/manual PASS remain PENDING.
Own-app localhost integration was explicitly postponed. No release.

## D-067 - P3 Refresh measurement without caching

A source-only performance observation step after D-066.
The optional full-engine phase profiler reports validate,
Vitest/xUnit static and materialization/build, expand, join,
render. The regular explicitly invoked Refresh now reports local
durations to the existing Feature Projection output channel.
No automatic workers, cache, new external server or source edits.

Windows source tests **81/81 PASS**, real two-round benchmark PASS
(3 Situations, identical evidence, no blocking diagnostics).
A follow-up guarded benchmark verified source-input hashes unchanged.
Real D-063/D-064/D-065 JSON/Markdown/HTML proof still PASS.
See MASTER-PLAN section 24 and REVIEW-LOG D-067.
The existing ordinary D-065 installation was **not** replaced.
User browser acceptance remains PENDING; own-app localhost
integration is deferred. No new VSIX/release.

## D-068 - Known-input drift and invalidation probe (source-only)

Source-only D-068 adds a conservative content-hash observer for
configured FeatureSpace project/source input trees and effective
configuration. It detects known file changes, refuses unknown
or dirty editors, links and escapes, and always returns
`reusePermitted:false`. Excluded dependencies and generated
trees remain outside its observed coverage. No cache is enabled.
Windows `npm test` **89/89 PASS**; the real two-scope input
probe and prior D-063/D-064/D-065 fixture proofs **PASS**.
GitHub Windows CI includes the new proof step, with post-push
status tracked in REVIEW-LOG.

Existing ordinary D-065 installation unchanged; D-066 manual
standalone browser check still PENDING. Own localhost application
integration DEFERRED; no release or new VSIX.
