# Artifact inventory (local-only binaries)

Repository: `C:\Users\alexa\Repos\feature-projection`

The binaries listed below were retained as byte-identical copies in `artifacts/`
for local acceptance reproducibility, but `*.vsix` and `*.zip` are intentionally
**ignored by Git**. Source code, scripts, fixtures and docs are versioned.

The original release was also copied from `Downloads` to `artifacts/releases/`.
Do not confuse a technical/acceptance candidate with a new public release.

| Relative path | Bytes | SHA-256 |
|---|---:|---|
| `artifacts/feature-projection-prototype-p0-0.1.0.vsix` | 20457995 | `49704A1072FD571BFEC94139BBC865F9B75F40CD899E6CDC531E9E605E951CC1` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p1-acceptance-candidate.vsix` | 20460132 | `44284D06F1A5C67A24CDF52B03F372A7D12249C3258A2A1F6C2823061D751989` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-cross-navigation-assertions-candidate.vsix` | 20463808 | `88E8030EC53220D05682F077D7F7E9FEC25A91C05F59902F45A9673528412F62` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-cross-navigation-candidate.vsix` | 20463626 | `F6EA46AB06D48A5067D68405863DB1280EC7C1564972EC0F4659E8DB71E434BB` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-navigation-candidate.vsix` | 20462673 | `6F54B99A8D250BBFAD0BC114D37C22E7C2558EF6A36EAC9530B07BAB782AA0C8` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-registered-usages-candidate.vsix` | 20474051 | `8D33A18EA642410EC31946B826A45AB34E0EA8F12E262FBCAE4ACE3B0D1BBB31` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-registered-usages-scoped-candidate.vsix` | 20474162 | `7C259D336C89C961E61827E0AD6E92508BB0125CE5C0776946C17D0067275CE1` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-reveal-palette-candidate.vsix` | 20464361 | `6C3F45B0D3469AD4B9AF7BAE81724D6AEF0C96C604B18F82D4B06E2C86FE15EA` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-reveal-palette-fixed-candidate.vsix` | 20464402 | `D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-candidate.vsix` | 20489453 | `65420265212EE335093A08D5A1735D588DC96F1C2E71649DFD9A344BC0E384FA` |
| `artifacts/feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-fixed-candidate.vsix` | 20489453 | `23C01AC1CEFFE89DE9D2A38A5CEC17ED2494636F7D9E9BFB7EDA47409753B416` |
| `artifacts/feature-projection-prototype-p0-0.1.0-mvp-batched-acceptance-candidate.vsix` | 20490576 | `54D4B3D1F5C17B3657C91AA299A129B66D146A72178633221FBC2FB0A3D83A29` |
| `artifacts/releases/feature-projection-prototype-p0-0.1.0.vsix` | 20457995 | `49704A1072FD571BFEC94139BBC865F9B75F40CD899E6CDC531E9E605E951CC1` |
| `artifacts/releases/feature-projection-prototype-p0-0.1.0-release.zip` | 31853862 | `16D23889C6702D392B9935E6794034EBA1D492FB05BC496F6FE865F28D6C8D08` |

Prior failed research builds are preserved as historical evidence and are **not**
recommended for installation. The cumulative MVP **installed technical PASS / ordinary-user manual PENDING** candidate is:
`artifacts/feature-projection-prototype-p0-0.1.0-mvp-batched-acceptance-candidate.vsix`.
The original accepted 0.1.0 release has not been republished.

For repository portability, new verification workflows should use paths relative
to this Git checkout instead of assuming the old `Downloads` checkout persists.
Installed acceptance reports are kept locally under `artifacts/local-acceptance-results/` and intentionally excluded from Git. D-061 contains the verified result summary.
