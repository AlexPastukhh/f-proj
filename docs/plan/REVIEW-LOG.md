# Feature Projection — Review Log

Append-only review history. Confirmed problems, uncertainties, and deferred items are intentionally separated.

## 2026-10-05 — Independent review of 6.2 Configure UX preparation

### Object and scope

Reviewed object: the preparation for the next roadmap unit `6.2 Configure UX` in working copy `feature-projection-prototype-p0-0.0.13-configure-ux`, including the proposed implementation slice, the claimed clean baseline, and the relevant current plan/config/runtime boundaries. This is a review of preparation/readiness, not of a completed Configure implementation (none exists yet).

Reconstructed goal: add `Feature Projection: Configure` so a user can create/update FeatureSpace/source workspace settings without manually authoring the full settings object, validate configuration immediately, preserve explicit root/framework-project semantics, and never auto-run framework materialization. Verification must remain consistent with real Windows/VS Code acceptance policy.

### Review result

The preparation is directionally correct and the baseline is clean, but it is not yet implementation-ready without several corrections. The most important missing items are source-id handling, true clean acceptance isolation, and an explicit safe multi-root policy. The optional Vitest config-file gap is real and independently reproduced.

### Confirmed problems

1. **Active Master Plan contains stale contradictory status.**
   - `6.1` is marked DONE and D-022 resolves packaged .NET worker strategy, but `MASTER-PLAN.md` still says in current limitations that the VSIX .NET worker packaging strategy is not fixed, still lists it as blocking packaging work, and section 16 still names packaging as `NEXT-1`.
   - Impact: planning/documentation only, but it can send later work back to an already-closed unit and conflicts with the stated source-of-truth role of MASTER-PLAN.

2. **6.2 workflow omits required `FeatureSource.id`.**
   - Current `FeatureSourceConfig` requires `id`; validation emits `feature-projection/missing-source-id`; original v11 P0 configuration scope explicitly includes `FeatureSource id`.
   - Current 6.2 flow asks for FeatureSpace, role, root, adapter, framework project and adapter-specific files, but does not define how source id is supplied or generated.
   - Failure scenario: new source is persisted without id -> immediate blocking validation; implicit role-based id generation can collide when a FeatureSpace has multiple same-role sources.
   - Impact: blocks core 6.2 acceptance unless a source-id policy is added.

3. **Vitest `configFile` is required by the plan but is not end-to-end in the current model/adapter.**
   - `workers/vitest-materialize.mjs` consumes `input.configFile`.
   - `FeatureSourceConfig` has no `configFile` and `materializeVitest` does not send it.
   - Independent capture-worker repro with a runtime source object containing `configFile:'vitest.custom.ts'` observed worker input `configFile=undefined`.
   - Preparation correctly noticed the type/pass-through gap, but also needs config-file path semantics and validation; otherwise an invalid config file can pass structural validation and fail only during materialization.
   - Impact: directly affects one explicit 6.2 field/acceptance path.

4. **The multi-root suggestion is incomplete: choosing a workspace folder alone is not safe with the current engine.**
   - Current extension uses `workspaceFolders?.[0]` for relevance checks, watcher roots, and Refresh workspaceRoot.
   - Failure scenario: multi-root workspace `[A,B]`; Configure stores paths relative to B; Refresh still resolves them against A -> missing/wrong roots and false blocking diagnostics or wrong target.
   - For 0.0.13, either explicitly reject multi-root with an actionable message, or perform a broader folder-aware engine/config refactor. Merely adding a folder picker is insufficient.
   - Impact: conditional on multi-root workspaces; single-root path is unaffected.

5. **Current fixture cannot prove Configure-from-empty unless acceptance is isolated.**
   - `fixtures/workspace/.vscode/settings.json` already contains the complete valid Feature Projection configuration.
   - Failure scenario: Configure command is a no-op or fails to persist; subsequent Refresh still succeeds using pre-existing fixture settings -> false green acceptance.
   - Current installed-VSIX script opens the fixture directly, so a real Configure write would also mutate the checked-in fixture.
   - Required acceptance setup: use a temporary workspace copy with Feature Projection settings removed/empty, execute Configure, assert persisted settings explicitly, then Refresh.
   - Impact: verification integrity; without this, 6.2/6.3 can be falsely declared DONE.

6. **The proposed lifecycle should not literally duplicate stale/watcher handling.**
   - Existing `onDidChangeConfiguration('featureProjection')` already rebuilds watchers and calls `markStale` after a workspace-setting update.
   - Proposed step `rebuild watchers + mark Stale` inside Configure would duplicate that behavior.
   - Also, persisting an invalid draft before validation can trigger a Refresh prompt from `markStale` before validation reports the error.
   - Safer transaction: build draft -> validate without workers -> persist once if acceptable -> re-read/revalidate -> rely on configuration-change handler for watcher rebuild/Stale.
   - Impact: local UX/control-flow correctness, not semantic engine correctness.

7. **Automated verification strategy for interactive prompts is not yet defined.**
   - Verification policy requires real host/installed-VSIX evidence for VS Code UI changes.
   - Current smoke can execute commands but has no mechanism to answer QuickPick/InputBox/OpenDialog interactively.
   - Before implementation, Configure logic should be split so prompt orchestration is testable with an injected/mock prompt layer or the command has a deterministic test-only input path that still exercises the same merge/validate/persist transaction. Installed smoke should assert the written settings.
   - Impact: without this, 6.2 may work manually but cannot satisfy the existing deterministic acceptance policy.

### Uncertain / disputed items

- Full multi-root support is not an explicit current 6.2 requirement. Safe recommendation for 0.0.13 is an explicit single-root guard rather than expanding scope.
- Plan does not define whether one Configure invocation creates one source, edits an existing source, or loops to configure multiple sources. This needs a stable UX rule before coding.
- Exact persistence base for optional Vitest `configFile` is not stated in the current plan. Recommended convention is relative to `frameworkProject`, mirroring xUnit `projectFile`.
- Immediate validation should be defined as structural/filesystem validation only; framework execution remains explicit Refresh. Runtime prerequisite checks, if any, should not execute project code.

### Checks that passed

- Working copy source (excluding generated/runtime outputs) hashes identically to `0.0.12-vsix-packaging`: `NO SOURCE DIFFS`.
- Independent `npm test` rerun: 25/25 PASS.
- Independent `verify-real-p0.ps1` rerun: real Vitest 3/3, backend xUnit 3/3, two xUnit materialized Situations, final `REAL P0 CHECK PASSED`.
- `6.2 Configure UX` is correctly identified as the next substantive roadmap unit.
- Extracting reusable config validation from `fullEngine.ts` is justified: current validator is internal to the full run, while Configure needs validation without triggering runtime materialization.
- Keeping source root and framework project target distinct is consistent with D-007/v11.
- Configure must not auto-Refresh; config change -> Stale -> explicit Refresh remains correct.
- The preparation correctly detected the missing Vitest `configFile` model/adapter bridge.

### Deferred / Follow-up Items

1. **Strengthen `featureProjection.featureSpaces` contribution schema.**
   - Why deferred: Configure can validate/write correct settings without a rich JSON schema.
   - Related goal: manual settings editing remains supported.
   - Trigger: after Configure flow is stable / before public-facing 0.1 release polish.
   - Risk if ignored then: weak IntelliSense/schema feedback for manual editors.

2. **Version/artifact bump to 0.0.13.**
   - Why deferred: not needed to design or unit-test Configure internals.
   - Related goal: installed-VSIX acceptance and unambiguous artifact identity.
   - Trigger: before packaging/installing the Configure build.
   - Risk if ignored then: smoke can load/reinstall a same-version 0.0.12 artifact and make provenance ambiguous.

3. **Full multi-root support.**
   - Why deferred: not required for the current single-root 0.1 path if explicitly guarded.
   - Related goal: broader ordinary-workspace support.
   - Trigger: product decision to support multi-root workspaces / second-workspace expansion.
   - Risk if ignored after that trigger: wrong root resolution because current engine is first-folder based.

