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

## 2026-10-10 — P2/8.3c in-memory Roslyn Rename semantic feasibility PASS (no file edits)

### Scope and execution

Canonical repository: `C:\Users\alexa\Repos\feature-projection`; remote `AlexPastukhh/f-proj`. User opened this workspace. The new source-only worker proof adds `probe-registered-rename` dispatch and `RoslynRenameFeasibilityProbe.cs`. It resolves exact code-first registration method symbols and computes `Renamer.RenameSymbolAsync` inside the loaded Roslyn project **without ApplyChanges**. It does not run `Configure()`, change source files or expose a public Rename command.

### Proof evidence

`node scripts/verify-rename-feasibility.mjs` PASS: `User.Authenticate(string)` to `AuthenticateCredentials` yielded four exact token previews (declaration/registration/two calls), and `FeatureChecks.AssertDenied(bool)` to `AssertAccessDenied` yielded three (declaration/registration/call). The unrelated overloads and similarly named other methods were not edited. Each proposed change was contained within a Roslyn-resolved declaration/reference span; the *full reconstructed method token* must equal the requested name, even when Roslyn's raw text diff is only an insertion. In-memory compilation before and after has zero errors. SHA-256 snapshots confirm fixture .cs/.csproj files unchanged.

Negative proof cases — unregistered overload, same-name no-op, C# keyword, malformed identifier, same-declaring-type overload collision in disposable clone, and duplicate registration in disposable clone — all produced explicit refusals and **zero preview edits**. C# worker `dotnet build -c Release --no-restore` PASS; `npm test` **58/58 PASS**; primary real Vitest+xUnit E2E PASS.

### Classification and next gate

**8.3c read-only research/proof PASS; Rename as a user-visible or mutating feature remains NOT IMPLEMENTED.** This proof does not certify cross-project callers, reflected string usages, FeatureSpace/canonical label references or editor buffer freshness. No new user VSIX or public release and no ordinary-user Rename acceptance. Next 8.3d: design explicit opt-in review/consent UX, validate workspace/project graphs and collision/staleness handling before permitting edits. See D-058.

## 2026-10-10 — P2/8.3d read-only C# Rename Preview: installed technical PASS, manual PENDING

### Scope / implementation

Added `Feature Projection: Preview Registered C# Rename (Read-Only)` to the normal VS Code Command Palette and exposed a separate `feature-projection:/rename-preview/` virtual-document branch with independent per-scope source-navigation CodeLens. The user explicitly chooses a FeatureSpace/source, semantic registered symbol and proposed new identifier. It requires a trusted one-folder workspace. `src/core/renamePreview.ts` defensively validates read-only output from `probe-registered-rename`, including project/workspace realpaths, exact symbol identity, original/current C# text, line/column, duplicate spans and non-partial failure results. Dirty project documents are refused. There is **no mutation path**.

### Evidence and iteration

The first experimental candidate had a smoke test dispatcher omission; it invoked Configure and failed before exercising the preview. Fixed the dispatcher and kept the earlier VSIX separate. The acceptance PowerShell script also required restoration of a missing `$LASTEXITCODE` check during construction; it was corrected. Neither preliminary failure was counted as a feature PASS.

Final corrected candidate: `artifacts/feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-fixed-candidate.vsix` (20,489,453 bytes, SHA-256 `23C01AC1CEFFE89DE9D2A38A5CEC17ED2494636F7D9E9BFB7EDA47409753B416`). Source `npm test` **62/62 PASS**, earlier registered-symbol usage and Roslyn in-memory Rename proofs PASS. Fresh isolated Windows VS Code installed profile: normal commands without hidden test hooks PASS; `responsibility/backend` and `assertions/backend` show 4/3 separate accurate preview token links and editor CodeLens jumps PASS; no-op Rename explicitly REFUSED with zero links; unknown/unregistered method refused.

Additional installed checks on the **same corrected VSIX**: Restricted Mode blocked public preview and spawned no C# usage/rename worker, PASS. Existing P2 cross-navigation smoke passed for 6 Situations in accounts/billing with 10 source/10 assertion action links, correct scope isolation. Historical artifacts kept separate and SHA-256 unchanged.

### Acceptance classification / next gate

**P2/8.3d installed technical PASS; ordinary-user manual acceptance PENDING.** Install only the corrected candidate, then in the prepared trusted `feature-projection-p1-manual-acceptance` workspace preview `User.Authenticate(string) → AuthenticateCredentials` and `FeatureChecks.AssertDenied(bool) → AssertAccessDenied`. Verify 4/3 exact proposals, source-navigation and no edits. Do not claim cross-project Rename safety or actual application. P2/8.3e mutation-consent/cross-project feasibility LATER; P1/7.4 normalized export LATER.

## 2026-10-10 — D-060 batched MVP release acceptance and Windows source CI scaffolding

