$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

function Invoke-NativeChecked {
    param([scriptblock]$Command, [string]$Name)
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

function Find-CodeExe {
    $candidates = @()
    if ($env:VSCODE_EXECUTABLE_PATH) { $candidates += $env:VSCODE_EXECUTABLE_PATH }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe") }
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles "Microsoft VS Code\Code.exe") }
    $found = @($candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }) | Select-Object -First 1
    if (-not $found) { throw "Installed VS Code executable not found" }
    return (Resolve-Path -LiteralPath $found).Path
}

function Copy-DirectoryExcept {
    param([string]$Source, [string]$Target, [string[]]$ExcludeNames)
    New-Item -ItemType Directory -Force $Target | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Where-Object { $_.Name -notin $ExcludeNames } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Target -Recurse -Force
    }
}

Write-Host "`n=== 1. PREPARE 0.0.16 PACKAGE ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm install } "npm install"
foreach ($project in @("account-web", "billing-web")) {
    Push-Location (Join-Path $root "fixtures\workspace-scope-isolation\apps\$project")
    Invoke-NativeChecked { npm install } "$project npm install"
    Pop-Location
}
Invoke-NativeChecked { npm run prepare:dotnet-worker } "prepare packaged .NET worker"
Invoke-NativeChecked { npm run package:vsix } "VSIX package"

$version = (Get-Content -Raw ".\package.json" | ConvertFrom-Json).version
$extensionId = "local-prototype.feature-projection-prototype-p0"
$vsix = (Resolve-Path ".\artifacts\feature-projection-prototype-p0-$version.vsix").Path
$codeExe = Find-CodeExe
$codeRoot = Split-Path -Parent $codeExe
$codeCli = Join-Path $codeRoot "bin\code.cmd"
if (-not (Test-Path -LiteralPath $codeCli -PathType Leaf)) { $codeCli = $codeExe }

$smokeRoot = Join-Path ([IO.Path]::GetTempPath()) "feature-projection-scope-isolation-$version"
$userData = Join-Path $smokeRoot "user-data"
$extensions = Join-Path $smokeRoot "extensions"
$resultFile = Join-Path $smokeRoot "result.json"
Remove-Item $smokeRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $userData,$extensions | Out-Null
Invoke-NativeChecked { & $codeCli --user-data-dir $userData --extensions-dir $extensions --install-extension $vsix --force } "VSIX install"
$installed = (& $codeCli --user-data-dir $userData --extensions-dir $extensions --list-extensions --show-versions) -join "`n"
if ($installed -notmatch [regex]::Escape("$extensionId@$version")) { throw "Installed extension identity mismatch: $installed" }

Write-Host "`n=== 2. PREPARE SECOND WORKSPACE FROM EMPTY SETTINGS ===" -ForegroundColor Cyan
$fixture = (Resolve-Path ".\fixtures\workspace-scope-isolation").Path
$workspace = Join-Path $smokeRoot "workspace"
New-Item -ItemType Directory -Force $workspace | Out-Null

foreach ($project in @("account-web", "billing-web")) {
    $source = Join-Path $fixture "apps\$project"
    $target = Join-Path $workspace "apps\$project"
    Copy-DirectoryExcept $source $target @("node_modules")
    $sourceNodeModules = Join-Path $source "node_modules"
    if (-not (Test-Path -LiteralPath $sourceNodeModules -PathType Container)) { throw "$project node_modules missing" }
    New-Item -ItemType Junction -Path (Join-Path $target "node_modules") -Target $sourceNodeModules | Out-Null
}

$backendProjects = @(
    @{ Name="account-api"; Project="Account.Api.FeatureTests.csproj" },
    @{ Name="billing-api"; Project="Billing.Api.FeatureTests.csproj" }
)
foreach ($item in $backendProjects) {
    $source = Join-Path $fixture "services\$($item.Name)"
    $target = Join-Path $workspace "services\$($item.Name)"
    Copy-DirectoryExcept $source $target @("bin", "obj")
    Invoke-NativeChecked { dotnet restore (Join-Path $target $item.Project) --nologo } "$($item.Name) restore"
}

