# Next Feature Projection MVP — batched acceptance and release gate

Status: **active plan, not a release approval** (D-060, 2026-10-10).

## In scope for the next cumulative candidate

- Accepted Windows-first 0.1.0 alpha: Configure, explicit Refresh,
  Projection, Testing API and source links.
- P1 source safety: registered C# responsibility/assertion helpers,
  xUnit/Vitest real fixtures and fail-closed ambiguity diagnostics.
- P2 bounded parameterized-case navigation, scoped Projection ↔ Test
  Explorer links and read-only registered C# Usage View.
- P2/8.3b **read-only registered C# usages** remains user-facing.
- **Rename Preview is excluded from this MVP (D-062).** Research code,
  read-only Roslyn feasibility and isolated test hooks remain for later
  development; no ordinary-user Command Palette action is contributed.

**Not in this MVP:** user-visible Rename Preview or mutating/cross-project Rename (8.3e), stable
JSON/export (7.4), P3 caches, P4 Run profiles, P5 extra adapters,
and P6 broader runtime/discovery. Do not infer a license or a publish
approval from this plan; version bump/publication require final consent.

## Development without repeated manual installs

1. Work in `C:\Users\alexa\Repos\feature-projection`, commit
   scoped code/docs changes, and push to `AlexPastukhh/f-proj`.
2. Run relevant source unit/Roslyn proof tests for every change;
   GitHub Actions adds a Windows source gate on push/PR.
3. Run isolated installed VSIX technical smoke with trusted/restricted
   profiles, source links, CodeLens, scope isolation and prior P2 regression.
   Technical PASS **never** means ordinary-user manual PASS.
4. Build one cumulative candidate under a new filename, with SHA-256.
   Preserve previous accepted and rejected VSIX/ZIP byte-for-byte.
5. Ask the user for **one** manual session only when candidate gates pass.

## One final ordinary-user acceptance session

Target: ~10–15 minutes of user interaction if no blockers.
One candidate installation, one prepared trusted fixture workspace
and **one compact acceptance checklist**, not repeated micro-steps.
Successful steps need no screenshots; request evidence for failures only.

- Install cumulative VSIX; verify extension activation.
- Configure and explicitly Refresh; inspect Projection + Test Explorer.
- Navigate one exact parameterized case, Projection → Test Explorer →
  Projection, plus one exact assertion/source link.
- Show `responsibility/backend` and `assertions/backend` C# usages;
  check symbols, scoped references and one source jump.
- Confirm **Rename Preview is absent** from the Command Palette. No
  Rename/Apply control is contributed by Feature Projection. Research
  proofs of Roslyn rename remain automatic, not manual acceptance steps.
- Confirm the visited C# source files retain their original method names.
  Source SHA snapshots remain an independent automated check.
- Return a single PASS/FAIL report. Retest only failed items after fixes.

Restricted Mode, hidden automation-hook isolation, source SHA and
full regression stay *automated*. Do not ask for redundant manual clicks.

## Release go/no-go

Must have: clean, pushed Git HEAD; Windows source test PASS; isolated
installed VSIX technical PASS (including Restricted Mode and P2
regressions); preserved historical candidate checksums; one stable
candidate hash; one combined manual acceptance PASS; documented gaps;
and explicit approval for tag/version/publication. No implicit release.

**Current (D-062):** user feedback on the read-only Rename Preview exposed
an ambiguous UX: the user expected a completed rename but received
read-only links. The user explicitly approved **excluding Rename Preview**
from the next MVP. The earlier D-061 candidate remains historical evidence,
**not** the final approved release candidate. Ordinary-user manual
acceptance is still **PENDING**, not silently accepted. The replacement
no-Rename candidate is
`artifacts/feature-projection-prototype-p0-0.1.0-mvp-no-rename-preview-candidate.vsix`
(20,490,605 bytes; SHA-256
`09E71D305560DD7E3ECCF7E161DA35FA6585D05992B4E9CE36AFD7B25FCB68A0`).
The new candidate has passed its own **isolated installed technical
acceptance**: normal public command absence (including direct invocation),
internal read-only research smoke, Configure/Refresh, Registered C# Usages,
Restricted Mode and previous P2 cross-navigation PASS. **Only the remaining
user-facing manual acceptance and release go/no-go are outstanding.**