The user opted out of repeated ordinary-user feature-by-feature
VSIX install/click/screenshot checks. D-060 moves manual validation to
one **final cumulative candidate** while preserving technical tests
and existing D-054/D-057 manual history. D-059 manual pending is not
automatically upgraded to PASS.

New `docs/plan/MVP-RELEASE-GATE.md` defines scoped MVP, deferrals,
isolated installed technical gate, short final manual checklist and
explicit release go/no-go. New Windows GitHub Actions source workflow
builds TypeScript/.NET and runs unit tests, Roslyn usage/Rename proofs
and packaged-worker inspection. It does **not** claim installed
technical PASS, and GitHub CI status is unverified until actual runs.

Added repository metadata to `package.json` without choosing an
unapproved license, version bump, release tag or publishing a VSIX.
Historical binaries remain local and ignored by Git. Next task:
verify CI on GitHub and stabilize aggregate installed release smoke;
only then ask for the one ordinary-user acceptance session.

## 2026-10-10 — D-061 MVP cumulative isolated installed acceptance PASS

### Reusable aggregate gate

`scripts/verify-mvp-installed-aggregate.ps1` pins the input VSIX by SHA-256,
verifies earlier accepted artifact hashes, runs source tests/Roslyn proofs,
installs exactly one VSIX in a disposable extension profile and exercises
normal hooks, read-only Rename Preview, scoped registered C# usages,
Configure/explicit Refresh, Restricted Mode and existing P2 cross-navigation
in separate disposable profiles. It reuses the existing installed test
driver and assertion contracts; no manual click or ordinary user install.

### Recorded results

Source: `npm test` 62/62; Roslyn usages PASS; Roslyn preview of 7 exact
source identifiers and fail-closed adversarial cases PASS. Installed:
normal hidden-hook isolation PASS; responsibility/assertions view separation
PASS; Rename Preview 4+3 CodeLens source links and refusal with 0 changes
PASS; Configure/Refresh 3 Situations PASS; Restricted Mode PASS with zero
usage/rename subprocess launches; cross-navigation 6 Situations and
10 assertion links PASS. Historic accepted release and earlier VSIX hash
inventory unchanged.

Final internal candidate: `feature-projection-prototype-p0-0.1.0-mvp-batched-acceptance-candidate.vsix`
(20,490,576 bytes, SHA-256
`54D4B3D1F5C17B3657C91AA299A129B66D146A72178633221FBC2FB0A3D83A29`).
No other VSIX was overwritten.

### Evidence integrity and incident

Windows PowerShell 5.1 cannot call `Path.GetRelativePath`: the final
candidate's first aggregate script run exited only while writing the
local report, **after all installed smoke checks passed**. This is a
reporting defect, not an installed feature failure. Fixed the reporter,
verified all six saved result JSON objects and extension ancestry
against the exact candidate, and persisted a local Git-ignored JSON
report. The aggregate script now invokes the standalone compatible
`scripts/verify-mvp-aggregate-report.ps1` for future runs.

### Release gate

**Installed technical PASS; ordinary-user manual PENDING** until the
single consolidated D-060 checklist. No public release/version bump,
tag or Rename apply. Next: user chooses when to run one manual session.

## 2026-10-10 — D-062 Rename Preview excluded following ordinary-user UX feedback

During one aggregate MVP manual acceptance, the user proposed an
arbitrary name `AserDend` for `FeatureChecks.AssertDenied(bool)`.
Read-only Rename Preview displayed three correct source coordinates
(declaration line 20, registration line 48, feature use line 8).
The user confirmed that the feature-test source link opened.
However, the user found the interaction confusing: entering a name
appeared to start Rename, but the interface only showed unapplied
references with no next action. The user agreed to exclude the
feature until a complete, collision-safe/consented Rename exists.

Changed public VS Code command manifest and extension registration:
`featureProjection.previewRegisteredRename` is not contributed,
does not activate, and is not registered in ordinary VS Code.
Normal installed smoke must assert direct command invocation fails.
Test-only symbol preview hooks, Roslyn preview proof, and unit tests
remain available in isolated automation; the user-facing MVP excludes
Rename Preview. No WorkspaceEdit or source rename was introduced.

Replacement separate immutable 0.1.0 VSIX candidate:
`feature-projection-prototype-p0-0.1.0-mvp-no-rename-preview-candidate.vsix`
(20,490,605 bytes; SHA-256
`09E71D305560DD7E3ECCF7E161DA35FA6585D05992B4E9CE36AFD7B25FCB68A0`).
Prior candidate and all previously accepted binaries remain separate.

**Manual acceptance remains PENDING.** The session is paused
until the user installs the replacement after installed technical
acceptance. Final checklist excludes all Rename Preview clicks;
remaining source and cross-navigation workflows must be confirmed.
### Replacement candidate installed proof (same day)

