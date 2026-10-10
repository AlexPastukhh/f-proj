# Next Feature Projection MVP — batched acceptance and release gate

Status: **active plan, not a release approval** (D-060, 2026-10-10).

## In scope for the next cumulative candidate

- Accepted Windows-first 0.1.0 alpha: Configure, explicit Refresh,
  Projection, Testing API and source links.
- P1 source safety: registered C# responsibility/assertion helpers,
  xUnit/Vitest real fixtures and fail-closed ambiguity diagnostics.
- P2 bounded parameterized-case navigation, scoped Projection ↔ Test
  Explorer links and read-only registered C# Usage View.
- P2/8.3d **experimental read-only** registered C# Rename Preview.
  It is neither an editor Rename nor an applicable patch.

**Not in this MVP:** mutating/cross-project Rename (8.3e), stable
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
- Preview `User.Authenticate(string)` → `AuthenticateCredentials`
  (4 read-only positions), and `FeatureChecks.AssertDenied(bool)` →
  `AssertAccessDenied` (3 read-only positions). Check one refusal.
- Confirm no C# files changed, no Apply control exists and no
  generic VS Code RenameProvider was added.
- Return a single PASS/FAIL report. Retest only failed items after fixes.

Restricted Mode, hidden automation-hook isolation, source SHA and
full regression stay *automated*. Do not ask for redundant manual clicks.

## Release go/no-go

Must have: clean, pushed Git HEAD; Windows source test PASS; isolated
installed VSIX technical PASS (including Restricted Mode and P2
regressions); preserved historical candidate checksums; one stable
candidate hash; one combined manual acceptance PASS; documented gaps;
and explicit approval for tag/version/publication. No implicit release.

**Current:** packaging/CI stabilization. P2/8.3d manual acceptance is
**deferred to this gate**, not waived.