4. **External configured paths vs Workspace Trust boundary.**
   - Why deferred: current 6.2 can avoid broadening this by preferring/limiting chooser paths to the selected workspace; no policy change is required to implement single-root fixture Configure.
   - Related goal: trusted explicit runtime materialization.
   - Trigger: support for roots/projects outside workspace or security-hardening phase.
   - Risk if ignored then: a trusted workspace may direct framework execution at project code outside the trusted workspace tree.

### Verification limitations

- No Configure implementation exists yet, so no actual wizard interaction, settings update, cancellation behavior, or installed-VSIX Configure smoke could be executed.
- Multi-root failure was verified from current first-folder code paths, not by launching a dedicated multi-root Extension Host fixture.
- Interactive-prompt automation approach is a design requirement identified from the current smoke harness; it has not yet been implemented/proven.

### Open questions for implementation

- For 0.0.13, should multi-root be explicitly unsupported with a clear message? Recommended: yes, to avoid hidden first-folder behavior.
- Should source id be user-entered with a suggested default, or generated under a defined uniqueness policy? Recommended: explicit input/default + uniqueness validation.
- Should Configure edit/add one source per invocation or offer an `Add another source` loop? Either can satisfy the fixture, but it must be explicit and testable.
- Should blocking draft validation prevent persistence? Recommended: yes; then revalidate persisted settings after the single atomic update.


## 2026-10-05 — Follow-up remediation after 6.2 preparation review

### Scope

Applied the corrections identified by the immediately preceding independent review. This is still preparation for 6.2, not completion of the Configure command/UI.

### Confirmed fixes applied

1. `MASTER-PLAN.md` stale 6.1/package-status contradictions were removed: 6.1 remains DONE, packaging strategy is recorded as resolved by D-022, and immediate execution now starts with Configure UX.
2. 6.2 now explicitly requires a unique/confirmed `FeatureSource.id` and records the single-root-only policy for 0.0.13.
3. Shared non-runtime configuration validation was extracted to `src/core/configValidation.ts`; `fullEngine.ts` now consumes the same validator Configure will use.
4. Optional Vitest `configFile` is now part of `FeatureSourceConfig`, is resolved relative to `frameworkProject`, is filesystem-validated, and is forwarded to the Vitest worker as a resolved path.
5. Configure transaction semantics are now explicit: build draft -> validate without framework execution -> do not persist blocking draft -> one settings update -> re-read/revalidate -> existing configuration-change handler owns watcher rebuild/Stale.
6. Acceptance now explicitly requires a temporary fixture copy with pre-existing Feature Projection settings removed, persisted settings assertions before Refresh, and the same transaction path for deterministic test input.
7. Decisions D-023 through D-027 record the single-root policy, source-id policy, configFile semantics, validate-before-persist transaction, and clean Configure acceptance setup.

### Verification after remediation

- `npm test`: 28/28 PASS (previous 25 tests plus source-id/configFile validation and configFile forwarding regressions).
- `verify-real-p0.ps1`: PASS; real Vitest 3/3, real backend xUnit 3/3, two xUnit materialized Situations, three joined Situations.
- Additional real E2E check with a temporary config containing `configFile: "vitest.config.ts"`: PASS with the same three joined Situations and exit 0.

### Remaining work / not yet claimed fixed

- `Feature Projection: Configure` command and prompt UI do not exist yet.
- Multi-root is not implemented; 0.0.13 must reject it explicitly when Configure is implemented.
- The deterministic prompt/test seam and temporary-workspace installed-VSIX Configure smoke are specified but not implemented yet.
- Package/artifact version remains 0.0.12 until the Configure build is ready for packaging; bump to 0.0.13 remains a pre-packaging follow-up.

### Review status after remediation

The preparation is now implementation-ready for the agreed single-root 6.2 scope. No remaining confirmed preparation defect blocks starting the Configure implementation. The remaining items above are implementation tasks or deferred acceptance/package work, not unresolved preparation contradictions.


## 2026-10-05 — 6.2 Configure UX implementation and acceptance

### Object and scope

Implemented and verified roadmap unit 6.2 in `0.0.13-configure-ux`: public Configure command, shared merge/validate/persist transaction, clean-workspace host acceptance, optional Vitest configFile wiring, single-root guard, and installed-VSIX proof. This entry does not claim completion of the remaining 6.3 installed source-navigation or untrusted-workspace assertions.

### Result

6.2 is accepted as DONE. No known blocking Configure defect remains in the exercised single-root scope.

### Confirmed issues found during implementation and resolved

1. A host test initially checked command registration before explicitly activating the development extension. The harness was corrected to activate the extension before asserting commands; this was a test-order issue, not a product command-registration defect.
2. A whole-directory junction smoke workspace exposed real Vitest correlation failure between junction-visible static source paths and realpath module IDs. Runtime correlation now canonicalizes existing paths; dedicated symlink/junction regression passes.
3. A cold installed Roslyn analysis hit the old 15000 ms default exactly and produced a blocking timeout. Product default is now 30000 ms, clean acceptance no longer overrides it, and the subsequent installed run passed.

### Acceptance evidence

```text
npm test                                      32/32 PASS
real P0 after Configure changes               PASS
real Windows Extension Host Configure smoke   PASS
installed VSIX 0.0.13 identity                PASS
empty settings -> invalid draft no persist    PASS
frontend + backend Configure persistence      PASS
Configure leaves Stale / no auto Refresh      PASS
explicit Refresh: Vitest cases                2
explicit Refresh: xUnit cases                 2
joined Situations                             3
blocking diagnostics                          0
Fresh -> external edit -> Stale               PASS
installed VSIX Configure smoke                PASS
```

### Uncertainties / limitations

- Automated acceptance does not mechanically interact with QuickPick/InputBox/OpenDialog. Public command registration is verified and the deterministic seam invokes the exact same merge/validate/persist transaction as the UI flow, but widget-by-widget human interaction is not robotically exercised.
- Full multi-root workspace support remains intentionally outside 0.0.13; Configure rejects that scope instead of guessing.

### Deferred / Follow-up Items

- Rich JSON schema/IntelliSense for manual `featureProjection.featureSpaces` editing remains lower priority until configuration UX stabilizes. Trigger: public 0.1 polish.
- Editing one source while another manually-authored source is already invalid may be blocked by whole-config validation. This is acceptable for current clean/single-root Configure acceptance; revisit if real workspace hardening shows users need incremental repair of multiple invalid entries.
- Full multi-root support remains deferred. Trigger: explicit multi-root product work; then configuration identity, watchers, Refresh root selection, and acceptance must become folder-aware together.

### Next roadmap unit

Finish 6.3 installed-extension acceptance by adding explicit installed frontend/backend source-navigation assertions and an installed untrusted-workspace materialization assertion.

## 2026-10-05 — Post-0.0.13 roadmap reassessment

### Object and scope

Reassessed the active roadmap after closing 6.2 Configure UX. Scope: whether the execution order, 6.3/6.4 acceptance, release gate, and deferred items still match the implementation evidence in 0.0.13. No runtime code was changed in this planning pass.

### Confirmed current problems that changed the near-term plan

1. **Untrusted C# analysis boundary is weaker than the stated trust contract.**
   - Current xUnit flow starts the .NET Roslyn worker and opens the configured project through MSBuild before the trust gate that protects build/materialization.
   - Requirement -> gap -> consequence: untrusted workspace must not execute/evaluate project-backed framework paths -> Roslyn/MSBuild worker can start first -> Restricted Mode may do more than safe source-only analysis.
   - Plan impact: 6.3 is split so trust-boundary hardening is the next unit; installed acceptance must prove that no project-evaluating/runtime worker starts in untrusted mode.

2. **`buildTimeoutMs` is currently a public-but-ignored xUnit build setting.**
   - The setting is read by the extension and documented for trusted xUnit project builds, but `fullEngine.ts` derives that timeout from `workerTimeoutMs`.
   - Plan impact: explicit 0.1 release-gate fix, not deferred cleanup.

### Plan corrections adopted