The SHA-pinned replacement was installed into a fresh isolated VS Code
extensions directory. Source 62/62 PASS; exact C# usages/Roslyn
feasibility PASS; normal profile verified missing Rename contribution,
activation and public command and rejected its direct invocation;
test-only hidden preview kept 4+3 correct token references,
CodeLens and refuse-with-zero-edits. Configure/Refresh, scoped
registered usages, Restricted Mode/no worker spawn and prior
P2 two-FeatureSpace, 6-Situation/10-assertion-link cross-navigation
all PASS. Report is stored locally with fields
`publicRenamePreview: EXCLUDED` and
`researchRenamePreview: PASS_TEST_MODE_ONLY`.

**Technical installed PASS is not ordinary-user acceptance.**
Only remaining user-visible MVP steps will be included in resumed
manual acceptance using the new candidate.

## 2026-10-11 — D-063 Internal P1/7.4 normalized JSON feasibility

User said the shortened checklist appears to work and delegated
further implementation. No automatic release or formal manual PASS
was inferred. Started the next bounded deferred proof without
changing the public VS Code surface.

### Implementation

`src/core/normalizedSnapshot.ts` provides internal deterministic
semantic normalized objects/JSON from existing joined real data.
Includes explicit unmatched Frontend/Backend, trust/degraded state,
literal assertion snippets, source/navigation line/column, structured
diagnostics and unresolved parameterized test definitions. Verified
source realpaths remain under workspace root before representing them
relative to it. Duplicates and scope mismatches fail closed.

### Evidence

New `test/normalized-snapshot.test.mjs`: 6 tests for stable output,
cross-FeatureSpace isolation, trust, source exactness, diagnostic
preservation, missing data and path/identity invalidity. Full
`npm test` **68/68 PASS**. Real `npm run demo:real` PASS.
`node scripts/verify-experimental-json-snapshot.mjs` PASS on
real Vitest5/xUnit3 fixture: 3 joined Situations, 6 matched parts,
6 literal assertions and byte-identical JSON when input order is
reversed. No disk writes or public JSON format declaration.

### CI and boundaries

Windows source workflow extended with fixture Vitest `npm ci`,
xUnit project restore and the real JSON proof. Confirm CI status
on GitHub after push; local source PASS alone does not certify CI.
Stable schema, export UI/file handling and diagnostic privacy
remain LATER; no new VSIX/manual acceptance/release implied.

## 2026-10-11 — D-064 Internal metadata-only JSON disclosure draft

### Risk and bounded scope

D-063's normalized result preserves literal feature assertions and
free-form diagnostic messages that can contain developer machine
paths, source code or tokens. Do not mistake relative source paths
for an authorization to disclose the entire normalized document.
Implemented `src/core/exportDraft.ts` without any VS Code command
or file/network output. All drafts are explicitly non-publishable,
require future consent and acknowledge user-authored identifiers.

### Technical evidence

The allowlisted metadata projection removes every diagnostic.message
and assertion.sourceCode, preserving exact scope/role/trust,
source coordinates, diagnostic rule/severity/impact and unresolved
definitions. Counts of omitted fields and blocking evidence are
machine-readable. Independent relative-path checks, source cloning
and a strict JSON property allowlist prevent accidental extra
secret/raw-code fields from entering serialized drafts.

Source **73/73 PASS** (+5 D-064 tests), including realistic token/
path-bearing diagnostics, omitted snippets, deterministic output,
tamper attempts, path traversal, cloning and malformed consent.
The expanded real fixture proof PASS uses actual Vitest5+xUnit3
source analysis, 3 Situations and 6 withheld raw assertions.
Windows CI script step now identifies both normalization and
disclosure checks. Final CI result should be verified on GitHub.

### Deferred decisions

User-authored identifiers, expected behavior and relative file
names are still potentially private. Stable schema/versioning,
explicit user review/consent, freshness, filtering and atomic
output are outside this bounded phase. Do not mark the MVP
manual checklist PASS or publish a release from this result.

## 2026-10-11 — D-065 one Projection document and portable HTML

User confirmed Markdown is best inside VS Code, while their own
existing localhost application should host/consume the same
completed Projection. JSON remains an internal model; no export
button or standalone server is desired.

Added `projectionDocument.ts` (detached JSON-compatible model),
`portableProjection.ts` (script-free, escaped HTML with scoped
situation anchors and checked VS Code source URIs),
`portableHtmlStorage.ts` (workspace-qualified default global
storage and opt-in absolute localhost directory, atomic output,
non-owned file overwrite refusal), and the VS Code activation
wiring/setting/open-command. Existing Markdown actions, Testing API
and read-only C# Usages still use their original code paths.

Added 6 portable tests: single internal document/Markdown+HTML,
escape/protocol/scope behavior, default vs configured storage,
idempotent and collision-safe atomic files, duplicate refusal.
Source suite **79/79 PASS**. Expanded the real xUnit/Vitest proof
to exercise dual view and file output; 3 Situations, 6 assertions,
native VS Code links and no writes to test sources: PASS.
The installed trusted/normal/restricted smoke was extended to
check generated HTML, stale non-overwrite and missing Restricted
Mode generation. Full installed technical result is tracked
separately, not inferred from source unit tests.

