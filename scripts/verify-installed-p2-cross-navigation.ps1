param([Parameter(Mandatory=$true)][string]$SmokeRoot)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root
$extensions = Join-Path $SmokeRoot 'extensions'
$workspace = Join-Path $SmokeRoot 'workspace-cross-navigation'
$userData = Join-Path $SmokeRoot 'user-data-cross-navigation'
$resultFile = Join-Path $SmokeRoot 'result-cross-navigation.json'
foreach ($p in @($extensions,$SmokeRoot)) { if (!(Test-Path -LiteralPath $p -PathType Container)) { throw "Missing previously installed P2 location: $p" } }
if ((Test-Path -LiteralPath $workspace) -or (Test-Path -LiteralPath $userData) -or (Test-Path -LiteralPath $resultFile)) { throw 'Refuse to overwrite an existing P2 scope-check location' }
$installed = @(Get-ChildItem -LiteralPath $extensions -Directory | Where-Object {$_.Name -eq 'local-prototype.feature-projection-prototype-p0-0.1.0'})
if ($installed.Count -ne 1) { throw 'Expected one isolated installed P2 extension' }
$installedDll = Join-Path $installed[0].FullName 'workers\dotnet\runtime\FeatureProjection.DotNetWorker.dll'
if (!(Test-Path -LiteralPath $installedDll)) { throw 'Installed P2 worker runtime is missing' }
$codeExeCandidates = @(
 (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe'),
 (Join-Path $env:ProgramFiles 'Microsoft VS Code\Code.exe')
)
$codeExe = @($codeExeCandidates | Where-Object {Test-Path -LiteralPath $_ -PathType Leaf}) | Select-Object -First 1
if (-not $codeExe) {throw 'Code.exe unavailable'}
$driver = (Resolve-Path '.\test\installed-driver').Path
$suite = (Resolve-Path '.\dist\test\suite\index.js').Path
$fixture = (Resolve-Path '.\fixtures\workspace-scope-isolation').Path
function Copy-DirectoryExcept([string]$source,[string]$target,[string[]]$exclude) {
 New-Item -ItemType Directory -Force -Path $target | Out-Null
 Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -notin $exclude } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
 }
}
New-Item -ItemType Directory -Force -Path $workspace,$userData | Out-Null
foreach ($name in @('account-web','billing-web')) {
 $source = Join-Path $fixture "apps\$name"
 $target = Join-Path $workspace "apps\$name"
 Copy-DirectoryExcept $source $target @('node_modules')
 $moduleDir = Join-Path $source 'node_modules'
 if (!(Test-Path -LiteralPath $moduleDir -PathType Container)) {throw "Missing preinstalled $name node_modules"}
 New-Item -ItemType Junction -Path (Join-Path $target 'node_modules') -Target $moduleDir | Out-Null
}
foreach($item in @(@('account-api','Account.Api.FeatureTests.csproj'),@('billing-api','Billing.Api.FeatureTests.csproj'))) {
 $source=Join-Path $fixture ("services\"+$item[0])
 $target=Join-Path $workspace ("services\"+$item[0])
 Copy-DirectoryExcept $source $target @('bin','obj')
 & dotnet restore (Join-Path $target $item[1]) --nologo
 if($LASTEXITCODE -ne 0){throw "Fixture restore failed: $($item[0])"}
}
$settingsDir=Join-Path $workspace '.vscode'
New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null
[IO.File]::WriteAllText((Join-Path $settingsDir 'settings.json'),'{}',[Text.UTF8Encoding]::new($false))
$env:FEATURE_PROJECTION_SMOKE_RESULT=$resultFile
$env:FEATURE_PROJECTION_EXPECTED_VERSION='0.1.0'
$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT=$extensions
$env:FEATURE_PROJECTION_SMOKE_MODE='p2-cross-navigation'
$env:FEATURE_PROJECTION_TEST_MODE='1'
$argsForCode=@(
 $workspace,
 "--extensionDevelopmentPath=$driver",
 "--extensionTestsPath=$suite",
 "--user-data-dir=$userData",
 "--extensions-dir=$extensions",
 '--disable-workspace-trust',
 '--disable-extension=github.copilot-chat',
 '--disable-gpu',
 '--skip-welcome',
 '--skip-release-notes'
)
try {
 $proc = Start-Process -FilePath $codeExe -ArgumentList $argsForCode -PassThru
 $deadline = [datetime]::UtcNow.AddSeconds(240)
 while([datetime]::UtcNow -lt $deadline -and !(Test-Path -LiteralPath $resultFile)) { Start-Sleep -Milliseconds 500 }
 if (!(Test-Path -LiteralPath $resultFile)) {
   $log = Get-ChildItem -LiteralPath $userData -Recurse -Filter '*-Feature Projection.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
   if ($log){ Get-Content -LiteralPath $log.FullName -Tail 80 }
   throw 'P2 installed p2-cross-navigation smoke did not produce its result marker'
 }
 $result = Get-Content -LiteralPath $resultFile -Raw | ConvertFrom-Json
 if (-not $result.ok -or $result.mode -ne 'p2-cross-navigation' -or $result.trusted -ne $true -or
  ($result.featureSpaces -join '|') -ne 'accounts|billing' -or $result.situations -ne 6 -or
  $result.matchedSourceActions -ne 10 -or $result.unmatchedParts -ne 2 -or $result.uiState -ne 'fresh' -or
  -not $result.bidirectional -or -not $result.codeLens -or -not $result.contextMenu -or
  -not $result.assertionSourceNavigation -or $result.assertionSourceActions -lt 6 -or
  -not $result.repeatedLabelsIsolated -or -not $result.unknownIdentityRefused -or
  -not ([IO.Path]::GetFullPath($result.extensionPath).ToLowerInvariant().StartsWith([IO.Path]::GetFullPath($extensions).ToLowerInvariant()))) {  throw 'P2 installed scope isolation marker fails its acceptance contract'
 }
 Write-Output (Get-Content -LiteralPath $resultFile -Raw)
 Write-Output 'P2_INSTALLED_CROSS_NAVIGATION_PASS'
} finally {
 foreach ($name in @('FEATURE_PROJECTION_SMOKE_RESULT','FEATURE_PROJECTION_EXPECTED_VERSION','FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT','FEATURE_PROJECTION_SMOKE_MODE','FEATURE_PROJECTION_TEST_MODE')) { Remove-Item -Path ("Env:"+$name) -ErrorAction SilentlyContinue }
}
