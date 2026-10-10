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