Browser/iframe rendering, localhost static serving and external
protocol prompts are still manual acceptance PENDING. No release,
license, version bump, Marketplace publication or source mutations
were authorized. Original D-062 candidate remains preserved.


### D-065 watcher wiring review

A source audit after the first installed P3 technical PASS noticed
that the newly tested `isPortableHtmlOutputPath` helper was
**not actually called** by the extension's `isRelevantUri`.
The second candidate that included only the helper was superseded;
its lengthy technical run was interrupted rather than being
misrepresented as a PASS. The final revision wires the exact helper
into the watcher handler, then independently verifies both the
handler's source reference and the configured-host-directory behavior
during an installed smoke. A separate immutable VSIX,
`...p3-dual-projection-source-watch-fixed-candidate.vsix`
(20,500,477 bytes, SHA-256
`4468280CE13A55FFDAE69CA7F086F6FC68F9342DF9EC7C393692688AB4091380`)
contains this fix. Browser/manual acceptance is still PENDING.

### Final SHA-pinned installed proof — D-065 PASS

The final watcher-wired VSIX, internal version 0.1.0,
`artifacts/feature-projection-prototype-p0-0.1.0-p3-dual-projection-source-watch-fixed-candidate.vsix`
(20,500,477 bytes; SHA-256
`4468280CE13A55FFDAE69CA7F086F6FC68F9342DF9EC7C393692688AB4091380`)
passed the **full installed aggregate** (Windows, exit 0).
It installed only into a fresh isolated extensions directory
with independent trusted/Restricted profiles, not the user's
ordinary VS Code.

The trusted installed smoke confirmed Markdown (3 Situations),
HTML (3 Situations, source links and literal assertions) written
outside the workspace, and then reconfigured the HTML output into
a locally served assets folder *inside* a watched frameworkProject.
The second Refresh remained Fresh; generated HTML/temp files did
not self-invalidate. A genuine feature-test source edit still
marked Stale and did not rewrite the last-good HTML.

The same SHA-pinned run passed normal public-hook security,
Restricted Mode no HTML publication, two-scope Roslyn Usage View,
test-only read-only Rename proof, prior P2 6-Situation/10-assertion
link cross-navigation and historical artifact safety. The full
installed aggregate result is archived locally in
`artifacts/local-acceptance-results/mvp-installed-2e97c7e18da549149617ce688833b5cf.json`
with `status: INSTALLED_TECHNICAL_PASS`, D-065 candidate SHA
`4468280CE13A55FFDAE69CA7F086F6FC68F9342DF9EC7C393692688AB4091380`
and `ordinaryUserManualAcceptance: PENDING`.

GitHub Windows source CI for implementation commit `23d832c`
completed successfully:
https://github.com/AlexPastukhh/f-proj/actions/runs/38110064549

**No ordinary-user acceptance is claimed** for browser rendering,
the user's actual localhost app/iframe or VS Code protocol handler.
The prior D-062 MVP candidate and original release are untouched.

## 2026-10-11 - D-066 portable browser gate preflight (not manual PASS)

Rechecked GitHub origin/main and the clean primary Windows main checkout:
both were at `c466a4fe16a63bbe6290594d4a97dd1b3d19a047`.
Read the current master plan, decisions, review log and integration guide.
No D-065 source or binary changes were made.

Fresh Windows source run: `npm test` **79/79 PASS** (exit 0).
`node scripts/verify-experimental-json-snapshot.mjs` **PASS**:
real Vitest 5/xUnit v3 3 Situations, 6 literal assertions, dual HTML/
Markdown view, atomic output, and previous D-063/D-064 proofs.
Source audit confirms `isPortableHtmlOutputPath` is actually called
inside `isRelevantUri` (no space after comma in source).
Final candidate still measures 20,500,477 bytes; SHA-256
`4468280CE13A55FFDAE69CA7F086F6FC68F9342DF9EC7C393692688AB4091380`.
Prior ignored installed report is still `INSTALLED_TECHNICAL_PASS`,
`ordinaryUserManualAcceptance: PENDING`; the long installed
regression was **not** rerun because the SHA and source are unchanged.

Read-only inspection of the ordinary VS Code installed extension found
`local-prototype.feature-projection-prototype-p0@0.1.0`, **without**
the `featureProjection.openPortableHtml` contributed command or HTML
renderer. Thus ordinary-user D-065 installation is NOT verified and
browser UX cannot be marked PASS. The prepared manual fixture exists,
but has no `portableHtmlDirectory` setting. A Node loopback listener
was visible but is not evidence of the user's intended localhost app,
static directory or route; none was configured or modified.

Next gate: one consented installation of only the final SHA-pinned VSIX,
then one short browser/localhost scenario in the integration guide.
Never assume source/installed technical PASS proves a human browser
click, localhost iframe, external protocol prompt, or publication.
No user's ordinary VS Code or source fixture was modified; no release.

