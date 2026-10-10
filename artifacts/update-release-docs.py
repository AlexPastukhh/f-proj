from pathlib import Path
root=Path(r'C:\Users\alexa\Downloads\feature-projection-prototype-p0-0.1.0-release-gate')

master=root/'docs/plan/MASTER-PLAN.md'
s=master.read_text(encoding='utf-8')
s=s.replace("Status: living execution plan after prototype `0.0.16-scope-isolation`; current working slice: `6.5 0.1.0 release gate`.","Status: living execution plan for `0.1.0-release-gate`; automated release acceptance is green and one final manual installed click-through remains.")
start=s.index('### 6.5 0.1.0 release gate')
end=s.index('\n## 7. P1 hardening', start)
block='''### 6.5 0.1.0 release gate — AUTOMATED PASS / MANUAL CLICK-THROUGH PENDING

0.1.0 is a Windows-first alpha. Cross-platform installed acceptance remains later hardening rather than being implied by the current Windows proof.

Implemented and automatically proven:

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
```

Current automated evidence:

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

Remaining release-gate item:

```text
one real manual click-through in an ordinary user VS Code session:
install 0.1.0 VSIX -> open prepared clean workspace -> Configure frontend -> Configure backend -> explicit Refresh -> inspect projection/navigation
```

Release scope:

```text
acceptance platform: Windows x64
Vitest runtime prerequisite: supported external Node.js installation
xUnit runtime prerequisite: compatible .NET SDK/runtime for the configured project
```

Do not mark 6.5 DONE or call the alpha released until the manual click-through above is recorded.
'''
s=s[:start]+block+s[end:]
s=s.replace('NEXT-1  6.5 0.1.0 Windows-first release gate\nNEXT-2  complete high-value projection-safety fixtures\nNEXT-3  retained v11 responsibility-registration proof', 'NEXT-1  finish 6.5 with one ordinary-user manual installed 0.1.0 click-through\nNEXT-2  complete high-value projection-safety fixtures\nNEXT-3  retained v11 responsibility-registration proof')
master.write_text(s,encoding='utf-8')

decisions=root/'docs/plan/DECISIONS-AND-DELTAS.md'
d=decisions.read_text(encoding='utf-8')
if '## D-041 — 0.1.0 automated release gate closes D-033, D-035 and D-036' not in d:
    d += '''\n\n---\n\n## D-041 — 0.1.0 automated release gate closes D-033, D-035 and D-036\n\nStatus: CONFIRMED / IMPLEMENTED IN 0.1.0 RELEASE CANDIDATE\n\nThe pre-0.1 release gaps recorded by D-033, D-035 and D-036 are now implemented and proven automatically.\n\n```text\nD-033: config.buildTimeoutMs -> trusted xUnit dotnet-build timeout\nD-035: featureProjection.__configureTest and __debugState register only when FEATURE_PROJECTION_TEST_MODE=1\nD-036: missing Node -> worker/node-runtime-missing with install/PATH/nodePath guidance\nD-036: missing/incompatible .NET -> worker/dotnet-prerequisite-unavailable with SDK/runtime/PATH guidance\n```\n\nInstalled acceptance additionally proves that a normal installed session does not expose either hidden command, while test-mode installed acceptance still drives the shared Configure/debug transaction. The installed VSIX runs under `%TEMP%` outside source-checkout ancestry and contains only `typescript` under `node_modules`, preserving D-037 dependency isolation.\n\nEvidence:\n\n```text\nnpm test                                           40/40 PASS\nreal primary Vitest/xUnit/E2E                      PASS\ninstalled second-workspace FeatureScope acceptance PASS\nnormal installed hidden commands absent            PASS\ntrusted missing-Node diagnostic                     PASS\ntrusted incompatible-.NET diagnostic                PASS\ntrusted installed Configure/navigation              PASS\ninstalled Restricted Mode                           PASS\n```\n\nThe only remaining 6.5 item is the intentionally manual ordinary-user install/Configure/Refresh/inspect click-through. Therefore this delta closes the automated technical gaps but does not by itself mark 6.5 DONE.\n'''
    decisions.write_text(d,encoding='utf-8')