- 6.3a now covers trust-boundary hardening first; 6.3b then closes installed source-navigation acceptance.
- 6.4 second-workspace acceptance now starts from empty settings, configures through Configure, uses at least two FeatureSpaces, repeats identical semantic names across them, and proves there is no cross-scope join.
- Added 6.5 explicit 0.1.0 release gate: buildTimeoutMs semantics, hidden test-hook gating, actionable Node/.NET prerequisite diagnostics, one real manual Configure click-through, and release-scope statement.
- 0.1.0 is explicitly Windows-first alpha; cross-platform installed acceptance remains later hardening.
- Projection-safety matrix and responsibility-registration proof stay after the usable-extension/release gate rather than being pulled forward.

### What did not change

Core semantic contract, explicit Refresh policy, single-root 0.0.13 decision, publish-only Testing API policy, and the ordering of later navigation/cache/run-profile/additional-adapter phases remain valid.

### Deferred / Follow-up Items retained

- Full multi-root support remains deferred until explicit product work makes configuration identity, watchers, Refresh root selection, and acceptance folder-aware together.
- Rich JSON schema/IntelliSense remains release-polish work after the Configure model stabilizes.
- Duplicate watcher stale notifications are low priority; revisit during incremental/watcher hardening if they become user-visible noise or interfere with cache invalidation.
- Cross-platform installed acceptance is deferred after the Windows-first 0.1 alpha; trigger is a decision to advertise/support Linux/macOS release targets.

### Open questions

No blocking product-design question was introduced by this reassessment. The next executable unit is 6.3a trust-boundary hardening.

## 2026-10-05 — 6.3a trust-boundary implementation and installed acceptance

### Object and scope

Implemented roadmap unit 6.3a in `0.0.14-trust-boundary`: move all project-evaluating/runtime work behind Workspace Trust and prove the boundary in a real installed VSIX Restricted Mode session. Source-navigation acceptance is explicitly out of scope and remains 6.3b.

### Confirmed problems found during the work

1. **0.0.13 C# trust boundary was too late.** The xUnit path could start the .NET worker and open the project through Roslyn/MSBuild before the trust check. This was fixed by gating the whole xUnit project-backed branch before worker/bootstrap/analysis.
2. **Installed VSIX had an undeclared runtime dependency on TypeScript.** Removing the development checkout's `node_modules` caused installed activation to fail with `Cannot find module 'typescript'`. The old smoke layout had masked this because its extension directory was nested below the source checkout. This was fixed by packaging `typescript@5.8.3` as the only production Node dependency and moving installed acceptance outside source ancestry.

### Acceptance evidence

```text
npm test                                      33/33 PASS
verify-real-p0.ps1                            PASS
real Vitest                                   3/3 PASS
real backend xUnit                            3/3 PASS
xUnit materialized concrete cases             2 PASS
real trusted joined Situations                 3 PASS
VSIX packaged TypeScript runtime               PASS
trusted installed Configure + Refresh          PASS
installed Restricted Mode trusted=false        PASS
missing external Node tolerated untrusted      PASS
missing packaged .NET worker tolerated         PASS
no project/runtime worker spawn in logs        PASS
explicit partial/unresolved diagnostics        PASS
```

### Verification notes / limitations

Two earlier development-host attempts were invalidated by machine resource pressure (Windows commitment limit / unresponsive VS Code) before useful product assertions completed. They are not counted as failures or passes. The final stage-relevant installed-VSIX acceptance completed successfully in isolated profiles and is the authoritative evidence for 6.3a.

The Restricted Mode projection currently uses `uiState=error` because blocking diagnostics intentionally mark missing runtime/project-backed evidence. This is acceptable for the current truthfulness contract; any future dedicated "Restricted/Partial" UI state would be a UX enhancement, not required for 6.3a.

### Deferred / Follow-up Items

- Consider bundling TypeScript into extension output later if package size/startup or dependency-management pressure justifies it. Current explicit production dependency is correct and self-contained; revisit during packaging/performance hardening.
- Duplicate watcher stale events remain low priority and should be revisited during incremental/watcher work if they affect UX or invalidation behavior.
- Cross-platform installed acceptance remains deferred after the Windows-first alpha decision.

### Next roadmap unit

6.3b: prove installed Frontend/Backend source navigation from the current semantic tree without changing projection semantics.


## 2026-10-05 — 6.3b navigation scope refinement before implementation

### Object and scope

Reviewed the next roadmap unit after manual inspection of the installed 0.0.14 projection. Scope: whether existing editor CodeLens navigation is sufficient for the primary projection surface and what installed acceptance must prove before 6.3 can be closed.

### Confirmed problem

Current projection navigation is attached through editor CodeLens to plain `Frontend` / `Backend` text. VS Code Markdown Preview does not render CodeLens, so opening the projection as a Markdown preview removes the primary source-navigation affordance. The current indentation also makes parts of the projection look more like a technical text dump than a deliberate Markdown document.

Causal chain:

```text
primary product surface = projection document
current navigation carrier = editor CodeLens only
Markdown Preview omits CodeLens
-> preview can remain readable but loses source navigation
```

This is a real UX/acceptance gap, not a semantic-engine defect.

### Plan correction adopted

6.3b now requires installed navigation proof across three surfaces:

```text
projection editor
Markdown Preview
Testing API / Test Explorer
```

Frontend and Backend must become genuine clickable source links in Markdown Preview and must resolve to workspace test sources at the expected definition/range. Installed-extension files are never valid source-navigation targets.

### Preserved constraints

- No change to `Feature -> Outcome -> Situation -> Frontend/Backend` semantics.
- Expected Behavior and assertions remain source-derived; assertion text stays literal.
- Parameterized Situation navigation remains definition-level in 6.3b. Exact concrete row/case navigation remains P2.
- CodeLens may remain as an additional editor affordance, but not as the only navigation mechanism.

### Next executable unit

Implement and verify 6.3b in working copy `0.0.15-navigation`: Markdown-native source links + installed Frontend/Backend navigation acceptance + Testing API source URI/range assertions.

## 2026-10-05 — 6.3b navigation implementation and automated acceptance

### Object and scope

Implemented the 6.3b navigation slice in working copy `0.0.15-navigation`: Markdown-native Frontend/Backend source links, improved Markdown structure without semantic rewriting, retained editor CodeLens actions, and stronger real host/installed-VSIX navigation assertions.

### Result

Implementation and automated acceptance are green. 6.3b is not yet marked DONE because one intentionally manual acceptance remains: click a Frontend and a Backend link from actual VS Code Markdown Preview and confirm the expected workspace source/range opens.

### Confirmed implementation behavior

```text
Frontend/Backend headings include source filename + line
installed projection emits native vscode://file source hrefs
all six joined parts have workspace source targets
editor openSource opens exact Frontend/Backend file and expected line
Testing API carries workspace source URI/range for all six part nodes
parameterized Situations remain definition-level navigation
assertion snippets remain literal source text
CodeLens remains an additional editor affordance
```

### Verification evidence

```text
npm test                                      34/34 PASS
verify-real-p0.ps1                            PASS
real Vitest                                   3/3 PASS
real backend xUnit                            3/3 PASS
real xUnit materialization                    2 cases PASS
real E2E projection                           3 Situations PASS
real Windows Extension Host smoke             PASS
installed VSIX 0.0.15 identity/path           PASS
installed Configure + Refresh                 PASS
installed source actions                      6/6 PASS
installed Frontend/Backend editor navigation  PASS
installed Testing API source nodes            6/6 PASS
installed Markdown vscode://file hrefs        6/6 PASS
installed Restricted Mode regression          PASS
```

### Non-product test issue resolved

The first dev-host navigation assertion incorrectly rejected workspace files merely because the temporary dev-host workspace was physically below the development extension checkout. That condition is valid only for installed-VSIX acceptance. The guard now applies the extension-tree exclusion only when `FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT` is set; installed acceptance still proves navigation never targets installed extension files.

### Remaining acceptance

Open installed `0.0.15` projection in Markdown Preview, click at least one Frontend and one Backend source link, and confirm each opens the expected workspace test definition/range. After that, 6.3b and overall 6.3 can be marked DONE and execution moves to 6.4 second-workspace / FeatureScope isolation.

## 2026-10-05 — 6.3b manual Markdown Preview closeout

### Object and scope

Closed the final manual acceptance item for `0.0.15-navigation`: installed-VSIX Markdown Preview source navigation. No semantic or runtime code changed in this closeout.

