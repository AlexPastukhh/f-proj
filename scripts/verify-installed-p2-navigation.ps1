[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root

$candidate = Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-navigation-candidate.vsix'
$releaseVsix = (Join-Path $root 'artifacts\releases\feature-projection-prototype-p0-0.1.0.vsix')
$releaseZip = (Join-Path $root 'artifacts\releases\feature-projection-prototype-p0-0.1.0-release.zip')
$p1Candidate = Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p1-acceptance-candidate.vsix'
if (Test-Path -LiteralPath $candidate) { throw 'Refusing to overwrite an existing P2 VSIX candidate' }
$known = @(
 @($releaseVsix,'49704A1072FD571BFEC94139BBC865F9B75F40CD899E6CDC531E9E605E951CC1'),
 @($releaseZip,'16D23889C6702D392B9935E6794034EBA1D492FB05BC496F6FE865F28D6C8D08'),
 @($p1Candidate,'44284D06F1A5C67A24CDF52B03F372A7D12249C3258A2A1F6C2823061D751989')
)
function CheckKnown {
  foreach ($pair in $known) {
    $actual = (Get-FileHash -LiteralPath $pair[0] -Algorithm SHA256).Hash
    if ($actual -ne $pair[1]) { throw ('Historical artifact changed: '+$pair[0]) }
  }
}
CheckKnown
Write-Output '=== PACKAGE SEPARATE P2 CANDIDATE ==='
& npm.cmd run build:dotnet-worker
if ($LASTEXITCODE -ne 0) { throw 'P2 worker publish failed' }
& '.\node_modules\.bin\vsce.cmd' package --out $candidate
if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $candidate)) { throw 'P2 VSIX package failed' }
Write-Output ('P2_VSIX_BYTES='+(Get-Item -LiteralPath $candidate).Length)
Write-Output ('P2_VSIX_SHA256='+(Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash)

$base = Join-Path ([IO.Path]::GetTempPath()) ('feature-projection-p2-nav-'+[guid]::NewGuid().ToString('N'))
if (Test-Path -LiteralPath $base) { throw 'Refusing existing smoke directory' }
$workspace = Join-Path $base 'workspace'
$userData = Join-Path $base 'user-data'
$extensions = Join-Path $base 'extensions'
$resultFile = Join-Path $base 'result-p2-navigation.json'
New-Item -ItemType Directory -Path $workspace,$userData,$extensions -Force | Out-Null
$codeCandidates = @()
if ($env:VSCODE_EXECUTABLE_PATH) {$codeCandidates += $env:VSCODE_EXECUTABLE_PATH}
$codeCandidates += (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe')
$codeCandidates += (Join-Path $env:ProgramFiles 'Microsoft VS Code\Code.exe')
$codeExe = @($codeCandidates|Where-Object {$_ -and (Test-Path -LiteralPath $_ -PathType Leaf)})|Select-Object -First 1
if (!$codeExe) { throw 'Cannot find installed Code.exe' }
$codeCli = Join-Path (Split-Path -Parent $codeExe) 'bin\code.cmd'
if (!(Test-Path -LiteralPath $codeCli)) { $codeCli = $codeExe }

Write-Output '=== ISOLATED VSIX INSTALL ==='
& $codeCli --user-data-dir $userData --extensions-dir $extensions --install-extension $candidate --force
if ($LASTEXITCODE -ne 0) { throw 'Isolated P2 VSIX installation failed' }
$installed = @(Get-ChildItem -LiteralPath $extensions -Directory |
  Where-Object {$_.Name -eq 'local-prototype.feature-projection-prototype-p0-0.1.0'})
if ($installed.Count -ne 1) { throw 'Installed P2 extension not found in isolated profile' }

Write-Output '=== PREPARE ISOLATED WORKSPACE ==='
$fixture = Join-Path $root 'fixtures\parameterized-navigation-proof'
function CopyExcept([string]$source,[string]$dest,[string[]]$excluded) {
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  Get-ChildItem -LiteralPath $source -Force | Where-Object {$_.Name -notin $excluded} | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force
  }
}
$frontend = Join-Path $workspace 'frontend'
$backend = Join-Path $workspace 'backend'
CopyExcept (Join-Path $fixture 'frontend') $frontend @('node_modules')
CopyExcept (Join-Path $fixture 'backend') $backend @('bin','obj')
$deps = Join-Path $fixture 'frontend\node_modules'
if (!(Test-Path -LiteralPath (Join-Path $deps 'vitest\package.json'))) { throw 'Vitest fixture runtime dependencies missing' }
New-Item -ItemType Junction -Path (Join-Path $frontend 'node_modules') -Target $deps | Out-Null
& dotnet restore (Join-Path $backend 'Navigation.FeatureTests.csproj') --nologo
if ($LASTEXITCODE -ne 0) { throw 'P2 backend dotnet restore failed' }
$vscodeDir = Join-Path $workspace '.vscode'
New-Item -ItemType Directory -Path $vscodeDir -Force | Out-Null
$settings = @{
 'featureProjection.featureSpaces' = @(@{
    id='app'
    sources=@(
      @{id='frontend';role='frontend';adapter='vitest-5';root='frontend/src/features';frameworkProject='frontend'},
      @{id='backend';role='backend';adapter='xunit-v3';root='backend/Features';frameworkProject='backend';projectFile='Navigation.FeatureTests.csproj'}
    )
 })
}
[IO.File]::WriteAllText((Join-Path $vscodeDir 'settings.json'),($settings|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))

Write-Output '=== INSTALLED P2 EXACT-ROW NAVIGATION ==='
$driver = (Resolve-Path '.\test\installed-driver').Path
$suite = (Resolve-Path '.\dist\test\suite\index.js').Path
$env:FEATURE_PROJECTION_SMOKE_RESULT = $resultFile
$env:FEATURE_PROJECTION_EXPECTED_VERSION = '0.1.0'
$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT = $extensions
$env:FEATURE_PROJECTION_SMOKE_MODE = 'p2-navigation'
$env:FEATURE_PROJECTION_TEST_MODE = '1'
$launchArgs = @(
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
  $proc = Start-Process -FilePath $codeExe -ArgumentList $launchArgs -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(180)
  while ([DateTime]::UtcNow -lt $deadline -and !(Test-Path -LiteralPath $resultFile)) {
    Start-Sleep -Milliseconds 500
  }
  if (!(Test-Path -LiteralPath $resultFile)) {
    $logs = Get-ChildItem -LiteralPath $userData -Recurse -Filter '*-Feature Projection.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($logs) { Get-Content -LiteralPath $logs.FullName -Tail 90 }
    throw 'P2 installed smoke timed out without result marker'
  }
  $result = Get-Content -LiteralPath $resultFile -Raw | ConvertFrom-Json
  if (!$result.ok -or $result.mode -ne 'p2-navigation' -or $result.uiState -ne 'fresh' -or
      $result.situations -ne 2 -or $result.sourceActions -ne 4 -or
      !$result.markdownLinks -or !$result.testingTree -or !$result.openSource -or
      $result.blockingDiagnostics -ne 0 -or
      (($result.concreteSourceLines -join ',') -ne '4,5,5,6') -or
      !([IO.Path]::GetFullPath($result.extensionPath).ToLowerInvariant().StartsWith(
        [IO.Path]::GetFullPath($extensions).ToLowerInvariant()))) {
    throw ('Invalid installed P2 navigation marker: '+($result|ConvertTo-Json -Depth 5))
  }
  Write-Output (Get-Content -LiteralPath $resultFile -Raw)
  Write-Output 'P2_INSTALLED_NAVIGATION_PASS'
} finally {
  foreach($name in @('FEATURE_PROJECTION_SMOKE_RESULT','FEATURE_PROJECTION_EXPECTED_VERSION','FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT','FEATURE_PROJECTION_SMOKE_MODE','FEATURE_PROJECTION_TEST_MODE')) {
    Remove-Item ("Env:"+$name) -ErrorAction SilentlyContinue
  }
}
CheckKnown
Write-Output ('P2_CANDIDATE_SHA256='+(Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash)
Write-Output ('P2_SMOKE_ROOT='+$base)
Write-Output 'P2_RELEASE_ARTIFACTS_UNCHANGED=PASS'