review=root/'docs/plan/REVIEW-LOG.md'
r=review.read_text(encoding='utf-8')
if '## 2026-10-06 — 6.5 automated release-gate implementation' not in r:
    r += '''\n\n## 2026-10-06 — 6.5 automated release-gate implementation\n\n### Object and scope\n\nImplemented the automated part of the 0.1.0 Windows-first release gate in `0.1.0-release-gate`. Scope: public build timeout semantics, test-only hidden automation hooks, actionable Node/.NET prerequisite diagnostics, installed dependency isolation, and full regression of the previously accepted primary and second workspaces.\n\n### Confirmed pre-existing gaps and fixes\n\n1. `buildTimeoutMs` was read from settings but ignored by trusted xUnit project builds; the engine derived build timeout from `workerTimeoutMs`. The engine now consumes `config.buildTimeoutMs` directly.\n2. Hidden `__configureTest` and `__debugState` commands were registered in normal installed sessions. They now register only when `FEATURE_PROJECTION_TEST_MODE=1`; a normal installed-VSIX smoke proves both are absent.\n3. Missing Node previously degraded to a generic spawn/materialization failure. Explicitly configured missing `nodePath` remains authoritative so Refresh can emit `worker/node-runtime-missing` with installation/PATH/nodePath guidance.\n4. Missing or incompatible .NET project analysis previously surfaced as a generic C# analysis failure. Runtime output is now classified as `worker/dotnet-prerequisite-unavailable` with SDK/runtime/PATH guidance.\n\n### Acceptance evidence\n\n```text\nNode/core regression suite                         40/40 PASS\nreal primary Vitest                                3/3 PASS\nreal primary backend xUnit                         3/3 PASS\nreal xUnit concrete materialization                2 cases PASS\nreal primary E2E                                   3 Situations PASS\ninstalled second workspace                         2 FeatureSpaces / 6 Situations / Fresh PASS\nnormal installed session hidden hooks              absent PASS\ntrusted installed Configure/Refresh/navigation     PASS\ntrusted installed missing Node diagnostic          PASS\ntrusted installed incompatible .NET diagnostic     PASS\ninstalled Restricted Mode                          PASS\nVSIX outside source-checkout ancestry               PASS\nonly declared production Node dependency packaged  TypeScript PASS\n```\n\n### Deferred / remaining\n\nThe release gate is not yet DONE. One deliberate manual acceptance remains in an ordinary user VS Code session: install the 0.1.0 VSIX, Configure frontend and backend from a clean prepared workspace, run explicit Refresh, inspect the projection, and exercise source navigation. Marketplace repository/LICENSE metadata remains publication work and is not claimed solved by the local Windows-first alpha gate.\n'''
    review.write_text(r,encoding='utf-8')

status=root/'PROTOTYPE-STATUS.md'
status.write_text('''# Prototype status — 0.1.0 release candidate\n\nMaster Plan units 6.1 through 6.4 are complete. The automated portion of 6.5 is now green. The only remaining 0.1.0 Windows-first alpha gate is one ordinary-user manual installed click-through.\n\n## Current packaged shape\n\n- Version: `0.1.0`\n- Artifact: `artifacts/feature-projection-prototype-p0-0.1.0.vsix`\n- VSIX size: ~19.51 MB compressed\n- `.NET worker`: framework-dependent artifact under `workers/dotnet/runtime/`\n- Runtime Node dependency: `typescript@5.8.3`, explicitly packaged\n- Installed acceptance runs under OS temp storage outside source-checkout ancestry.\n- Normal installed sessions do not register hidden automation/debug commands.\n\n## 0.1.0 release-gate corrections\n\n```text\nfeatureProjection.buildTimeoutMs -> trusted xUnit project build timeout\nhidden __configureTest / __debugState -> explicit FEATURE_PROJECTION_TEST_MODE only\nmissing external Node -> worker/node-runtime-missing with actionable guidance\nmissing/incompatible .NET -> worker/dotnet-prerequisite-unavailable with actionable guidance\n```\n\n## Automated acceptance evidence\n\n```text\nnpm test                                      40/40 PASS\nprimary real Vitest                           3/3 PASS\nprimary real backend xUnit                    3/3 PASS\nprimary xUnit concrete cases                  2 PASS\nprimary real E2E projection                   3 Situations PASS\nsecond installed workspace                    2 FeatureSpaces / 6 Situations / Fresh PASS\nnormal installed hidden automation commands   absent PASS\ntrusted missing-Node diagnostic               PASS\ntrusted incompatible-.NET diagnostic          PASS\ntrusted installed Configure/navigation        PASS\ninstalled Restricted Mode                     PASS\npackaged TypeScript runtime                    PASS\nno undeclared packaged Node dependencies       PASS\n```\n\n## Release scope\n\n0.1.0 is a Windows x64 alpha. Vitest materialization requires a supported external Node.js installation. xUnit analysis/materialization requires a compatible .NET SDK/runtime for the configured project.\n\n## Remaining gate\n\nOne manual click-through in an ordinary user VS Code session remains:\n\n```text\ninstall feature-projection-prototype-p0-0.1.0.vsix\nopen prepared clean workspace\nConfigure frontend\nConfigure backend\nexplicit Refresh\ninspect the 3-Situation projection\nopen at least one Frontend and one Backend source link\n```\n\nDo not mark 6.5 DONE until that manual acceptance is recorded.\n\n## Packaging warnings not treated as local-alpha blockers\n\n`vsce` still warns about a missing repository field and LICENSE file. These remain marketplace/publication metadata work; local VSIX packaging and installed acceptance succeed.\n''',encoding='utf-8')
print('RELEASE_DOCS_UPDATED')