### Result

Both required manual links passed from actual VS Code Markdown Preview:

```text
Frontend link -> expected workspace frontend test definition/range  PASS
Backend link  -> expected workspace backend test definition/range   PASS
```

This completes D-039 acceptance, roadmap unit 6.3b, and overall installed-extension acceptance unit 6.3.

### Preserved limitations

Parameterized Situation navigation remains definition-level; exact row/case navigation stays deferred under D-019/P2. No claim is made that Markdown Preview is a separate semantic engine; it is only another navigation rendering of the same projection.

### Next roadmap unit

6.4 second-workspace acceptance: materially different layout, configuration from empty settings, at least two FeatureSpaces, repeated identical Feature + Outcome + Situation names across FeatureSpaces, explicit unmatched parts, at least one parameterized feature, and proof that `FeatureScope = FeatureSpaceId + logicalFolderKey` prevents cross-scope joins.


## 2026-10-05 — 6.4 second-workspace FeatureScope isolation and correlation fix

### Object and scope

Reviewed and executed roadmap unit 6.4 in `0.0.16-scope-isolation`: a second executable workspace with materially different layout, two FeatureSpaces, repeated canonical semantic names, explicit unmatched evidence, parameterized Vitest/xUnit tests, configuration from empty settings, real engine execution, and installed-VSIX acceptance.

### Confirmed product defect found

The first real second-workspace engine run emitted four `feature-test/unique-situation` diagnostics even though the rendered FeatureSpaces were visually separated correctly.

Causal chain:

```text
accounts Vitest project -> parameterized definition key spec/feature-tests/shared/access.feature.test.ts:11:1
billing Vitest project  -> same parameterized definition key
expandDefinitions refKey = adapterId + frameworkDefinitionKey
-> accounts and billing concrete cases share one correlation bucket
-> each TestDefinition receives both projects' expired/locked cases
-> duplicate Situation diagnostics appear before join
```

The semantic `joinParts()` key already contained FeatureSpace and was not the failing component. The defect was framework concrete-case correlation identity before join.

### Fix

`TestDefinitionRef` now carries `frameworkProject`, and framework case correlation uses:

```text
adapterId + canonical frameworkProject + frameworkDefinitionKey
```

Vitest static definitions and xUnit analysis/materialization propagate the same project identity. Feature semantics are unchanged; physical/framework project identity is used only to correlate framework evidence to the correct TestDefinition.

### Acceptance evidence

```text
new collision regression before fix                 FAIL as expected (34 PASS / 1 FAIL)
new collision regression after fix                  35/35 PASS
account frontend Vitest                             3/3 PASS
billing frontend Vitest                             2/2 PASS
account backend xUnit                               2/2 PASS
billing backend xUnit                               3/3 PASS
second-workspace real engine                        definitions=6 cases=8 parts=10 joined=6 diagnostics=0
installed 0.0.16 settings start empty               PASS
four shared Configure transactions                  PASS
FeatureSpaces accounts + billing                    PASS
identical access/denied/expired+locked isolation    PASS
accounts orphan Frontend-only                       PASS
billing orphan Backend-only                         PASS
Testing API unmatched nodes                         exactly 2 PASS
installed second-workspace state                    Fresh PASS
primary real P0 regression                          PASS
installed Configure/navigation regression           PASS
installed Restricted Mode regression                PASS
```

### Non-product / invalid failures not counted

- One attempted real-engine run never started because output was redirected to a not-yet-created `artifacts` directory. The directory was created and the identical product run was repeated; only the repeated run counts.
- Early ad-hoc second-project `dotnet test` invocations used a CLI/runner context that hit .NET 10 Microsoft.Testing.Platform/VSTest syntax errors. The executable projects were then run from the repository context using the proven runner configuration: account 2/2 and billing 3/3. The earlier CLI mismatch is not classified as a Feature Projection defect.

### Deferred / follow-up items

6.5 release-gate items remain unchanged and are now the immediate next work: `buildTimeoutMs` semantics, test-only hidden command gating, actionable Node/.NET prerequisite diagnostics, packaging/dependency-isolation regression, release-scope documentation, and one final manual install/configure/refresh inspection.

### Result

6.4 is DONE in 0.0.16. D-032 is accepted by installed evidence, and D-040 records the correlation identity correction exposed by the second workspace.


## 2026-10-06 — 6.5 automated release-gate implementation

### Object and scope

Implemented the automated part of the 0.1.0 Windows-first release gate in `0.1.0-release-gate`. Scope: public build timeout semantics, test-only hidden automation hooks, actionable Node/.NET prerequisite diagnostics, installed dependency isolation, and full regression of the previously accepted primary and second workspaces.

### Confirmed pre-existing gaps and fixes

1. `buildTimeoutMs` was read from settings but ignored by trusted xUnit project builds; the engine derived build timeout from `workerTimeoutMs`. The engine now consumes `config.buildTimeoutMs` directly.
2. Hidden `__configureTest` and `__debugState` commands were registered in normal installed sessions. They now register only when `FEATURE_PROJECTION_TEST_MODE=1`; a normal installed-VSIX smoke proves both are absent.
3. Missing Node previously degraded to a generic spawn/materialization failure. Explicitly configured missing `nodePath` remains authoritative so Refresh can emit `worker/node-runtime-missing` with installation/PATH/nodePath guidance.
4. Missing or incompatible .NET project analysis previously surfaced as a generic C# analysis failure. Runtime output is now classified as `worker/dotnet-prerequisite-unavailable` with SDK/runtime/PATH guidance.

### Acceptance evidence

```text
Node/core regression suite                         40/40 PASS
real primary Vitest                                3/3 PASS
real primary backend xUnit                         3/3 PASS
real xUnit concrete materialization                2 cases PASS
real primary E2E                                   3 Situations PASS
installed second workspace                         2 FeatureSpaces / 6 Situations / Fresh PASS
normal installed session hidden hooks              absent PASS
trusted installed Configure/Refresh/navigation     PASS
trusted installed missing Node diagnostic          PASS
trusted installed incompatible .NET diagnostic     PASS
installed Restricted Mode                          PASS
VSIX outside source-checkout ancestry               PASS
only declared production Node dependency packaged  TypeScript PASS
```

### Deferred / remaining

The release gate is not yet DONE. One deliberate manual acceptance remains in an ordinary user VS Code session: install the 0.1.0 VSIX, Configure frontend and backend from a clean prepared workspace, run explicit Refresh, inspect the projection, and exercise source navigation. Marketplace repository/LICENSE metadata remains publication work and is not claimed solved by the local Windows-first alpha gate.


## 2026-10-10 — 0.1.0 ordinary-user manual release acceptance

### Object and scope

Final manual gate for roadmap unit 6.5 using the packaged `0.1.0` VSIX in the user's ordinary VS Code session and the prepared clean workspace `feature-projection-manual-release-0.1.0`.

### Acceptance evidence

```text
VSIX installed in ordinary user VS Code                  PASS
prepared workspace opened and trusted                    PASS
first Configure -> FeatureSpace app / 1 source           PASS
second Configure -> FeatureSpace app / 2 sources         PASS
status after Configure -> Feature Projection: Stale      PASS
explicit Refresh                                         PASS
projection works                                         PASS
source navigation works                                  PASS
```

### Result

6.5 is DONE. Together with the automated release evidence recorded on 2026-10-06, this accepts `0.1.0` as the Windows-first alpha. Cross-platform acceptance and marketplace publication metadata remain outside this gate.


## 2026-10-10 — P1/7.1 projection-safety fixture matrix and duplicate-identity review

### Reconstructed goal / requirements

Complete the 11 high-value safety fixtures in Master Plan 7.1. Each must check rule/category/severity/projectionImpact and prevent a false complete projection; preserve FeatureScope = FeatureSpaceId + logicalFolderKey and exact FeatureName + Outcome + Situation matching. Do not alter the accepted 0.1.0 release artifacts.

### Confirmed real problems and causal chain

