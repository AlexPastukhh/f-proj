[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root
$candidate=Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-fixed-candidate.vsix'
if(Test-Path -LiteralPath $candidate){throw 'Refuse to overwrite an existing P2 registered usages candidate'}
$historical=@(
 @('RELEASE_VSIX',(Join-Path $root 'artifacts\releases\feature-projection-prototype-p0-0.1.0.vsix'),'49704A1072FD571BFEC94139BBC865F9B75F40CD899E6CDC531E9E605E951CC1'),
 @('RELEASE_ZIP',(Join-Path $root 'artifacts\releases\feature-projection-prototype-p0-0.1.0-release.zip'),'16D23889C6702D392B9935E6794034EBA1D492FB05BC496F6FE865F28D6C8D08'),
 @('P1',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p1-acceptance-candidate.vsix'),'44284D06F1A5C67A24CDF52B03F372A7D12249C3258A2A1F6C2823061D751989'),
 @('P2_NAV',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-navigation-candidate.vsix'),'6F54B99A8D250BBFAD0BC114D37C22E7C2558EF6A36EAC9530B07BAB782AA0C8'),
 @('P2_CROSS',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-cross-navigation-candidate.vsix'),'F6EA46AB06D48A5067D68405863DB1280EC7C1564972EC0F4659E8DB71E434BB'),
 @('P2_ASSERT',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-cross-navigation-assertions-candidate.vsix'),'88E8030EC53220D05682F077D7F7E9FEC25A91C05F59902F45A9673528412F62'),
 @('P2_FAILED_PROBE',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-reveal-palette-candidate.vsix'),'6C3F45B0D3469AD4B9AF7BAE81724D6AEF0C96C604B18F82D4B06E2C86FE15EA'),
 @('P2_MANUAL',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-reveal-palette-fixed-candidate.vsix'),'D243269ADD21035CD5B75B599A093AFA61BFCF2998688F3917C1A61320265107'),
 @('P2_USAGE_VIEW_BUGGY_URI',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-registered-usages-candidate.vsix'),'8D33A18EA642410EC31946B826A45AB34E0EA8F12E262FBCAE4ACE3B0D1BBB31'),
 @('P2_USAGE_SCOPED_APPROVED',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-registered-usages-scoped-candidate.vsix'),'7C259D336C89C961E61827E0AD6E92508BB0125CE5C0776946C17D0067275CE1'),
 @('P2_RENAME_PREVIEW_BAD_TEST_DISPATCH',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-rename-preview-readonly-candidate.vsix'),'65420265212EE335093A08D5A1735D588DC96F1C2E71649DFD9A344BC0E384FA')
)
function CheckHistorical {
 foreach($entry in $historical){
  $hash=(Get-FileHash -LiteralPath $entry[1] -Algorithm SHA256).Hash
  if($hash -ne $entry[2]){throw ('Historic artifact hash mismatch: '+$entry[0])}
 }
 Write-Output 'HISTORICAL_ARTIFACTS_UNCHANGED=PASS'
}
function CopyFixture([string]$source,[string]$target){
 [IO.Directory]::CreateDirectory($target)|Out-Null
 foreach($entry in (Get-ChildItem -LiteralPath $source -Force|Where-Object{$_.Name -notin @('bin','obj','node_modules')})){
  Copy-Item -LiteralPath $entry.FullName -Destination $target -Force -Recurse
 }
}
CheckHistorical
& node '.\scripts\verify-usage-symbol-feasibility.mjs'
if($LASTEXITCODE -ne 0){throw '8.3a symbol-usage proof failed'}
& node '.\scripts\verify-rename-feasibility.mjs'
if($LASTEXITCODE -ne 0){throw '8.3c read-only Roslyn rename proof failed'}
& npm.cmd test
if($LASTEXITCODE -ne 0){throw '58 unit regression tests failed'}
& npm.cmd run build:dotnet-worker
if($LASTEXITCODE -ne 0){throw 'Worker publish failed'}
& '.\node_modules\.bin\vsce.cmd' package --out $candidate
if($LASTEXITCODE -ne 0){throw 'VSIX packaging failed'}
Write-Output ('RENAME_PREVIEW_VSIX_SIZE='+([IO.FileInfo]::new($candidate)).Length)
Write-Output ('RENAME_PREVIEW_VSIX_SHA256='+(Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash)
$smoke=Join-Path ([IO.Path]::GetTempPath()) ('feature-projection-usageview-'+[guid]::NewGuid().ToString('N'))
if(Test-Path -LiteralPath $smoke){throw 'Smoke root unexpectedly exists'}
$extensions=Join-Path $smoke 'extensions'
$userdata=Join-Path $smoke 'user-data-install'
[IO.Directory]::CreateDirectory($extensions)|Out-Null
[IO.Directory]::CreateDirectory($userdata)|Out-Null
$exe=Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe'
$cli=Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'
if(!(Test-Path $exe) -or !(Test-Path $cli)){throw 'Installed VS Code unavailable'}
$prev=$ErrorActionPreference;$ErrorActionPreference='Continue'
try {$output=@(& $cli --user-data-dir $userdata --extensions-dir $extensions --install-extension $candidate --force 2>&1);$exit=$LASTEXITCODE}finally{$ErrorActionPreference=$prev}
$output|Select-Object -Last 7|ForEach-Object{Write-Output ([string]$_)}
if($exit -ne 0){throw 'VSIX isolated install failed'}
$installed=Join-Path $extensions 'local-prototype.feature-projection-prototype-p0-0.1.0'
if(!(Test-Path (Join-Path $installed 'workers\dotnet\runtime\FeatureProjection.DotNetWorker.dll'))){throw 'Installed worker DLL missing'}
$workspace=Join-Path $smoke 'workspace-p1-proof-usages'
foreach($item in @(@('responsibility-proof','responsibility','Responsibility.FeatureTests.csproj'),@('assertion-helper-proof','assertions','AssertionHelper.FeatureTests.csproj'))){
 $src=Join-Path $root ('fixtures\'+$item[0])
 $dst=Join-Path $workspace $item[1]
 CopyFixture $src $dst
 & dotnet restore (Join-Path $dst $item[2]) --nologo
 if($LASTEXITCODE -ne 0){throw ('C# project restore failed '+$item[1])}
}
$settingsDir=Join-Path $workspace '.vscode'
[IO.Directory]::CreateDirectory($settingsDir)|Out-Null
$settings=@{
 'featureProjection.featureSpaces'=@(
  @{id='responsibility';sources=@(@{id='backend';role='backend';root='responsibility/Features';adapter='xunit-v3';frameworkProject='responsibility';projectFile='Responsibility.FeatureTests.csproj'})},
  @{id='assertions';sources=@(@{id='backend';role='backend';root='assertions/Features';adapter='xunit-v3';frameworkProject='assertions';projectFile='AssertionHelper.FeatureTests.csproj'})}
 )
}
[IO.File]::WriteAllText((Join-Path $settingsDir 'settings.json'),($settings|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
$driver=(Resolve-Path '.\test\installed-driver').Path
$suite=(Resolve-Path '.\dist\test\suite\index.js').Path
function InvokeInstalled([string]$mode,[string]$workspace,[bool]$trusted,[string]$stage){
 $user=Join-Path $smoke ('profile-'+$stage)
 $resultPath=Join-Path $smoke ('result-'+$stage+'.json')
 [IO.Directory]::CreateDirectory($user)|Out-Null
 $env:FEATURE_PROJECTION_SMOKE_RESULT=$resultPath
 $env:FEATURE_PROJECTION_EXPECTED_VERSION='0.1.0'
 $env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT=$extensions
 $env:FEATURE_PROJECTION_SMOKE_MODE=$mode
 if($mode -ne 'normal-hooks'){$env:FEATURE_PROJECTION_TEST_MODE='1'}
 else{Remove-Item Env:FEATURE_PROJECTION_TEST_MODE -ErrorAction SilentlyContinue}
 $argsForCode=@(
  $workspace,"--extensionDevelopmentPath=$driver","--extensionTestsPath=$suite",
  "--user-data-dir=$user","--extensions-dir=$extensions",
  '--disable-extension=github.copilot-chat','--disable-gpu','--skip-welcome','--skip-release-notes'
 )
 if($trusted){$argsForCode+='--disable-workspace-trust'}
 try {
  $proc=Start-Process -FilePath $exe -ArgumentList $argsForCode -PassThru
  $deadline=[datetime]::UtcNow.AddSeconds(230)
  while([datetime]::UtcNow -lt $deadline -and !(Test-Path -LiteralPath $resultPath)){Start-Sleep -Milliseconds 500}
  if(!(Test-Path -LiteralPath $resultPath)){
   Write-Output ('NO_RESULT_STAGE='+$stage)
   $logs=@(Get-ChildItem -LiteralPath $user -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object{$_.Name -match 'Feature Projection\.log$|exthost\.log$'}|Sort-Object LastWriteTime -Descending|Select-Object -First 3)
   foreach($l in $logs){Write-Output ('LOG '+$l.FullName);Get-Content -LiteralPath $l.FullName -Tail 25}
   throw ('Installed smoke stage timed out: '+$stage)
  }
  $o=Get-Content -LiteralPath $resultPath -Raw|ConvertFrom-Json
  if(-not $o.ok -or $o.mode -ne $mode -or $o.trusted -ne $trusted -or
   -not ([IO.Path]::GetFullPath($o.extensionPath).ToLowerInvariant().StartsWith([IO.Path]::GetFullPath($extensions).ToLowerInvariant()))) {
    throw ('Wrong installed smoke result for '+$stage+': '+(Get-Content -LiteralPath $resultPath -Raw))
  }
  Write-Output ('INSTALLED_RESULT_'+$stage+'='+(Get-Content -LiteralPath $resultPath -Raw))
  return $o
 }finally{
  foreach($name in @('FEATURE_PROJECTION_SMOKE_RESULT','FEATURE_PROJECTION_EXPECTED_VERSION','FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT','FEATURE_PROJECTION_SMOKE_MODE','FEATURE_PROJECTION_TEST_MODE')){
    Remove-Item ('Env:'+$name) -ErrorAction SilentlyContinue
  }
 }
}
$normal=InvokeInstalled 'normal-hooks' $workspace $true 'normal'
if(-not $normal.hiddenCommandsAbsent){throw 'Hidden test hook leaked into normal session'}
$proof=InvokeInstalled 'p2-rename-preview' $workspace $true 'rename-preview'
if(-not $proof.readOnly -or -not $proof.nonApplied -or -not $proof.refusal -or
 -not $proof.scoped -or $proof.links -ne 7 -or @($proof.scenarios).Count -ne 2 -or $proof.uiState -ne 'fresh'){
 throw 'Installed read-only Rename Preview smoke failed'
}
CheckHistorical
Write-Output ('P2_RENAME_PREVIEW_SMOKE_ROOT='+$smoke)
Write-Output ('P2_RENAME_PREVIEW_VSIX='+$candidate)
Write-Output 'P2_8_3D_INSTALLED_READONLY_RENAME_PREVIEW_TECHNICAL_PASS'
