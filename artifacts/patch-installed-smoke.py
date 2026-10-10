from pathlib import Path
p=Path(r'C:\Users\alexa\Downloads\feature-projection-prototype-p0-0.1.0-release-gate\scripts\verify-installed-vsix.ps1')
s=p.read_text(encoding='utf-8').replace('\r\n','\n')

def rep(old,new):
    global s
    if old not in s: raise SystemExit('missing block: '+old[:120])
    s=s.replace(old,new,1)

rep('$smokeRoot = Join-Path ([IO.Path]::GetTempPath()) "feature-projection-installed-vsix-smoke-$version"\n$userData = Join-Path $smokeRoot "user-data"', '$smokeRoot = Join-Path ([IO.Path]::GetTempPath()) "feature-projection-installed-vsix-smoke-$version"\n$sourceRootFull = [IO.Path]::GetFullPath($root).TrimEnd("\\") + "\\"\n$smokeRootFull = [IO.Path]::GetFullPath($smokeRoot).TrimEnd("\\") + "\\"\nif ($smokeRootFull.ToLowerInvariant().StartsWith($sourceRootFull.ToLowerInvariant())) { throw "Installed smoke must run outside source checkout ancestry: $smokeRoot" }\n$userData = Join-Path $smokeRoot "user-data"')
rep('Write-Host "Packaged TypeScript runtime: PASS"', 'Write-Host "Packaged TypeScript runtime: PASS"\n$installedNodeModules = Join-Path $installedForRuntimeCheck.FullName "node_modules"\n$runtimeNodeDeps = @(Get-ChildItem -LiteralPath $installedNodeModules -Directory | ForEach-Object { $_.Name })\nif ($runtimeNodeDeps.Count -ne 1 -or $runtimeNodeDeps[0] -ne "typescript") { throw "Installed VSIX must package only declared runtime Node dependency typescript. Actual: $($runtimeNodeDeps -join ", ")" }\nWrite-Host "No undeclared packaged Node dependencies: PASS"')

insert='''Write-Host "`n=== 5. NORMAL INSTALLED SESSION HIDES AUTOMATION HOOKS ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm run build } "test harness build"
$driver = (Resolve-Path ".\\test\\installed-driver").Path
$suite = (Resolve-Path ".\\dist\\test\\suite\\index.js").Path
$normalUserData = Join-Path $smokeRoot "user-data-normal-hooks"
$normalResultFile = Join-Path $smokeRoot "result-normal-hooks.json"
New-Item -ItemType Directory -Force $normalUserData | Out-Null
Remove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue
$env:FEATURE_PROJECTION_SMOKE_RESULT = $normalResultFile
$env:FEATURE_PROJECTION_EXPECTED_VERSION = $version
$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions
$env:FEATURE_PROJECTION_SMOKE_MODE = "normal-hooks"
$normalArgs = @(
    $workspace,
    "--extensionDevelopmentPath=$driver",
    "--extensionTestsPath=$suite",
    "--user-data-dir=$normalUserData",
    "--extensions-dir=$extensions",
    "--disable-workspace-trust",
    "--disable-extension=github.copilot-chat",
    "--disable-gpu",
    "--skip-welcome",
    "--skip-release-notes"
)
$normalProc = Start-Process -FilePath $codeExe -ArgumentList $normalArgs -PassThru
$normalDeadline = [DateTime]::UtcNow.AddSeconds(120)
while ([DateTime]::UtcNow -lt $normalDeadline -and -not (Test-Path -LiteralPath $normalResultFile)) { Start-Sleep -Milliseconds 500 }
Remove-Item Env:FEATURE_PROJECTION_SMOKE_RESULT -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_EXPECTED_VERSION -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue
if (-not (Test-Path -LiteralPath $normalResultFile)) { throw "Normal installed hook-gating smoke did not produce result marker" }
$normalResult = Get-Content -Raw $normalResultFile | ConvertFrom-Json
if (-not $normalResult.ok -or $normalResult.mode -ne "normal-hooks" -or -not $normalResult.hiddenCommandsAbsent) { throw "Normal installed session exposed automation hooks" }
Write-Host (Get-Content -Raw $normalResultFile)

Write-Host "`n=== 6. INSTALLED EXTENSION CONFIGURE + REFRESH SMOKE ===" -ForegroundColor Cyan'''
rep('Write-Host "`n=== 5. INSTALLED EXTENSION CONFIGURE + REFRESH SMOKE ===" -ForegroundColor Cyan\nInvoke-NativeChecked { npm run build } "test harness build"', insert)

rep('$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions\n$driver = (Resolve-Path ".\\test\\installed-driver").Path', '$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions\n$env:FEATURE_PROJECTION_TEST_MODE = "1"\n$driver = (Resolve-Path ".\\test\\installed-driver").Path')
rep('Remove-Item Env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT -ErrorAction SilentlyContinue\nif (-not (Test-Path -LiteralPath $resultFile))', 'Remove-Item Env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT -ErrorAction SilentlyContinue\nRemove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue\nif (-not (Test-Path -LiteralPath $resultFile))')

rep('$env:FEATURE_PROJECTION_SMOKE_MODE = "untrusted"', '$env:FEATURE_PROJECTION_SMOKE_MODE = "untrusted"\n$env:FEATURE_PROJECTION_TEST_MODE = "1"')
rep('Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue\n    if (Test-Path -LiteralPath $disabledWorker', 'Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue\n    Remove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue\n    if (Test-Path -LiteralPath $disabledWorker')

p.write_text(s,encoding='utf-8',newline='\n')
print('PATCH_INSTALLED_SMOKE_DONE')
