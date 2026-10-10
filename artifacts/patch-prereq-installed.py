from pathlib import Path
p=Path(r'C:\Users\alexa\Downloads\feature-projection-prototype-p0-0.1.0-release-gate\scripts\verify-installed-vsix.ps1')
s=p.read_text(encoding='utf-8').replace('\r\n','\n')
anchor='Write-Host "`n=== 6. PREPARE RESTRICTED-MODE WORKSPACE ===" -ForegroundColor Cyan'
if anchor not in s: raise SystemExit('restricted anchor missing')
block=r'''Write-Host "`n=== 7. TRUSTED MISSING-NODE DIAGNOSTIC ===" -ForegroundColor Cyan
$nodePrereqWorkspace = Join-Path $smokeRoot "workspace-prereq-node"
New-Item -ItemType Directory -Force $nodePrereqWorkspace | Out-Null
Copy-DirectoryExcept (Resolve-Path ".\fixtures\workspace\frontend").Path (Join-Path $nodePrereqWorkspace "frontend") @("node_modules")
$nodePrereqVscode = Join-Path $nodePrereqWorkspace ".vscode"
New-Item -ItemType Directory -Force $nodePrereqVscode | Out-Null
$nodePrereqSettings = @{
    "featureProjection.nodePath" = (Join-Path $nodePrereqWorkspace "definitely-missing-node.exe")
    "featureProjection.featureSpaces" = @(
        @{ id="app"; sources=@(
            @{ id="frontend"; role="frontend"; root="frontend/src/features"; adapter="vitest-5"; frameworkProject="frontend"; configFile="vitest.config.ts" }
        ) }
    )
}
[IO.File]::WriteAllText((Join-Path $nodePrereqVscode "settings.json"), ($nodePrereqSettings | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
$nodePrereqUserData = Join-Path $smokeRoot "user-data-prereq-node"
$nodePrereqResult = Join-Path $smokeRoot "result-prereq-node.json"
New-Item -ItemType Directory -Force $nodePrereqUserData | Out-Null
$env:FEATURE_PROJECTION_SMOKE_RESULT = $nodePrereqResult
$env:FEATURE_PROJECTION_EXPECTED_VERSION = $version
$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions
$env:FEATURE_PROJECTION_SMOKE_MODE = "prerequisite-node"
$env:FEATURE_PROJECTION_TEST_MODE = "1"
$nodePrereqArgs = @(
    $nodePrereqWorkspace,
    "--extensionDevelopmentPath=$driver",
    "--extensionTestsPath=$suite",
    "--user-data-dir=$nodePrereqUserData",
    "--extensions-dir=$extensions",
    "--disable-workspace-trust",
    "--disable-extension=github.copilot-chat",
    "--disable-gpu",
    "--skip-welcome",
    "--skip-release-notes"
)
$nodePrereqProc = Start-Process -FilePath $codeExe -ArgumentList $nodePrereqArgs -PassThru
$nodePrereqDeadline = [DateTime]::UtcNow.AddSeconds(120)
while ([DateTime]::UtcNow -lt $nodePrereqDeadline -and -not (Test-Path -LiteralPath $nodePrereqResult)) { Start-Sleep -Milliseconds 500 }
Remove-Item Env:FEATURE_PROJECTION_SMOKE_RESULT -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_EXPECTED_VERSION -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue
if (-not (Test-Path -LiteralPath $nodePrereqResult)) { throw "Missing-Node installed smoke did not produce result marker" }
$nodePrereq = Get-Content -Raw $nodePrereqResult | ConvertFrom-Json
if (-not $nodePrereq.ok -or $nodePrereq.ruleId -ne "worker/node-runtime-missing") { throw "Installed missing-Node diagnostic was not actionable" }
Write-Host (Get-Content -Raw $nodePrereqResult)

Write-Host "`n=== 8. TRUSTED INCOMPATIBLE-DOTNET DIAGNOSTIC ===" -ForegroundColor Cyan
$dotnetPrereqWorkspace = Join-Path $smokeRoot "workspace-prereq-dotnet"
New-Item -ItemType Directory -Force $dotnetPrereqWorkspace | Out-Null
Copy-DirectoryExcept (Resolve-Path ".\fixtures\workspace\backend").Path (Join-Path $dotnetPrereqWorkspace "backend") @("bin", "obj")
$dotnetPrereqVscode = Join-Path $dotnetPrereqWorkspace ".vscode"
New-Item -ItemType Directory -Force $dotnetPrereqVscode | Out-Null
$dotnetPrereqSettings = @{
    "featureProjection.featureSpaces" = @(
        @{ id="app"; sources=@(
            @{ id="backend"; role="backend"; root="backend/Features"; adapter="xunit-v3"; frameworkProject="backend"; projectFile="Backend.FeatureTests.csproj" }
        ) }
    )
}
[IO.File]::WriteAllText((Join-Path $dotnetPrereqVscode "settings.json"), ($dotnetPrereqSettings | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
$installedRuntimeConfig = Join-Path $installedForRuntimeCheck.FullName "workers\dotnet\runtime\FeatureProjection.DotNetWorker.runtimeconfig.json"
if (-not (Test-Path -LiteralPath $installedRuntimeConfig -PathType Leaf)) { throw "Installed .NET worker runtimeconfig missing: $installedRuntimeConfig" }
$runtimeConfigBackup = [IO.File]::ReadAllText($installedRuntimeConfig)
$impossibleRuntimeConfig = '{"runtimeOptions":{"tfm":"net99.0","framework":{"name":"Microsoft.NETCore.App","version":"99.0.0"}}}'
$dotnetPrereqUserData = Join-Path $smokeRoot "user-data-prereq-dotnet"
$dotnetPrereqResult = Join-Path $smokeRoot "result-prereq-dotnet.json"
New-Item -ItemType Directory -Force $dotnetPrereqUserData | Out-Null
try {
    [IO.File]::WriteAllText($installedRuntimeConfig, $impossibleRuntimeConfig, [Text.UTF8Encoding]::new($false))
    $env:FEATURE_PROJECTION_SMOKE_RESULT = $dotnetPrereqResult
    $env:FEATURE_PROJECTION_EXPECTED_VERSION = $version
    $env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions
    $env:FEATURE_PROJECTION_SMOKE_MODE = "prerequisite-dotnet"
    $env:FEATURE_PROJECTION_TEST_MODE = "1"
    $dotnetPrereqArgs = @(
        $dotnetPrereqWorkspace,
        "--extensionDevelopmentPath=$driver",
        "--extensionTestsPath=$suite",
        "--user-data-dir=$dotnetPrereqUserData",
        "--extensions-dir=$extensions",
        "--disable-workspace-trust",
        "--disable-extension=github.copilot-chat",
        "--disable-gpu",
        "--skip-welcome",
        "--skip-release-notes"
    )
    $dotnetPrereqProc = Start-Process -FilePath $codeExe -ArgumentList $dotnetPrereqArgs -PassThru
    $dotnetPrereqDeadline = [DateTime]::UtcNow.AddSeconds(120)
    while ([DateTime]::UtcNow -lt $dotnetPrereqDeadline -and -not (Test-Path -LiteralPath $dotnetPrereqResult)) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-Path -LiteralPath $dotnetPrereqResult)) { throw "Incompatible-.NET installed smoke did not produce result marker" }
    $dotnetPrereq = Get-Content -Raw $dotnetPrereqResult | ConvertFrom-Json
    if (-not $dotnetPrereq.ok -or $dotnetPrereq.ruleId -ne "worker/dotnet-prerequisite-unavailable") { throw "Installed incompatible-.NET diagnostic was not actionable" }
    Write-Host (Get-Content -Raw $dotnetPrereqResult)
} finally {
    Remove-Item Env:FEATURE_PROJECTION_SMOKE_RESULT -ErrorAction SilentlyContinue
    Remove-Item Env:FEATURE_PROJECTION_EXPECTED_VERSION -ErrorAction SilentlyContinue
    Remove-Item Env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue
    [IO.File]::WriteAllText($installedRuntimeConfig, $runtimeConfigBackup, [Text.UTF8Encoding]::new($false))
}

Write-Host "`n=== 9. PREPARE RESTRICTED-MODE WORKSPACE ===" -ForegroundColor Cyan'''
s=s.replace(anchor,block,1)
p.write_text(s,encoding='utf-8',newline='\n')
print('PATCH_PREREQ_INSTALLED_DONE')