### D-066 continuation - ordinary VS Code D-065 install (2026-10-11)

User authorized replacing the ordinary VS Code extension after recheck,
but explicitly deferred integration with their own localhost app.
Confirmed clean synced GitHub/Windows main `4176845c82accbabfc3df4f907ae34edad837bc0`.
Final candidate SHA-256 `4468280CE13A55FFDAE69CA7F086F6FC68F9342DF9EC7C393692688AB4091380`,
20,500,477 bytes; archived technical report was
`INSTALLED_TECHNICAL_PASS`, manual `PENDING`.
Inspected VSIX archive: manifest contributes the Open HTML command,
and the compiled projection/document/storage modules are present.

Backed up old ordinary extension to local Git-ignored
`artifacts/local-acceptance-results/ordinary-vscode-extension-pre-d065-backup-20261011.zip`
(23,224,471 bytes; SHA-256
`B7A8383188E05386269ED480F57167C20EA004D16122E75855AAA1C1504B52DD`).
Ran `code --install-extension <final SHA-pinned VSIX> --force`:
exit 0, VS Code CLI reported successful installation. Verified exactly
one ordinary installed extension, command manifest equivalence and
**byte-for-byte matching** installed JS for `dist/extension.js`,
`portableProjection.js`, `portableHtmlStorage.js`,
`projectionDocument.js` against VSIX archive. The on-disk manifest
adds VS Code `__metadata` (not a candidate mismatch).

**Status:** ORDINARY INSTALLATION VERIFIED ON DISK; window reload,
ordinary UI/real browser source-link click and manual acceptance are
still PENDING. No source-fixture edits, localhost settings/route/server,
public release, tag, version bump or VSIX repackaging.

## 2026-10-11 - D-067 P3 Refresh timing instrumentation and baseline

Scope: timing observation only, **not** an incremental-cache rollout.
Rechecked primary clean Windows main against remote `86ba62c`.
Modified `src/core/fullEngine.ts` to accept optional `onTiming`
samples for validation, per-source analysis/materialization/build,
expand, join and render. Samples contain phase, elapsedMs and scoped
source identifiers only. A throwing observer cannot break Refresh.
Normal explicit VS Code Refresh logs phase durations in the existing
Output channel. No additional workers, file writes, public commands,
HTML changes, Run profiles or localhost integration.

`test/refresh-timing.test.mjs`: results remain byte-semantic equal
with and without observation in Restricted Mode/untrusted scope;
the observer never enables workers, and a throwing sink is inert.
`npm test`: **81/81 PASS** (previously 79).
`node scripts/measure-refresh-baseline.mjs 2` **PASS** with actual
trusted Vitest 5 + xUnit v3, three joined Situations, zero blocking
diagnostics, unchanged evidence across sequential Refreshes.
Full times 23,411.0 and 13,402.4 ms; per phase xUnit static
7,884.1-10,264.8 ms, xUnit build 2,891.0-10,227.1 ms,
Vitest materialize 1,979.8-2,059.2 ms. The current guarded
benchmark also compares source-input SHA-256 digest before/after;
one subsequent guarded run **PASS**, 13,062.9 ms (non-cached).
These are two-run local sample observations, NOT a speed guarantee.
No automatic/partial refresh or cache has been implemented.

Independent regression `node scripts/verify-experimental-json-snapshot.mjs`
**PASS** for D-063/D-064 and D-065 Markdown/HTML equivalence.
Do not overwrite the ordinary installed D-065 VSIX without a new
technical validation and explicit installation gate. D-066 browser
click remains manual PENDING; user's own localhost integration
DEFERRED. No release, version bump, tag or publication.

## 2026-10-11 - D-068 known-input change detection, fail-closed

Before edits, Windows and GitHub main both `ba4ce71`, clean.
D-067 GitHub Windows source CI:
https://github.com/AlexPastukhh/f-proj/actions/runs/38116082933
**SUCCESS** (verified against the exact commit).

Implemented `src/core/refreshInputProbe.ts` as a standalone
read-only known-input snapshot. It hashes canonical effective
configuration and file bytes/relative paths from each configured
frameworkProject/source root (includes build props and manifests).
New, removed and renamed files and content changes with identical
length/mtime are observable. Path escapes, symlinks/junctions,
missing projects, unknown/dirty editors, untrusted workspaces
and duplicate identities cannot be treated as known-stable.
Existing project dependency/build dirs are intentionally excluded,
so even `observed-unchanged` is **not** a safety claim for reuse.
All results return `reusePermitted:false`; no active cache or
VS Code Refresh hook was added.

Evidence: `npm test` **89/89 PASS** (+8 source unit tests).
`node scripts/verify-refresh-input-probe.mjs` **PASS**, real
Vitest5/xUnit3 fixture scopes=2, hashes unchanged between
observations, dirty state unknown refused, no writes.
`node scripts/verify-experimental-json-snapshot.mjs` **PASS**:
3 joined Situations, 6 literal assertions, D-063/D-064/D-065
shared Markdown/HTML equivalence and atomic HTML safety.
New Windows CI step runs the real input probe on push.