$vscodeDir = Join-Path $workspace ".vscode"
New-Item -ItemType Directory -Force $vscodeDir | Out-Null
[IO.File]::WriteAllText((Join-Path $vscodeDir "settings.json"), "{}", [Text.UTF8Encoding]::new($false))

Write-Host "`n=== 3. INSTALLED VSIX SECOND-WORKSPACE SMOKE ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm run build } "test harness build"
$env:FEATURE_PROJECTION_SMOKE_RESULT = $resultFile
$env:FEATURE_PROJECTION_EXPECTED_VERSION = $version
$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions
$env:FEATURE_PROJECTION_SMOKE_MODE = "scope-isolation"
$env:FEATURE_PROJECTION_TEST_MODE = "1"
$driver = (Resolve-Path ".\test\installed-driver").Path
$suite = (Resolve-Path ".\dist\test\suite\index.js").Path
$args = @(
    $workspace,
    "--extensionDevelopmentPath=$driver",
    "--extensionTestsPath=$suite",
    "--user-data-dir=$userData",
    "--extensions-dir=$extensions",
    "--disable-workspace-trust",
    "--disable-extension=github.copilot-chat",
    "--disable-gpu",
    "--skip-welcome",
    "--skip-release-notes"
)
$proc = Start-Process -FilePath $codeExe -ArgumentList $args -PassThru
$deadline = [DateTime]::UtcNow.AddSeconds(240)
while ([DateTime]::UtcNow -lt $deadline -and -not (Test-Path -LiteralPath $resultFile)) {
    Start-Sleep -Milliseconds 500
}
Remove-Item Env:FEATURE_PROJECTION_SMOKE_RESULT -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_EXPECTED_VERSION -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue

if (-not (Test-Path -LiteralPath $resultFile)) {
    $latestLog = Get-ChildItem $userData -Recurse -Filter "*-Feature Projection.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestLog) {
        Write-Host "--- Feature Projection log tail ---" -ForegroundColor Yellow
        Get-Content $latestLog.FullName -Tail 160
    }
    throw "Second-workspace installed smoke did not produce a result marker within 240 seconds"
}

$result = Get-Content -Raw $resultFile | ConvertFrom-Json
if (-not $result.ok) { throw "Second-workspace smoke marker reported failure" }
if ($result.mode -ne "scope-isolation") { throw "Unexpected smoke mode: $($result.mode)" }
if ($result.trusted -ne $true) { throw "Second-workspace smoke must be trusted" }
if (-not $result.configured) { throw "Second-workspace smoke did not prove Configure persistence" }
if (($result.featureSpaces -join '|') -ne 'accounts|billing') { throw "Unexpected FeatureSpaces: $($result.featureSpaces -join ', ')" }
if ($result.situations -ne 6) { throw "Expected 6 scoped Situations, got $($result.situations)" }
if ($result.sourceActions -ne 10) { throw "Expected 10 matched source actions, got $($result.sourceActions)" }
if ($result.unmatchedParts -ne 2) { throw "Expected exactly 2 unmatched role nodes, got $($result.unmatchedParts)" }
if ($result.finalState -ne 'fresh') { throw "Second-workspace final state is not Fresh: $($result.finalState)" }
if (-not ([IO.Path]::GetFullPath($result.extensionPath).ToLowerInvariant().StartsWith([IO.Path]::GetFullPath($extensions).ToLowerInvariant()))) {
    throw "Smoke loaded Feature Projection from unexpected path: $($result.extensionPath)"
}

Write-Host (Get-Content -Raw $resultFile)
Write-Host "`n=== SECOND WORKSPACE FEATURE-SCOPE ISOLATION PASSED ===" -ForegroundColor Green
