param(
 [Parameter(Mandatory=$true)][string]$SmokeRoot,
 [Parameter(Mandatory=$true)][string]$CandidatePath,
 [Parameter(Mandatory=$true)][string]$ExpectedSha256
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$smoke=(Resolve-Path -LiteralPath $SmokeRoot).Path
$candidate=(Resolve-Path -LiteralPath $CandidatePath).Path
$sha=(Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash
if($sha -ne $ExpectedSha256.ToUpperInvariant()){throw ('Candidate SHA mismatch: '+$sha)}
$installed=Join-Path $smoke 'extensions\local-prototype.feature-projection-prototype-p0-0.1.0'
if(!(Test-Path -LiteralPath (Join-Path $installed 'workers\dotnet\runtime\FeatureProjection.DotNetWorker.dll'))){
 throw 'Smoke result is not associated with a complete isolated installed extension'
}
function Read-Stage([string]$stage,[string]$mode,[bool]$trusted){
 $file=Join-Path $smoke ('result-'+$stage+'.json')
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw ('Missing installed smoke result '+$stage)}
 $value=Get-Content -LiteralPath $file -Raw -Encoding UTF8|ConvertFrom-Json
 if(!$value.ok -or $value.mode -ne $mode -or $value.trusted -ne $trusted){
  throw ('Incorrect installed smoke result '+$stage+': '+(Get-Content $file -Raw))
 }
 $extensionPath=[IO.Path]::GetFullPath([string]$value.extensionPath)
 if(!$extensionPath.ToLowerInvariant().StartsWith(([IO.Path]::GetFullPath($installed)).ToLowerInvariant())){
  throw ('Smoke stage not from pinned installed VSIX: '+$stage)
 }
 return $value
}
$normal=Read-Stage 'normal' 'normal-hooks' $true
$rename=Read-Stage 'rename-preview' 'p2-rename-preview' $true
$usage=Read-Stage 'registered-usages' 'p2-registered-usages' $true
$configure=Read-Stage 'configure' 'trusted' $true
$restricted=Read-Stage 'restricted' 'untrusted' $false
$cross=Read-Stage 'cross-navigation' 'p2-cross-navigation' $true
if(!$normal.hiddenCommandsAbsent){throw 'Hidden automation hooks leaked'}
if(!$rename.readOnly -or !$rename.nonApplied -or !$rename.refusal -or !$rename.scoped -or
 $rename.links -ne 7 -or @($rename.scenarios).Count -ne 2 -or $rename.uiState -ne 'fresh'){
 throw 'Rename Preview installed smoke contract failed'
}
if(!$usage.view -or !$usage.navigation -or !$usage.codeLens -or !$usage.readOnly -or
 !$usage.scoped -or $usage.registrations -ne 2 -or $usage.featureUsages -ne 3 -or
 $usage.uiState -ne 'fresh'){throw 'Usage View installed smoke contract failed'}
if(!$configure.configured -or @($configure.situations).Count -ne 3 -or
 $configure.finalState -ne 'stale'){throw 'Configure/Refresh smoke failed'}
if(($restricted.ruleIds -notcontains 'worker/untrusted-workspace') -or
 ($restricted.ruleIds -notcontains 'worker/untrusted-project-analysis')){
 throw 'Restricted Mode worker boundary failed'
}
$logs=@(Get-ChildItem (Join-Path $smoke 'profile-restricted') -File -Recurse -Filter '*Feature Projection.log' -ErrorAction SilentlyContinue)
foreach($log in $logs){
 if([IO.File]::ReadAllText($log.FullName) -match '(registered-usages|rename-preview):[^\r\n]*spawn'){
  throw 'Restricted Mode launched symbol worker'
 }
}
if(!$cross.bidirectional -or !$cross.repeatedLabelsIsolated -or !$cross.contextMenu -or
 !$cross.paletteNavigation -or !$cross.assertionSourceNavigation -or
 $cross.situations -ne 6 -or $cross.assertionSourceActions -ne 10 -or
 $cross.uiState -ne 'fresh'){throw 'Cross-navigation installed smoke contract failed'}
$prefix=$root.TrimEnd('\')+'\'
if(!$candidate.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){
 throw 'Candidate path must be inside the repository'
}
$relative=$candidate.Substring($prefix.Length).Replace('\','/')
$reportDir=Join-Path $root 'artifacts\local-acceptance-results'
[IO.Directory]::CreateDirectory($reportDir)|Out-Null
$reportPath=Join-Path $reportDir ('mvp-installed-'+[guid]::NewGuid().ToString('N')+'.json')
$report=[ordered]@{
 status='INSTALLED_TECHNICAL_PASS'
 ordinaryUserManualAcceptance='PENDING'
 gitCommit=((& git -C $root rev-parse HEAD) -join '').Trim()
 candidateRelativePath=$relative
 candidateSha256=$sha
 sourceProofs='PASSED_IN_AGGREGATE_RUN_NOT_RECHECKED_BY_REPORT_RECONCILIATION'
 normalProfile='PASS'
 configureRefresh='PASS'
 registeredUsages='PASS'
 readOnlyRenamePreview='PASS'
 restrictedMode='PASS'
 p2CrossNavigation='PASS'
 historicalArtifacts='CHECKED_IN_AGGREGATE_RUN'
 smokeRoot=$smoke
 timestampUtc=[datetime]::UtcNow.ToString('o')
}
[IO.File]::WriteAllText($reportPath,($report|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
$echo=Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8|ConvertFrom-Json
if($echo.candidateSha256 -ne $sha -or $echo.status -ne 'INSTALLED_TECHNICAL_PASS'){
 throw 'Persisted acceptance report round-trip mismatch'
}
Write-Output ('MVP_AGGREGATE_VERIFIED_REPORT='+$reportPath)
Write-Output 'MVP_AGGREGATE_RESULTS_RECONCILED=PASS_MANUAL_PENDING'
