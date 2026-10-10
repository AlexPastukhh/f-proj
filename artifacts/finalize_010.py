from pathlib import Path
root = Path(r'C:\\Users\\alexa\\Downloads\\feature-projection-prototype-p0-0.1.0-release-gate')

plan = root / 'docs/plan/MASTER-PLAN.md'
text = plan.read_text(encoding='utf-8')
text = text.replace(
    'Status: living execution plan for `0.1.0-release-gate`; automated release acceptance is green and one final manual installed click-through remains.',
    'Status: `0.1.0` Windows-first alpha release gate complete; next active work is P1 projection-safety hardening.'
)
start = text.index('### 6.5 0.1.0 release gate')
end = text.index('## 7. P1 hardening', start)
replacement = '''### 6.5 0.1.0 release gate — DONE

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
'''
replacement += '''
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

'''
text = text[:start] + replacement + text[end:]
text = text.replace(
'''DONE-5  6.4 second-workspace acceptance + framework-project-scoped case correlation (0.0.16)
NEXT-1  finish 6.5 with one ordinary-user manual installed 0.1.0 click-through
NEXT-2  complete high-value projection-safety fixtures
NEXT-3  retained v11 responsibility-registration proof''',
'''DONE-5  6.4 second-workspace acceptance + framework-project-scoped case correlation (0.0.16)
DONE-6  6.5 0.1.0 Windows-first release gate
NEXT-1  complete high-value projection-safety fixtures
NEXT-2  retained v11 responsibility-registration proof
NEXT-3  custom assertion helper registration / retained first-pair hardening'''
)
plan.write_text(text, encoding='utf-8')

decisions = root / 'docs/plan/DECISIONS-AND-DELTAS.md'
with decisions.open('a', encoding='utf-8', newline='\n') as f:
    f.write('''

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
''' )
review = root / 'docs/plan/REVIEW-LOG.md'
with review.open('a', encoding='utf-8', newline='\n') as f:
    f.write('''

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
''' )

status = root / 'PROTOTYPE-STATUS.md'
status.write_text('''# Prototype status — 0.1.0 Windows-first alpha

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

## Next

Active work moves to P1 hardening: complete the high-value projection-safety fixture matrix, then the retained registered-responsibility proof. Exact parameterized case navigation, additional adapters, Run/Debug profiles, cache architecture, and full multi-root support remain later work.

## Packaging warnings not treated as local-alpha blockers

`vsce` still warns about a missing repository field and LICENSE file. These remain marketplace/publication metadata work; local VSIX packaging and installed acceptance succeed.
''', encoding='utf-8')

print('FINAL_DOCS_DONE')
