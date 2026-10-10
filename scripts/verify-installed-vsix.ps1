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
    if ($env:LOCALAPPDATA) {
        $candidates += (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe")
        $candidates += (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code Insiders\Code - Insiders.exe")
    }
    if ($env:ProgramFiles) {
        $candidates += (Join-Path $env:ProgramFiles "Microsoft VS Code\Code.exe")
        $candidates += (Join-Path $env:ProgramFiles "Microsoft VS Code Insiders\Code - Insiders.exe")
    }
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

function Prepare-ConfigureWorkspace {
    param([string]$SmokeRoot)
    $workspace = Join-Path $SmokeRoot "workspace"
    New-Item -ItemType Directory -Force $workspace | Out-Null

    $sourceFrontend = (Resolve-Path ".\fixtures\workspace\frontend").Path
    $targetFrontend = Join-Path $workspace "frontend"
    Copy-DirectoryExcept $sourceFrontend $targetFrontend @("node_modules")
    $sourceNodeModules = Join-Path $sourceFrontend "node_modules"
    if (-not (Test-Path -LiteralPath $sourceNodeModules -PathType Container)) { throw "Fixture frontend node_modules missing" }
    New-Item -ItemType Junction -Path (Join-Path $targetFrontend "node_modules") -Target $sourceNodeModules | Out-Null

    $sourceBackend = (Resolve-Path ".\fixtures\workspace\backend").Path
    $targetBackend = Join-Path $workspace "backend"
    Copy-DirectoryExcept $sourceBackend $targetBackend @("bin", "obj")
    $null = Invoke-NativeChecked { dotnet restore (Join-Path $targetBackend "Backend.FeatureTests.csproj") --nologo } "temporary backend dotnet restore"

    $vscodeDir = Join-Path $workspace ".vscode"
    New-Item -ItemType Directory -Force $vscodeDir | Out-Null
    [IO.File]::WriteAllText((Join-Path $vscodeDir "settings.json"), "{}", [Text.UTF8Encoding]::new($false))
    return $workspace
}

Write-Host "`n=== 1. PACKAGE VSIX ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm install } "npm install"
Invoke-NativeChecked { npm run package:vsix } "VSIX package"
$version = (Get-Content -Raw ".\package.json" | ConvertFrom-Json).version
$extensionId = "local-prototype.feature-projection-prototype-p0"
$vsix = (Resolve-Path ".\artifacts\feature-projection-prototype-p0-$version.vsix").Path

Write-Host "`n=== 2. PREPARE FIXTURE DEPENDENCIES ===" -ForegroundColor Cyan
Push-Location ".\fixtures\workspace\frontend"
Invoke-NativeChecked { npm install } "fixture frontend npm install"
Pop-Location

Write-Host "`n=== 3. INSTALL INTO ISOLATED PROFILE ===" -ForegroundColor Cyan
$codeExe = Find-CodeExe
$codeRoot = Split-Path -Parent $codeExe
$codeCli = Join-Path $codeRoot "bin\code.cmd"
if (-not (Test-Path -LiteralPath $codeCli -PathType Leaf)) { $codeCli = $codeExe }
$smokeRoot = Join-Path ([IO.Path]::GetTempPath()) "feature-projection-installed-vsix-smoke-$version"
$sourceRootFull = [IO.Path]::GetFullPath($root).TrimEnd("\") + "\"
$smokeRootFull = [IO.Path]::GetFullPath($smokeRoot).TrimEnd("\") + "\"
if ($smokeRootFull.ToLowerInvariant().StartsWith($sourceRootFull.ToLowerInvariant())) { throw "Installed smoke must run outside source checkout ancestry: $smokeRoot" }
$userData = Join-Path $smokeRoot "user-data"
$extensions = Join-Path $smokeRoot "extensions"
$resultFile = Join-Path $smokeRoot "result.json"
Remove-Item $smokeRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $userData,$extensions | Out-Null
Invoke-NativeChecked { & $codeCli --user-data-dir $userData --extensions-dir $extensions --install-extension $vsix --force } "VSIX install"
$installed = (& $codeCli --user-data-dir $userData --extensions-dir $extensions --list-extensions --show-versions) -join "`n"
$expectedInstalled = "$extensionId@$version"
if ($installed -notmatch [regex]::Escape($expectedInstalled)) {
    throw "Installed extension list does not contain $expectedInstalled. Actual:`n$installed"
}
Write-Host "Installed: $expectedInstalled"
$installedForRuntimeCheck = Get-ChildItem -LiteralPath $extensions -Directory | Where-Object { $_.Name -like "local-prototype.feature-projection-prototype-p0-*" } | Select-Object -First 1
if (-not $installedForRuntimeCheck) { throw "Installed Feature Projection directory not found" }
$packagedTypescript = Join-Path $installedForRuntimeCheck.FullName "node_modules\typescript\lib\typescript.js"
if (-not (Test-Path -LiteralPath $packagedTypescript -PathType Leaf)) { throw "Installed VSIX is missing runtime TypeScript dependency: $packagedTypescript" }
Write-Host "Packaged TypeScript runtime: PASS"
$installedNodeModules = Join-Path $installedForRuntimeCheck.FullName "node_modules"
$runtimeNodeDeps = @(Get-ChildItem -LiteralPath $installedNodeModules -Directory | ForEach-Object { $_.Name })
if ($runtimeNodeDeps.Count -ne 1 -or $runtimeNodeDeps[0] -ne "typescript") { throw "Installed VSIX must package only declared runtime Node dependency typescript. Actual: $($runtimeNodeDeps -join ", ")" }
Write-Host "No undeclared packaged Node dependencies: PASS"

Write-Host "`n=== 4. PREPARE EMPTY CONFIGURE WORKSPACE ===" -ForegroundColor Cyan
$workspace = Prepare-ConfigureWorkspace $smokeRoot

Write-Host "`n=== 5. NORMAL INSTALLED SESSION HIDES AUTOMATION HOOKS ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm run build } "test harness build"
$driver = (Resolve-Path ".\test\installed-driver").Path
$suite = (Resolve-Path ".\dist\test\suite\index.js").Path
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

Write-Host "`n=== 6. INSTALLED EXTENSION CONFIGURE + REFRESH SMOKE ===" -ForegroundColor Cyan
$env:FEATURE_PROJECTION_SMOKE_RESULT = $resultFile
$env:FEATURE_PROJECTION_EXPECTED_VERSION = $version
$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions
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
$deadline = [DateTime]::UtcNow.AddSeconds(180)
while ([DateTime]::UtcNow -lt $deadline -and -not (Test-Path -LiteralPath $resultFile)) {
    Start-Sleep -Milliseconds 500
}
Remove-Item Env:FEATURE_PROJECTION_SMOKE_RESULT -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_EXPECTED_VERSION -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue
if (-not (Test-Path -LiteralPath $resultFile)) {
    $latestLog = Get-ChildItem $userData -Recurse -Filter "*-Feature Projection.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestLog) {
        Write-Host "--- Feature Projection log tail ---" -ForegroundColor Yellow
        Get-Content $latestLog.FullName -Tail 100
    }
    throw "Installed VSIX smoke did not produce result marker within 180 seconds"
}
$result = Get-Content -Raw $resultFile | ConvertFrom-Json
if (-not $result.ok) { throw "Installed VSIX smoke marker reported failure" }
if (-not $result.configured) { throw "Installed VSIX smoke did not prove Configure persistence" }
if ($result.version -ne $version) { throw "Smoke loaded version '$($result.version)', expected '$version'" }
if (-not ([IO.Path]::GetFullPath($result.extensionPath).ToLowerInvariant().StartsWith([IO.Path]::GetFullPath($extensions).ToLowerInvariant()))) {
    throw "Smoke loaded Feature Projection from unexpected path: $($result.extensionPath)"
}
Write-Host (Get-Content -Raw $resultFile)

Write-Host "`n=== 7. TRUSTED MISSING-NODE DIAGNOSTIC ===" -ForegroundColor Cyan
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

Write-Host "`n=== 9. PREPARE RESTRICTED-MODE WORKSPACE ===" -ForegroundColor Cyan
$untrustedWorkspace = Join-Path $smokeRoot "workspace-untrusted"
New-Item -ItemType Directory -Force $untrustedWorkspace | Out-Null
Copy-DirectoryExcept (Resolve-Path ".\fixtures\workspace\frontend").Path (Join-Path $untrustedWorkspace "frontend") @("node_modules")
Copy-DirectoryExcept (Resolve-Path ".\fixtures\workspace\backend").Path (Join-Path $untrustedWorkspace "backend") @("bin", "obj")
$untrustedVscodeDir = Join-Path $untrustedWorkspace ".vscode"
New-Item -ItemType Directory -Force $untrustedVscodeDir | Out-Null
$missingNode = Join-Path $untrustedWorkspace "definitely-missing-node.exe"
$untrustedSettings = @{
    "featureProjection.nodePath" = $missingNode
    "featureProjection.featureSpaces" = @(
        @{
            id = "app"
            sources = @(
                @{ id="frontend"; role="frontend"; root="frontend/src/features"; adapter="vitest-5"; frameworkProject="frontend"; configFile="vitest.config.ts" },
                @{ id="backend"; role="backend"; root="backend/Features"; adapter="xunit-v3"; frameworkProject="backend"; projectFile="Backend.FeatureTests.csproj" }
            )
        }
    )
}
[IO.File]::WriteAllText((Join-Path $untrustedVscodeDir "settings.json"), ($untrustedSettings | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))

# Strong installed proof: Restricted Mode must not even require the packaged .NET worker.
$installedExtensionDir = Get-ChildItem -LiteralPath $extensions -Directory | Where-Object { $_.Name -like "local-prototype.feature-projection-prototype-p0-*" } | Select-Object -First 1
if (-not $installedExtensionDir) { throw "Installed Feature Projection directory not found" }
$installedWorker = Join-Path $installedExtensionDir.FullName "workers\dotnet\runtime\FeatureProjection.DotNetWorker.dll"
$disabledWorker = "$installedWorker.disabled-for-untrusted-smoke"
if (-not (Test-Path -LiteralPath $installedWorker -PathType Leaf)) { throw "Installed .NET worker missing before untrusted smoke: $installedWorker" }
Move-Item -LiteralPath $installedWorker -Destination $disabledWorker -Force

Write-Host "`n=== 7. INSTALLED EXTENSION RESTRICTED-MODE SMOKE ===" -ForegroundColor Cyan
$untrustedUserData = Join-Path $smokeRoot "user-data-untrusted"
$untrustedResultFile = Join-Path $smokeRoot "result-untrusted.json"
New-Item -ItemType Directory -Force $untrustedUserData | Out-Null
$env:FEATURE_PROJECTION_SMOKE_RESULT = $untrustedResultFile
$env:FEATURE_PROJECTION_EXPECTED_VERSION = $version
$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions
$env:FEATURE_PROJECTION_SMOKE_MODE = "untrusted"
$env:FEATURE_PROJECTION_TEST_MODE = "1"
$untrustedArgs = @(
    $untrustedWorkspace,
    "--extensionDevelopmentPath=$driver",
    "--extensionTestsPath=$suite",
    "--user-data-dir=$untrustedUserData",
    "--extensions-dir=$extensions",
    "--disable-extension=github.copilot-chat",
    "--disable-gpu",
    "--skip-welcome",
    "--skip-release-notes"
)
try {
    $untrustedProc = Start-Process -FilePath $codeExe -ArgumentList $untrustedArgs -PassThru
    $untrustedDeadline = [DateTime]::UtcNow.AddSeconds(180)
    while ([DateTime]::UtcNow -lt $untrustedDeadline -and -not (Test-Path -LiteralPath $untrustedResultFile)) {
        Start-Sleep -Milliseconds 500
    }
    if (-not (Test-Path -LiteralPath $untrustedResultFile)) {
        $latestUntrustedLog = Get-ChildItem $untrustedUserData -Recurse -Filter "*-Feature Projection.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestUntrustedLog) {
            Write-Host "--- Restricted Mode Feature Projection log tail ---" -ForegroundColor Yellow
            Get-Content $latestUntrustedLog.FullName -Tail 120
        }
        throw "Installed VSIX Restricted Mode smoke did not produce result marker within 180 seconds"
    }
    $untrustedResult = Get-Content -Raw $untrustedResultFile | ConvertFrom-Json
    if (-not $untrustedResult.ok -or $untrustedResult.mode -ne "untrusted" -or $untrustedResult.trusted -ne $false) {
        throw "Restricted Mode result marker did not prove an untrusted workspace"
    }
    if ($untrustedResult.ruleIds -notcontains "worker/untrusted-workspace") { throw "Restricted Mode did not block Vitest runtime evidence explicitly" }
    if ($untrustedResult.ruleIds -notcontains "worker/untrusted-project-analysis") { throw "Restricted Mode did not block C# project analysis explicitly" }
    if ($untrustedResult.ruleIds -contains "worker/dotnet-worker-missing") { throw "Restricted Mode incorrectly required the .NET worker" }

    $latestUntrustedLog = Get-ChildItem $untrustedUserData -Recurse -Filter "*-Feature Projection.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latestUntrustedLog) { throw "Restricted Mode Feature Projection output log not found" }
    $untrustedLogText = Get-Content -Raw $latestUntrustedLog.FullName
    if ($untrustedLogText -notmatch "workspace untrusted: project/runtime workers disabled") { throw "Restricted Mode log does not record worker suppression" }
    if ($untrustedLogText -match "(?m)(vitest:[^\r\n]*spawn|dotnet-analyze:[^\r\n]*spawn|dotnet-build:[^\r\n]*spawn|xunit-materialize:[^\r\n]*spawn)") {
        throw "A project/runtime worker was spawned in Restricted Mode"
    }
    Write-Host (Get-Content -Raw $untrustedResultFile)
} finally {
    Remove-Item Env:FEATURE_PROJECTION_SMOKE_RESULT -ErrorAction SilentlyContinue
    Remove-Item Env:FEATURE_PROJECTION_EXPECTED_VERSION -ErrorAction SilentlyContinue
    Remove-Item Env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT -ErrorAction SilentlyContinue
    Remove-Item Env:FEATURE_PROJECTION_SMOKE_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $disabledWorker -PathType Leaf) { Move-Item -LiteralPath $disabledWorker -Destination $installedWorker -Force }
}

Write-Host "`n=== INSTALLED VSIX TRUST + CONFIGURE SMOKE PASSED ===" -ForegroundColor Green