Known gaps: transitive project references outside workspace,
nuget/node package contents/lock semantics, dynamic inputs,
build output and tool/runtime versions, race-free snapshot
consistency and dirty document integration. Therefore the next
step may prototype a complete static-only subset with proven
invalidation, but may not reuse Roslyn or Vitest runtime cases.

No regular VS Code reinstall/new VSIX, no manual browser PASS,
no own-app localhost integration or release.

## 2026-10-11 - D-069 static-only Vitest cache feasibility

Verified D-068 GitHub Windows CI run `38116681639`: SUCCESS.
Added `src/core/vitestStaticCache.ts` and a captured-source option
to the existing Vitest static adapter. The capture hashes actual
feature-test file bytes, relative paths, scope/source/config identity
and TypeScript version. It is validated again after parsing.
A bounded per-process cache stores detached definitions; clients
receive new clones on hits. Failed capture, aliased root/junction,
untrusted workspace, or missing/dirty editor-state evidence
bypass cache and invoke the normal source analyzer. The cache
does not touch runtime framework cases, Roslyn, .NET build,
Projection join, Markdown, HTML, or the installed extension.

Source proof `npm test` **97/97 PASS**, 0 SKIP:
8 new cache tests for hits, clone isolation, same-length same-mtime
changes, new/renamed/deleted tests, FeatureSpace/config/role
isolation, trust/dirty/unknown state, junction and bounded LRU.
The first run exposed a test-fixture naming error and unavailable
file-symlink privilege; the test now uses the canonical 4-part
description and a working Windows junction, final run all PASS.

Full real engine proof `node scripts/verify-vitest-static-cache.mjs`
PASS: 3 Situations, cold cache miss, warm hit, identical complete
projection/diagnostics versus an uncached third run. Vitest runtime
materialization and xUnit/Roslyn work still execute every time.
D-063/D-064/D-065 dual-view proof and D-068 input probe PASS.
Added Windows CI step for the end-to-end proof.

Scope: only an opt-in FullRunOptions parameter; VS Code Refresh
does not supply it. No real-world speedup established; D-067
observed static Vitest extraction as minor compared with .NET.
D-066 manual browser still PENDING; own localhost application
integration DEFERRED. No new VSIX, source fixture mutations or release.

### D-069 Windows CI discrepancy and path-alias regression

The first D-069 push `1469b99` failed its GitHub Windows unit
test gate (run 38118157671): the new static cache's initial
snapshot returned `bypass` on the hosted runner, where source
capture was expected to return `miss`; existing 89 tests passed,
8 new cache tests failed. No source runtime/Projection failure
was inferred from these test assertions.

Investigated path canonicalization differences between the main
Windows checkout and the runner's temporary workspace. The cache
now canonicalizes the **workspace root once** and checks the
expected physical source/project/file locations relative to it.
A benign alias of the workspace itself must not disable caching;
a junction of a configured source/project root still refuses cache
reuse. Added an independent aliased-workspace junction unit test.
The new Windows source suite is 98/98 PASS locally (no skips).
Remote Windows CI must independently confirm the fix.
No installed VSIX, source fixture edits or public cache activation.

### D-069 final Windows CI gate - PASS (2026-10-11)

Correction source commit `95398c8f2ad6b5300549cde2fbd17c03a8bebdbd`
passed GitHub Windows source-proof workflow:
https://github.com/AlexPastukhh/f-proj/actions/runs/38118508738
Conclusion: **SUCCESS**, including 98/98 Windows unit tests,
D-068 known-input proof, D-063/D-064/D-065 real fixtures,
and the new D-069 cold-miss/warm-hit/full-uncached
Vitest+xUnit equivalence step. This supersedes the first
D-069 CI failure in run 38118157671; it is not an
installed VSIX or ordinary-user browser acceptance.

D-069 is technically accepted as opt-in **source-only proof**.
Default VS Code Refresh remains uncached; D-066 browser manual
is PENDING, own-app localhost DEFERRED, release unapproved.

## 2026-10-11 - D-070 safety races and Vitest static-cache cost

Input state: GitHub main / primary Windows main clean and synced at
`d7d6b37c28a138663c146ce1f86a1a428e593d22`.
The previous documentation-only Windows CI
https://github.com/AlexPastukhh/f-proj/actions/runs/38118791675
was verified **SUCCESS** before D-070 work.

Updated opt-in `VitestStaticCache` to re-check trusted and explicitly
supplied empty dirty-file set after the second input capture.
Five deterministic new tests inject a same-run source edit,
a new Feature test file, or a dirty editor state between
snapshot reads on miss/hit, and assert uncached fallback with
current definitions and no unsafe cache entry.
No VS Code ordinary Refresh cache activation.