1. **False duplicate:** `expandDefinitions` deduplication keyed FeatureSpaceId + logicalFolderKey + PartRole + Situation but omitted FeatureName/Outcome. Distinct outcomes/features with the same Situation produced `feature-test/unique-situation` and lost valid evidence. A new regression test reproduced two false diagnostics.
2. **First-wins ambiguity:** two truly identical scoped parts produced one blocking diagnostic yet kept an arbitrary first trusted part. A strengthened existing test reproduced parts=1 when safety requires parts=0.

Fix: use full semantic key including FeatureName/Outcome, track ambiguous keys and remove/suppress every conflicting part. No semantic join expansion or framework-correlation changes.

### Passed

- Explicit source/worker fixtures now cover malformed canonical name; missing/non-canonical parameterized Situation; duplicate Situation; unresolved TestDefinition correlation; direct if/else; unsupported top-level control flow; wrong FeatureScope; no recognized assertions; worker timeout; partial worker failure.
- Rule/category/severity/impact and projection outcomes checked; wrong FeatureScope intentionally has no rule because independent parts remain unmatched, never joined.
- Red regression before fix: 2 failing assertions; green afterward: `npm test` 48/48 PASS.
- Primary real Vitest + xUnit E2E: three frontend/backend joined Situations; `npm run demo:real` exit 0.
- ZIP baseline comparison: six changed files before this documentation update (one source TypeScript, compiled JS and four tests), zero missing; released ZIP and VSIX SHA-256 unchanged.

### Uncertain / genuine questions

Whether unmatched parts across intentionally different FeatureScopes should also receive an informational diagnostic is a product-UX question, not evidence of a broken join. No diagnostic is currently required by the exact identity contract.

### Deferred / follow-up

New installed-VSIX acceptance of the post-release P1 build has not been run; do not treat the old accepted 0.1.0 VSIX as including this fix. Cross-platform execution and broader failure permutations remain later evidence. Next: 7.2 Registered Responsibility Proof; then 7.3 custom assertion helper registration.

### Result

7.1 DONE for the listed safety fixture matrix in the Windows working checkout; 0.1.0 historical release acceptance remains independent.


## 2026-10-10 — P1/7.2 registered-responsibility Roslyn proof

### Reconstructed goal

Prove the retained v11 chain: C# code-first `RegisterResponsibility(User.Authenticate)` -> semantic method identity -> matched verification -> literal verification source projected. Unregistered technical/mock verifications must not be guessed into evidence, and accepted 0.1.0 release artifacts must remain untouched.

### Independent checks / passed

- Read original `05-assertion-model.md`, `07-code-first-configuration.md`, and `13-golden-examples.md` directly from the preserved v11 planning ZIP on Windows.
- Added isolated real xUnit v3 + Moq fixture, without changing the original E2E fixture. `FeatureProjectionConfig` implements compile-time prototype contracts and registers `User.Authenticate(string)` in source. Configuration is not executed.
- Roslyn registration is restricted to a configuration class implementing `FeatureProjection.IFeatureProjectionConfiguration` and an `IFeatureProjectionBuilder.RegisterResponsibility` symbol; verification must be a Moq `Verify` with a lambda bound to precisely the registered `IMethodSymbol.OriginalDefinition`.
- Real worker produced one definition, zero diagnostics, one literal `user.Verify(x => x.Authenticate("invalid"), Times.Once);` (kind=responsibility), and `Assert.True(true);` (kind=assertion). It excluded `logger.Verify` and `Authenticate(int)`.
- Repeatable `scripts/verify-responsibility-proof.mjs` built worker/fixture, executed xUnit assembly 1/1 PASS, normalized definitions, expanded and joined to one backend-only Situation and verified literal Markdown. Exit 0.
- `npm test` 48/48 PASS; primary real Vitest+xUnit E2E exit 0.

### Reproduced CLI compatibility issue, not an engine defect

With the present dotnet SDK 10.0.102, `dotnet test --project ...` reported zero discovered tests both for the new fixture and the pre-existing primary xUnit v3 project (exit 1). Direct execution of the generated xUnit v3 assemblies discovered and passed new 1/1 and primary 3/3. The proof script therefore uses the real v3 assembly runner. The zero-test result is not misreported as successful.

### Uncertain / later work

The fixture carries minimal compile-time contracts only; a public/reusable configuration SDK, config ownership across shared projects/FeatureSpaces, additional verification framework adapters, and installed VSIX acceptance with the updated worker remain separately unproven. Do not claim broad production readiness from this isolated proof. The 7.3 custom assertion registration remains NEXT.

### Result

The narrowly stated 7.2 proof is DONE in the Windows post-release working checkout. Historical 0.1.0 release acceptance is unchanged.


## 2026-10-10 — P1/7.3 custom assertion helper registration proof

### Reconstructed goal and constraints

Follow the v11 explicit code-first `RegisterAssertion(helperSymbol)` contract: only an expressly registered, semantically resolved helper may be projected. Preserve verbatim assertion text and source range. Do not infer assertions from method spelling or treat unrecognized ordinary calls as errors. Do not repack the historically accepted 0.1.0 release.

### Independently verified

- Read the `05-assertion-model.md` and `07-code-first-configuration.md` sections from the original v11 archive directly on Windows.
- Reproduction before code change: the separate real xUnit v3 fixture produced only built-in `Assert.True(true)`, missing `FeatureChecks.AssertDenied(false)`.
- Added worker-side registration resolution against the real `FeatureProjection.IFeatureProjectionBuilder.RegisterAssertion` method symbol; registered target compared by `IMethodSymbol.OriginalDefinition`. No name-based matching.
- Positive proof: backend test contains the literal `FeatureChecks.AssertDenied(false);` and recognized framework assertion. Both are projected with exact source ranges and source text, `kind=assertion`.
- Negative proof: same-named different overload, different class, technical telemetry call, and unrelated `PretendBuilder.RegisterAssertion` are ignored. Deliberate throw inside `Configure()` did not execute during Roslyn analysis.
- `scripts/verify-assertion-helper-proof.mjs` is repeatable: builds real worker/fixture, runs xUnit v3 assembly 1/1, checks raw worker JSON, normalized semantic identity, joined backend-only Situation and rendered Markdown. Exit 0.
- Existing `scripts/verify-responsibility-proof.mjs` PASS, `npm test` 48/48 PASS. `npm run demo:real` exit 0 with 3 original Situations, each with Frontend and Backend.

### Tooling incident / not a product defect

A batched PowerShell verification hung because a helper function used the reserved automatic variable `$args`, accidentally launching bare `node.exe`. Inspected the exact process parent/child chain, terminated only that session, corrected the verification wrapper, and reran all checks successfully. The shared Tunnel and unrelated processes were left intact.

### Deferred / genuine questions

Public reusable configuration contracts and NuGet distribution, TypeScript symbol-safe helper registration, multi-project configuration ownership, post-release installed-VSIX acceptance, and broader invalid-registration cases are not established by the narrow proof. These are follow-ups, not invented 7.3 blockers. 7.4 versioned public export remains LATER pending a scope decision.

### Result

7.3 DONE in the post-release Windows working checkout. 0.1.0 accepted release artifacts remain separate and unchanged.


## 2026-10-10 — Post-P1 installed VSIX acceptance (source-safety, responsibility, custom assertions)

### Reconstructed task and contract

After source-only P1/7.1–7.3 proofs, exercise the same changes from a real installed Windows VSIX outside checkout ancestry. Preserve historical `0.1.0` VSIX/ZIP without overwrites. Cover normal command gating, Workspace Trust, runtime prerequisites, primary Configure/Refresh/navigation, two P1 code-first proofs, and adversarial FeatureScope isolation.

### Confirmed risks and mitigations

- Original installed acceptance script invokes `npm run package:vsix` which would overwrite the existing `artifacts/feature-projection-prototype-p0-0.1.0.vsix` and deletes a fixed temporary test root. A separate verifier was created using a unique P1 VSIX filename and GUID temporary directory; the original script was left intact. The candidate was checked to be absent before writing.
- A missing candidate-packaging command in the new verifier was detected in preflight before running it and corrected; this was a verifier construction mistake, not a product defect.
- Candidate bundle explicitly republished the current worker runtime; SHA-256 of the worker DLL inside VSIX, the published worker and the installed isolated worker matched.

### Passed acceptance evidence