The aggregate installed regression is reproducible with
`powershell -NoProfile -File scripts/verify-mvp-installed-aggregate.ps1`.
Its isolated result markers are reconciled by
`scripts/verify-mvp-aggregate-report.ps1`; local JSON evidence is in the
Git-ignored `artifacts/local-acceptance-results/` folder.
See D-061 for the PowerShell 5.1 report-writing issue and recovery.

## D-066 P3 browser supplement - one session, not a new release

The D-062 candidate above is historical and its manual status remains
provisional. For P3 dual HTML/Markdown ordinary acceptance, the only
recommended candidate is the **final** D-065 source-watch-fixed VSIX:
20,500,477 bytes, SHA-256
`4468280CE13A55FFDAE69CA7F086F6FC68F9342DF9EC7C393692688AB4091380`.
As of the 2026-10-11 D-066 preflight it is technically accepted in
an isolated Extension Host, **not** installed in ordinary VS Code,
which has an older build without the HTML command.

Combine the original abbreviated Projection/source navigation checks
with the one browser/localhost gate in
`docs/plan/PORTABLE-PROJECTION-INTEGRATION.md`. Do not ask the user
to recheck automated Stale/Restricted/Roslyn/source-hash regressions.
Obtain approval before replacing the ordinary extension or setting a
foreign app's static directory. Manual PASS and release go/no-go
remain separate and PENDING. No version bump/tag/publish authorized.

### D-066 ordinary install verified; browser/manual gate still open

After the D-066 preflight, the user explicitly authorized installing
the final D-065 VSIX in ordinary VS Code. The CLI returned exit 0,
the public HTML command is contributed and the compiled HTML modules
match the archived VSIX byte-for-byte. The older installed extension
was backed up locally. The running VS Code window has **not** been
reloaded/accepted as part of this CLI check.

Next one short manual session is **standalone HTML only**:
Reload Window, trusted fixture/Refresh/Fresh, Situation anchor and
`vscode://file` source jump. Integration with the user's own
localhost app is deferred, not required in this session.
No manual PASS, release approval, tag or publication.

## D-073 P4 Frontend source-only gate and future combined manual check

The first P4 `Run Frontend Situation` Testing API profile is
implemented in source only and is NOT present in the ordinary
installed D-065 candidate. Do not replace the installed
extension just to collect repeated manual smoke results.

When a future SHA-pinned VSIX is explicitly approved for
ordinary installation, combine D-066 and P4 in ONE short
session: Reload Window -> trusted prepared workspace ->
Refresh/Fresh -> Open HTML Projection, follow one Situation
anchor and one vscode source link -> in Testing, run exactly
one Frontend part using `Run Frontend Situation` and confirm
Passed. There is no Backend or Both profile yet. All Stale,
Restricted, duplicate, dirty-buffer and wrong-role refusals
are covered by automated tests; no extra manual clicks.
The user's localhost application is explicitly deferred.
This is not release approval or an installed UI PASS.

## D-074 P4 Backend Fact joins the future single manual gate

New source code offers `Run Backend Fact` only for direct,
uniquely identified xUnit Facts; selected Theory rows are
intentionally disabled. Existing D-065 ordinary VS Code
installation has NOT been replaced, so no ordinary installed
P4 manual PASS exists.

After future new SHA-pinned VSIX validation and explicit
installation permission, **combine** D-066 standalone HTML,
P4 Frontend and P4 Backend into ONE short manual session:
Reload Window; trusted fixture Refresh/Fresh; Open HTML and
follow one Situation anchor plus one vscode source link;
in Testing, invoke Run Frontend Situation for one part
and Run Backend Fact for the direct
`refresh_token_expired` Backend part; confirm each Passed.
No manual attempt to execute Theory rows or the user's
localhost application. This is not release approval.

## D-075 source P4 Backend name and Theory limitation

D-074 `Run Backend Fact` is superseded in the **source tree**
by `Run Backend Situation`. A selected xUnit Theory row is now
eligible only if native `-preEnumerateTheories` exposes one
unique runnable row ID, freshly matched by exact name,
class and method. The prepared LoginCase fixture continues
to return Error/executed=0 for its folded Theory rows.

Do NOT install/repackage the ordinary D-065 VSIX yet or
create separate manual scenarios. The future short combined
manual gate remains: Reload Window; trusted fixture
Refresh/Fresh; HTML Situation anchor and vscode source
link; one Frontend Situation Passed and the existing
direct Backend Fact Passed using `Run Backend Situation`.
The serialized-Theory behavior is already covered by
automated Windows evidence, not another manual click.
Own-app localhost integration DEFERRED; release unapproved.