Local Windows `npm test`: **103/103 PASS**, 0 skipped.
`scripts/measure-vitest-static-cache.mjs 12`: PASS and
did not modify real fixture files. Measured median 12-run
direct vs cache-hit static analysis:
- Real maintained fixture: 2.834ms vs 7.542ms
  (1 Feature file, 2 TestDefinitions).
- Generated temp corpus: 42.814ms vs 196.241ms
  (120 Feature files, 360 TestDefinitions).
Cache-hit required two scans and was slower in both samples.
No performance claim outside these samples; benchmark threshold
is intentionally NOT used as a build gate.

Real Windows `verify-vitest-static-cache.mjs` PASS for
3 joined Situations, cold/hit/uncached identical complete
Projection, Vitest runtime and xUnit/Roslyn still invoked.
`verify-experimental-json-snapshot.mjs` PASS for
D-063/D-064/D-065 dual-view; `verify-refresh-input-probe.mjs`
PASS for D-068. Windows CI workflow includes the new timing
study and unit tests; result must be checked after push.

Decision D-070: **NO-GO** for installing or enabling the
Vitest static cache in ordinary VS Code. The editor state
would have to be read from live VS Code documents, and
filesystem scans are not atomic relative to later external
writes. The limited test fixture demonstrates cost overhead,
not a useful performance win. Favor measuring and safely
isolating actual .NET xUnit/Roslyn project-analysis costs
before attempting wider caching. No new VSIX/tag/release.
D-066 standalone browser manual acceptance stays PENDING;
integration with user's own localhost app remains DEFERRED.

### D-070 independent Windows GitHub CI gate - PASS

Source commit `55bb46135c07c76ee6fe59cb1bc949c95d367ad1`
GitHub Actions run `38119514836`, Windows source proofs:
https://github.com/AlexPastukhh/f-proj/actions/runs/38119514836
completed **SUCCESS**, including 103 unit tests, established
Roslyn/metadata/Portable Projection regressions, the D-069
full-engine cache equivalence, and the new non-gating D-070
Vitest cost measurement. This is a CI/source-only gate and
not installed-VSIX or standalone-browser manual acceptance.
D-070 NO-GO for regular Refresh cache remains in effect.

## 2026-10-11 - D-071 Roslyn/xUnit stage cost profiling

Before edits: GitHub main and clean primary Windows main both
`20138b523c499a1660886a261bd27e8725f96bd2`.
Previous D-070 documentation CI workflow `38119809453`
completed **SUCCESS**.

Added an optional `Profile` property on `WorkerRequest`;
ordinary source callers omit it. Only the Roslyn `analyze`
command emits an opt-in `FEATURE_PROJECTION_ROSLYN_PROFILE:`
structured stderr JSON record with schema version 1,
fixed stage names and numeric milliseconds. The JSON stdout
response (test definitions/diagnostics) is unchanged.
Instrumentation does not evaluate user code, cache MSBuild
or change ordinary Refresh timing/publishing behavior.

`scripts/measure-roslyn-phases.mjs 2` reads the existing
xUnit v3 project, runs the old-shaped request without profile,
then two profiled requests and two standard .NET builds.
It rejects response diffs, missing/unsafe stage diagnostics,
nonzero worker/build status and source input digest changes.
No user source files or VS Code profile were edited.

First local two-profile run: project-open 3,189.8/3,215.0ms;
compilation 2,349.0/2,275.7ms; registration scan
482.6/352.0ms; feature scan 587.8/525.8ms.
Ordinary builds 3,324.7/2,375.0ms.
Subsequent proof with the legacy request *omitting* `profile`:
worker-output equality PASS; open 4,307.6/3,806.4ms;
compilation 2,470.2/2,361.5ms; registration
391.5/449.6ms; feature scan 606.3/625.1ms;
ordinary builds 2,889.9/2,925.9ms.
Times are elapsed local samples affected by warm caches,
not validated performance improvements.

Local `npm test`: **103/103 PASS**.
`npm run build:dotnet-worker`: PASS, one pre-existing
CS7022 compiler warning regarding global entry point.
`npm run verify:packaged-worker`: PASS, 265 entries.
Real D-063/D-064/D-065 portable dual-view source proof PASS.
D-068 input drift proof PASS. The older D-069 cache
remains opt-in and disabled in ordinary VS Code.

D-071 conclusion: the expensive phases are MSBuild
project opening and Roslyn compilation, with the separate
normal `dotnet build` adding further cost. This is not
evidence that reusing a compilation without a complete
dependency closure would be sound. No skip-build switch,
cache, new user-facing command, VSIX or release was created.
Windows CI now runs this non-gating profile proof after
packaging/validating the .NET worker; post-push result
must be verified separately.

Outstanding independent gate D-066: ordinary browser HTML
source-link click still requires the single manual scenario;
the user's own localhost app is explicitly deferred.