- `npm test` 48/48 PASS before packaging.
- Candidate VSIX packaged (368 entries, 20,460,132 bytes) and installed into isolated VS Code profile, without touching primary installed extensions.
- Normal installed smoke: hidden test/debug commands absent. Trusted Configure/Refresh smoke: persisted two sources, three primary Situations, source navigation, Stale on source edit.
- Actionable missing-Node and incompatible-.NET diagnostics PASS. Installed Restricted Mode PASS with runtime/project execution suppressed.
- Installed P1 workspace configured with two independent xUnit projects: responsibility and assertions. `Fresh`, 2 Situations, 2 backend source actions, zero diagnostics; literal `user.Verify(x => x.Authenticate("invalid"), Times.Once);` and `FeatureChecks.AssertDenied(false);` present, wrong overloads / logger.Verify / telemetry / same-named unrelated helpers excluded.
- Same already installed candidate (no repack): second workspace accounts and billing — 2 FeatureSpaces / 6 Situations / 10 source actions / 2 unmatched parts / Fresh. Exact scope boundaries remain intact.
- All seven smoke JSON result markers verified `ok=true`. P1 VSIX SHA-256 `44284D06F1A5C67A24CDF52B03F372A7D12249C3258A2A1F6C2823061D751989`; historical VSIX `49704A1072FD571BFEC94139BBC865F9B75F40CD899E6CDC531E9E605E951CC1` and ZIP `16D23889C6702D392B9935E6794034EBA1D492FB05BC496F6FE865F28D6C8D08` unchanged.

### Uncertain / deferred / genuine questions

P1 public C# configuration contracts remain fixture-local. No ordinary-user manual click-through was performed for this new candidate; no cross-platform matrix or published marketplace release. The candidate retains manifest version 0.1.0 and must not be mistaken for the historical accepted release. Full parameterized concrete-case source-level navigation (P2/8.1) remains unproven; stable normalized export (7.4) remains LATER.

### Result

P1/7.1–7.3 isolated **installed Windows technical acceptance PASS**. No product defect reproduced in installed candidate. Next targeted research: P2/8.1 exact parameterized source navigation, preserving framework-native Situation identity.


## 2026-10-10 — Ordinary-user P1 candidate manual acceptance

### Reconstructed goal

Independently verify the installed P1 candidate in normal VS Code: literal business verification, custom assertion, exact FeatureScope isolation, and Markdown Preview links to the correct C# tests. Do not conflate with P2 concrete parameterized-case navigation or overwrite 0.1.0 release artifacts.

### Passed evidence

The user installed the separate P1 VSIX, opened the trusted clean `feature-projection-p1-manual-acceptance` workspace, and performed explicit Refresh. Screenshot: Fresh, two scopes and Situations `invalid_token`/`invalid_password`, each with unmatched Frontend. Literal assertions: `FeatureChecks.AssertDenied(false);`, `user.Verify(x => x.Authenticate("invalid"), Times.Once);`, `Assert.True(true);`; unrelated verifications were absent.

After VS Code displayed the external-application confirmation for the `vscode://file` link, the user selected **Yes**. Screenshot 1 shows `responsibility/Features/auth/AccessFeatureTests.cs` with cursor at line 7; screenshot 2 shows `assertions/Features/access/AccessFeatureTests.cs` with cursor at line 6. Both correspond to the correct definitions.

### Classification / follow-up

Real problems: none confirmed. Warning/confirmation is visible security UX and does not prevent navigation. The user suspects Markdown Preview default behavior; the underlying setting was not independently verified, so do not classify it as a product defect. Manual acceptance does not establish exact parameterized-row navigation, public C# contracts or cross-platform behavior.

### Result

**P1 ordinary-user manual acceptance PASS** following D-046 installed technical PASS. Original 0.1.0 release remains distinct. Next: P2/8.1.


## 2026-10-10 — P2/8.1 exact parameterized source navigation (static proof + installed acceptance)

### Reconstructed requirements

Provide exact case-row navigation separately for Vitest and xUnit only where safe concrete source identity can be proved, and never derive Situation from business payload/error. Retain exact FeatureScope join, framework-native Situation/ExpectedBehavior semantics, and literal assertions; preserve historical release artifacts.

### Confirmed problems / causal chains

1. Vitest 5 task.location refers to the outer title-call position, not the start of a multiline test.each expression; e.g. framework line 6:3 vs source definition line 3:1. The existing definition correlator compared only the definition-start line and incorrectly blocked both cases as unresolved. Explicit framework-task line/column transport fields now resolve the mismatch without changing semantic identity.
2. xUnit materialized bool parameter key as System.Boolean while Roslyn definition key used bool, silently leaving native concrete cases uncorrelated. CLR name formatting now matches reflection, without modifying semantic identity.

### Passed

- Real source fixtures under fixtures/parameterized-navigation-proof (static Vitest object table, xUnit symbol-bound InlineData with unique Label values); actual Vitest execution 2/2, actual xUnit v3 execution 2/2.
- Full prototype: 4 native concrete cases / 2 Situations with Frontend and Backend, exact static navigation lines [4,5,5,6], Markdown source links, editor actions, Test Explorer nodes and unmodified literal assertions PASS.
- No phantom case creation from source anchors; unknown and duplicated labels safely fall back to shared definition. Computed primary Vitest buildCases() and xUnit MemberData have no precise anchor; fallback was directly verified.
- npm test 50/50 PASS; original primary real Vitest+xUnit E2E 3 Situations exit 0; existing P1 responsibility and helper scripts PASS.
- Separately packaged and isolated-installed P2 VSIX: Fresh / 2 Situations / 4 exact source actions / 0 blocking diagnostics; Markdown links, Testing API and source command navigation PASS. VSIX size 20,462,673 bytes; SHA-256 6F54B99A8D250BBFAD0BC114D37C22E7C2558EF6A36EAC9530B07BAB782AA0C8.
- Historical 0.1.0 release VSIX/ZIP and accepted P1 candidate SHA-256 checked unchanged.

### Uncertain / deferred / genuine questions

Dynamic Vitest buildCases() and xUnit MemberData do not expose independent trustworthy per-row source identity through the current framework discovery output. Whether additional provider-specific metadata permits *safe* navigation requires separate evidence; unsupported patterns continue definition-level. A same-argument different-Label InlineData probe materialized only one native case, which must not be fabricated from syntax. This does not prove a new public release, cross-platform support, or ordinary-user P2 manual link clicks.

### Result

P2/8.1 STATIC SUBSET passes source tests and isolated installed Windows technical acceptance; 8.1 overall remains PARTIAL pending dynamic-case feasibility, with explicit safe fallback.


## 2026-10-10 — P2/8.1 dynamic-provider feasibility and definition-level fallback review

### Original goal

Determine whether concrete-case native identity/label can be mapped to a trustworthy source row for computed Vitest `test.each(buildCases())` and xUnit v3 `MemberData`, without deriving Situation from payload or falsely asserting exact navigation. Retain existing accepted static-row P2 behavior and 0.1.0/P1/P2 artifacts.

### Passed / independently reproduced

- Native Vitest collection of the trusted primary fixture returned two explicit concrete Situations and distinct test IDs; their source locations are both exactly 11:24. Raw task metadata inspection showed `location` only for source positioning, not a per-row source span.
- Native xUnit v3 materialization returned two `TestLabel` and `UniqueID` values with no per-row source coordinate. Reflection of the local v3 test abstractions showed test-case/method/argument and label properties; no independently trustworthy row-location property established. Avoid categorical claims about other framework versions or future APIs.
- Added repeatable `scripts/verify-dynamic-provider-fallback.mjs`; a *real full-engine run* produced 4 concrete cases, 3 joined Situations, 2 parameterized Situations with both Frontend/Backend, 4 definition-level actions and no `navigationSource` on dynamic parts. Markdown actions and Test Explorer correctly target Vitest definition line 11 and xUnit definition line 26.
- Follow-up: `npm test` 50/50 PASS; static P2 exact-row proof PASS. No original or candidate VSIX repackaged for this investigation.

### Real problems / uncertain / deferred

No new engine defect reproduced. Missing per-row location from the present dynamic framework outputs is an evidence limitation, not a semantic join failure. Inferring line numbers from matching source Label literals or argument ordinal would be speculative and is explicitly rejected. Future opt-in provider mappings would require a separate provenance/safety proof. Ordinary-user P2 candidate click-through, P2/8.2 cross-navigation, public C# SDK, and cross-platform validation remain separate.

### Result

P2/8.1 bounded navigation contract DONE (static exact rows, dynamic definition fallback). Dynamic arbitrary-row navigation unsupported, not silently guessed; advance to P2/8.2.


## 2026-10-10 — P2/8.2 Projection/Test Explorer cross-navigation and assertion-source links

### Reconstructed goal and requirements

Enable bidirectional navigation for scoped concrete Situation nodes: Projection to native Test Explorer, Test Explorer to exact Projection Situation line; preserve Frontend/Backend source navigation and add literal assertion source navigation. Do not infer Situation from payload, mutate semantic FeatureScope join, add Run/Debug, or overwrite accepted releases.

### Confirmed evidence / passed

- Used official VS Code Testing API reveal command `vscode.revealTestInExplorer(TestItem)`; the Test Explorer extension point `testing/item/context` contributes the reverse action. Only current published concrete TestItem IDs are indexed, using FeatureSpaceId + logicalFolderKey + FeatureName + Outcome + Situation.
- CodeLens on each Projection Situation reveals that TestItem. Reverse command opens the virtual projection document and selects the exact Situation line. Unknown IDs return false; no arbitrary first-match by label. Frontend/Backend Test Explorer children can resolve their existing parent's Situation.
- Regression reproduces adversarial same Feature/Outcome/Situation under accounts/billing; separate encoded IDs and markdown lines. Unresolved definitions do not acquire a synthetic Situation action. `npm test` 54/54 PASS.
- Added native Markdown links and editor CodeLenses to original assertion/registered verification SourceRanges. Literal code-fence snippets remain unchanged. Separate action collection prevents changing the previous Frontend/Backend source-action counts.
- Built an intermediate standalone crossnav candidate (SHA-256 F6EA46AB06D48A5067D68405863DB1280EC7C1564972EC0F4659E8DB71E434BB) and an additional assertion-navigation candidate (20,463,808 bytes; SHA-256 88E8030EC53220D05682F077D7F7E9FEC25A91C05F59902F45A9673528412F62). Neither overwrote 0.1.0, P1 or previous P2 archives.
- Isolated installed technical smoke: accounts+billing, 6 Situations, 6 scoped bidirectional commands, 10 part source actions, 10 assertion source actions/CodeLenses, 2 explicit unmatched parts, unknown ID refusal, Fresh; `P2_INSTALLED_CROSS_NAVIGATION_PASS`. Worker/TypeScript packaged.
- Post-install full primary real Vitest+xUnit E2E PASS (3 Situations); P2 static exact-row navigation PASS; P2 dynamic fallback PASS; P1 registered responsibility and custom assertion proofs PASS.

### Tooling issue / classification

First generation of the smoke verifier incorrectly renamed the existing `fixtures/workspace-scope-isolation` path to a nonexistent directory. Packaging and isolated extension install succeeded, but no installed scenario was run then. Verified the exact temporary profile and artifact, corrected only the fixture path, reran smoke in the existing isolated profile, and got PASS. A second verifier-preparation preflight failed before writing due to misuse of PowerShell string `Split`; it was corrected before creating the final verifier. These were verification-script issues, not Feature Projection product defects.

### Uncertain, deferred, genuine questions

The actual user right-click context-menu interaction has not been manually exercised for this P2 build; technical checks confirm the contribution entry and programmatic command behavior, not interactive UI event delivery. No user screenshots of literal assertion link clicks for the P2 candidate. The historical `vscode://file` confirmation may appear when clicking Preview links, as already seen in P1. No public new-version VSIX or marketplace release; both new candidates retain 0.1.0 manifest. P2/8.3 usage/refactoring and P1/7.4 public JSON export remain separate.

### Result

P2/8.2 implementation and isolated installed Windows **technical** acceptance DONE. Next scoped task: P2/8.3 usage/refactoring feasibility review; ordinary-user P2 manual click-through is a follow-up before a new accepted release.


## 2026-10-10 — P2/8.2 ordinary-user reveal navigation failure and repair retest candidate

### Observations

User refreshed `feature-projection-p2-manual-acceptance` in ordinary Windows VS Code. Projection had accounts/billing FeatureSpaces and all six correct Situations; explicit assertion source links and Testing tree structures appeared. User manually opened Testing, expanded `accounts/shared → denied → expired/locked`, then tried the Reveal Situation CodeLens from Projection. Testing did not automatically expand/select the requested Situation; screenshots instead displayed the frontend shared `test.each(buildCases())` definition on line 11. Another attempt targeting `billing/shared → locked` left `billing/shared` collapsed. The original ordinary-user P2/8.2 acceptance therefore **FAILED** on forward reveal, despite isolated installed technical smoke passing. Do not attribute the failure to user's clicking a wrong item without evidence; the click origin cannot be proven from screenshots.

### Investigation and change

Inspecting current 1.141 VS Code bundle and published documentation confirmed `vscode.revealTestInExplorer(TestItem)` as the official API. Its successful command return does not prove actual selection/branch expansion. Diagnostic installed probe could not read selected Testing node using `_testing.getExplorerSelection` (unavailable in extension command list).

An attempted explicit `workbench.view.testing` call proved invalid in the isolated Extension Host and was rejected (no PASS). Removed that guessed view command and added a separately contributed Command Palette reveal action with QuickPick displaying full scoped Situation information; preserves existing direct CodeLens dispatch but makes user execution unambiguous. Added full-ID request and dispatch logs. No change to FeatureScope semantic joining, AssertionSource navigation, or framework materialization. New candidate `p2-reveal-palette-fixed-candidate.vsix`, SHA-256 `D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107`.

### Acceptance status

`npm test` 54/54 PASS; new isolated installed candidate smoke PASS, 6 Situations, 2 scopes, 10 native assertion links, 10 part links, Fresh and properly contributed palette command. **User-visible forward reveal remains unverified and manual blocker stays open.** The experimental unsupported-view probe VSIX is not for use. Await manual palette retest; do not advance acceptance based on automation alone.

## 2026-10-10 — P2/8.2 corrected candidate ordinary-user manual acceptance PASS

### Requirement and chronological evidence

Preserve the initial user-observed failure to reveal a Situation via inline CodeLens (recorded in D-053). Independently validate a newly distinguishable forward-navigation route on the corrected internal P2 candidate, then check reverse Test Explorer context navigation and exact assertion source navigation, using the trusted accounts/billing manual workspace.

### User-acknowledged successful checks

- Installed corrected `feature-projection-prototype-p0-0.1.0-p2-reveal-palette-fixed-candidate.vsix` and opened the prepared manual workspace. User stated that the new `Feature Projection: Reveal Situation in Test Explorer` command from **Command Palette** works.
- User confirmed the context action on `billing/shared → denied → locked`: `Feature Projection: Open Situation in Projection` correctly opens the corresponding `projection.md` Situation.
- User confirmed the Backend `Open assertion source` action for the same Situation navigates to `services/billing-api/Features/shared/AccessFeatureTests.cs` **line 22** (`Assert.False(testCase.Allowed);`) rather than the test declaration.
- Earlier user screenshots and testing-tree interaction confirmed 6 Situations spread across independent accounts/billing FeatureSpaces, with the correct Testing hierarchy and explicit unmatched parts.

### Acceptance classification and limitations

**Manual PASS for three supported workflows (palette forward, context-menu reverse, assertion source).** The user reported success conversationally for the final steps; no additional screenshot-based claim is made for those exact clicks. This does not establish that the original inline CodeLens selection/reveal behavior was fixed or manually verified: keep the D-053 initial failure and CodeLens UX caveat intact.

Source `npm test` 54/54 PASS, isolated installed technical smoke PASS (Fresh / 6 Situations / 10 source actions / 10 assertion actions), candidate SHA-256 `D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107` were already verified. No new release was published; no user-facing test Run/Debug capability was claimed. Next plan task: P2/8.3 usage/refactoring feasibility; P1/7.4 export LATER.