Additional regression on the modified .NET worker:
`node scripts/verify-usage-symbol-feasibility.mjs`
**PASS**, two project scopes, three registered usages, no
unsafe partial matches. `node scripts/verify-rename-feasibility.mjs`
**PASS**, 7 proposed read-only edits, 0 mutations, negative
fail-closed checks. The `profile` parameter remains absent
from these real worker requests and does not change their
read-only Roslyn behavior.

### D-071 final Windows CI source gate - SUCCESS

For source commit `da2b25a8fd3276c463385801bfe381907c621544`,
GitHub Actions Windows source-proofs run `38120636241`
finished **SUCCESS**:
https://github.com/AlexPastukhh/f-proj/actions/runs/38120636241
Confirmed TypeScript/unit tests, established C# and Portable
Projection regressions, packaged .NET worker proof and the
new opt-in D-071 profiled/unprofiled Roslyn equivalence step.
This is source/CI acceptance only: no new VSIX or ordinary
browser manual PASS. Roslyn/xUnit cache remains NO-GO.

## 2026-10-11 - D-073 P4 Frontend single-Situation execution

Before edits: primary Windows checkout and GitHub `main`
were synced, clean at `8ddbfe4c48e392a7591ee680a573f4f0eb640bb3`.
D-071 documentation-only GitHub Windows CI `38120897950`
completed SUCCESS. User opted to pause caching (D-072
dependency-closure study deferred) and continue product features.

Implemented `src/core/situationRunPlan.ts` for pure, scoped
Situation selection. The first supported role is Frontend only
(Vitest 5): exactly one trusted and Fresh Situation/Frontend
part, corresponding static definition, known-clean editor,
matching framework-project source, and exactly one native case
for parameterized tests. Duplicate names, feature/role/scope
conflicts, partial or stale results and missing cases refuse
before any execution. All actions require explicit user initiation.

Added `src/core/vitestSituationRunner.ts`, which performs a
fresh Vitest collection of ONLY the selected file, requires
exact unique full test name and framework task line/column,
then invokes Vitest CLI with one anchored escaped pattern.
A temporary JSON report must prove exactly one executed
matching test. Zero, multiple or wrong tests result in Error,
not an invented pass. Source digest is checked before/after
the collection and after execution, and temporary report
is deleted. Explicit run may execute arbitrary test user code;
it is never triggered by Refresh, watcher or activation.

Connected source-only Testing API profile
`Run Frontend Situation`, tagged for Frontend part nodes.
Refuses Run All/group/multiple/excluded selection, untrusted,
Stale, dirty/unknown snapshot, changing config and in-flight
state drift. Results update only the chosen TestItem as Passed,
Failed or Error. No xUnit Backend or Run Both profiles.

Local Windows source `npm test`: **109/109 PASS**, zero
skips (6 new plan/collection safety tests). First unit test
run exposed a non-existent source path in the *test mock*;
corrected it to a real maintained fixture. The safety
implementation itself was not relaxed.

`node scripts/verify-p4-vitest-run.mjs`: **PASS**,
3 Frontend Situations, **3 precise passed tests**:
one ordinary + two parameterized concrete cases, with
3 actual selected executions and no authored-source edits.
One intentionally failing test executed in an OS temporary
project returned **Failed**, executed=1, not worker Error;
temporary project deleted. Refusal proofs include wrong
role, untrusted, Stale, unknown Situation and dirty state.
`node scripts/verify-experimental-json-snapshot.mjs`
D-063/D-064/D-065 Markdown+HTML regression PASS.

`npm run test:extension` with a local VS Code executable:
**PASS (exit 0)** in isolated Extension Host (not the ordinary
user installation). Dev-host emitted unrelated GitHub
authentication/AgentHost warnings. It did not independently
exercise the new profile's human Testing UI click.
Windows CI now includes the exact Vitest source execution
proof. The ordinary D-065 VSIX was not repackaged or installed;
one combined future manual session can cover existing D-066
standalone browser and new P4 Frontend profile after a verified
new candidate. Own-app localhost integration is deferred;
no release, version bump or tag.

Unresolved: cancellation cannot stop an already running child,
dependency write races outside the selected file are not atomic,
Backend xUnit/Run Both unimplemented. Next P4 slice should
address exact xUnit targeting and cancellation before release.

### D-073 independent Windows source CI - PASS (2026-10-11)

GitHub Windows source-proofs for
`96a47441b2b1eead6131ff53248492e6928a1e4e`:
https://github.com/AlexPastukhh/f-proj/actions/runs/38123512775
completed **SUCCESS**. This includes 109/109 unit tests,
the new real P4 Vitest exact-run proof (3 separate passed
Situations + an intentionally failed temporary case), the
previous Roslyn/xUnit source regression suite and package
validation, and Portable Markdown/HTML checks.

D-073 is technically accepted as source + isolated Extension
Host proof, NOT ordinary VS Code installed UI acceptance.
The prior D-065 VSIX is unchanged. Manual D-066+P4 is one
future combined scenario after a separately validated and
authorized new candidate. No release, localhost app changes
or Backend/Run Both claim.