## 2026-10-10 — P2/8.3a registered C# symbol-usage feasibility (read-only)

### Goal / boundary

Investigate v11 Usage & Refactoring safely on the accepted Windows working checkout without assuming fuzzy name matching is suitable for Rename. Establish genuine C# symbol-identity references for registered business responsibility and custom assertion helper. Avoid user data edits, re-packaging accepted VSIX or executing configuration.

### Source-level proof and results

- Added `RoslynUsageFeasibilityProbe.cs` and a non-public `probe-registered-usages` worker branch. It opens an actual C# project using MSBuildWorkspace, finds registrations only through the real configuration/builder interfaces, and runs `SymbolFinder.FindReferencesAsync` for resolved original method symbols. References are restricted to the configured project and carry literal file/start/end/line/column; classified registration vs feature-test vs project-source.
- Real `responsibility-proof`: `User.Authenticate(string)` has one configuration reference (33), a direct call (12), Moq.Verify lambda call (13). `Authenticate(int)`, unrelated logger/verification calls do not leak.
- Real `assertion-helper-proof`: `FeatureChecks.AssertDenied(bool)` has one configuration reference (48), one feature-test call (8). String overload, unrelated type, and pretend builder registration do not leak.
- Duplicate same-symbol registration injected into an isolated temporary source clone produces explicit ambiguity diagnostic and **zero** reference targets (fail closed), not a partial reference list.
- Read-only proof `node scripts/verify-usage-symbol-feasibility.mjs`: `P2_8_3_READONLY_SYMBOL_USAGE_FEASIBILITY_PASS`. Source slice of each reference exactly names its registered symbol. No `WorkspaceEdit`, `ApplyChanges`, rename, or execution of `Configure()`.
- `npm test` 54/54 PASS, primary real Vitest+xUnit E2E PASS, P2 static/dynamic navigation proofs PASS, both P1 registered responsibility/helper scripts PASS after worker update.

### Deliberately not claimed

No visible Usage View exists yet and no installed VSIX acceptance was run for 8.3. The worker command is a controlled research surface only and is not connected to automatic refresh; existing trust/security policy for the extension is unchanged. C# symbol-based rename was *not tested* and must not be interpreted as safe from these usage results. Canonical test naming, parameterized labels and cross-language bindings require independent safety work. No public SDK or release was created; accepted P0/P1/P2 builds are preserved.

### Result / next

**P2/8.3a read-only registered C# symbol usage feasibility DONE.** Next P2/8.3b: explicitly invoked, trusted, read-only Usage View with exact project/FeatureScope provenance and navigation; validate installed Windows candidate separately. Rename remains deferred.


## 2026-10-10 — P2/8.3b read-only Usage View: installed Windows technical PASS, ordinary-user manual PENDING

### Scope

Connect D-055's proven registered C# symbol graph to an ordinary VS Code command, while retaining strict Workspace Trust, per-project FeatureSpace isolation and source-accurate navigation. Do **not** implement symbol Rename or edit source. Do not replace historical version 0.1.0 releases.

### Implementation

- `src/core/registeredUsages.ts`: normalize worker JSON into typed, strictly read-only targets; check Roslyn SourceRange against realpath of workspace and project, file contents, name and line/column; fail closed on incomplete, duplicate, ambiguous or stale references. Render virtual Markdown with complete method signature and link role.
- `src/extension.ts` + `package.json`: publicly contributed Command Palette `Feature Projection: Show Registered C# Usages`; explicit QuickPick for `FeatureSpace/source`; trusted single-root and valid `xunit-v3` source; packaged .NET worker via `runJsonWorker`; read-only virtual document and independent CodeLens navigation.
- Initial candidate used one `usages.md` document across sources; installed smoke demonstrated a stale content/CodeLens transition bug. This candidate is marked **FAILED**. Corrected to `/usages/<FeatureSpace>/<source>.md` and per-URI isolated actions. New candidate built separately; old candidate retained for audit.

### Evidence

- `npm test` **58/58 PASS** with four new read-only Usage View unit tests (guard malformed JSON, project traversal, stale/misreported symbol spans, ambiguity, mutation claim).
- `node scripts/verify-usage-symbol-feasibility.mjs` PASS (P1 real symbol overloading and ambiguous-registration fail closed).
- Fresh Windows installed VSIX smoke `scripts/verify-p2-registered-usages-scoped-acceptance.ps1` PASS:
  `result-normal.json` normal hooks hide test-only commands;
  `result-registered-usages.json` `User.Authenticate(string)` registration at 33, usages at 12/13; `FeatureChecks.AssertDenied(bool)` registration at 48, usage at 8; per-scope editor content; CodeLenses for all 3/2 refs; precise navigation; unknown scope refused.
- Installed Restricted Mode smoke `scripts/verify-p2-registered-usages-restricted.ps1` PASS; `trusted:false`, worker diagnostics mark partial projection, user-facing Usage command refuses without running the worker.
- P2 installed navigation regression `scripts/verify-installed-p2-reveal-palette.ps1` PASS **on the same new installed candidate**: two accounts/billing FeatureSpaces, six Situations, bidirectional scope-accurate command dispatch, ten source/ten assertion links and two unmatched parts, Fresh.
- New VSIX (not installed in user's ordinary VS Code yet) `artifacts/feature-projection-prototype-p0-0.1.0-p2-registered-usages-scoped-candidate.vsix`, 20,474,162 bytes, SHA-256 `7C259D336C89C961E61827E0AD6E92508BB0125CE5C0776946C17D0067275CE1`. All previous release and acceptance VSIX SHA-256 unchanged.

### Classification

**P2/8.3b installed technical acceptance PASS; manual user acceptance PENDING.** User should install separately named scoped candidate, open existing P1 manual proof workspace, inspect `responsibility/backend` exact registration and two references, click direct source and then check `assertions/backend`. Do not claim that the invalid single-URI candidate passed, or that any Rename/cross-language behavior exists.


## 2026-10-10 — P2/8.3b ordinary-user Usage View manual PASS

### Setup / scope

User installed corrected internal VSIX `feature-projection-prototype-p0-0.1.0-p2-registered-usages-scoped-candidate.vsix` and opened existing configured `feature-projection-p1-manual-acceptance` workspace. The Usage View command runs independently of `Feature Projection: Refresh`. Do not interpret the initial technical installed PASS (D-056) as a manual result: the following independent user screenshots provide that evidence.

### Screenshots reviewed

1. `responsibility/backend` virtual Usage View: `User.Authenticate(string)` symbol; configuration registration `FeatureProjectionConfig.cs:33`; two feature-test uses at `Features/auth/AccessFeatureTests.cs:12` and `:13`; correct CodeLens source actions displayed. No unrelated `Authenticate(int)`.
2. `assertions/backend` virtual Usage View: `FeatureChecks.AssertDenied(bool)`; configuration registration `FeatureProjectionConfig.cs:48`; feature-test use at `Features/access/AccessFeatureTests.cs:8`; independent scope content and CodeLens. No unrelated overload or same-named method.
3. First navigation screenshot: opened `responsibility/Features/auth/AccessFeatureTests.cs` with selected use on line **12** `user.Object.Authenticate("invalid");`.
4. Second navigation screenshot: opened `assertions/Features/access/AccessFeatureTests.cs` with cursor on line **8** `FeatureChecks.AssertDenied(false);`. The different overload `FeatureChecks.AssertDenied("context")` and same-name `UnrelatedChecks.AssertDenied(false)` remain at lines 9–10 and are not the selected destination.

### Classification

**Manual PASS** for both read-only C# Usage View screens, FeatureSpace separation, and exact editor CodeLens navigation to the tested symbol references. **Not tested manually:** Markdown Preview link clicking, other-project usage completeness, Rename/refactoring safety, source edits, cross-language links. Technical installed acceptance remains PASS per D-056 with source tests 58/58; do not rebuild or publish a new VSIX solely for this documentation update. No existing release/acceptance artifact is modified.

NEXT: separate P2/8.3c Rename/refactor semantic feasibility, read-only first with collision/preview/consent safeguards; no automatic mutations.
