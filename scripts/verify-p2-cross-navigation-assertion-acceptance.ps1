[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $root
$candidate=Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-cross-navigation-assertions-candidate.vsix'
$historical=@(
 @('RELEASE_VSIX',(Join-Path $root 'artifacts\releases\feature-projection-prototype-p0-0.1.0.vsix'),'49704A1072FD571BFEC94139BBC865F9B75F40CD899E6CDC531E9E605E951CC1'),
 @('RELEASE_ZIP',(Join-Path $root 'artifacts\releases\feature-projection-prototype-p0-0.1.0-release.zip'),'16D23889C6702D392B9935E6794034EBA1D492FB05BC496F6FE865F28D6C8D08'),
 @('P1_CANDIDATE',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p1-acceptance-candidate.vsix'),'44284D06F1A5C67A24CDF52B03F372A7D12249C3258A2A1F6C2823061D751989'),
 @('P2_NAV_CANDIDATE',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-navigation-candidate.vsix'),'6F54B99A8D250BBFAD0BC114D37C22E7C2558EF6A36EAC9530B07BAB782AA0C8'),
 @('P2_CROSSNAV_BASE',(Join-Path $root 'artifacts\feature-projection-prototype-p0-0.1.0-p2-cross-navigation-candidate.vsix'),'F6EA46AB06D48A5067D68405863DB1280EC7C1564972EC0F4659E8DB71E434BB')
)
function CheckHistorical {
 foreach($a in $historical){
  $hash=(Get-FileHash -LiteralPath $a[1] -Algorithm SHA256).Hash
  if($hash -ne $a[2]){throw ("Historical artifact checksum changed: "+$a[0])}
 }
 Write-Output 'HISTORICAL_ARTIFACTS_UNCHANGED=PASS'
}
if(Test-Path -LiteralPath $candidate){throw 'Refusing to overwrite existing P2 cross-navigation candidate'}
CheckHistorical
& npm.cmd run build:dotnet-worker
if($LASTEXITCODE -ne 0){throw 'Worker publish failed'}
& '.\node_modules\.bin\vsce.cmd' package --out $candidate
if($LASTEXITCODE -ne 0){throw 'New P2 candidate packaging failed'}
Write-Output ('CROSSNAV_VSIX_SIZE='+([IO.FileInfo]::new($candidate)).Length)
Write-Output ('CROSSNAV_VSIX_SHA256='+(Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash)
$smokeRoot=Join-Path ([IO.Path]::GetTempPath()) ('feature-projection-crossnav-'+[guid]::NewGuid().ToString('N'))
if(Test-Path -LiteralPath $smokeRoot){throw 'Refusing existing smoke root'}
[IO.Directory]::CreateDirectory($smokeRoot)|Out-Null
$extensions=Join-Path $smokeRoot 'extensions'
$data=Join-Path $smokeRoot 'user-data-install'
[IO.Directory]::CreateDirectory($extensions)|Out-Null
[IO.Directory]::CreateDirectory($data)|Out-Null
$codeCandidates=@(
 (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'),
 (Join-Path $env:ProgramFiles 'Microsoft VS Code\bin\code.cmd')
)
$codeCli=@($codeCandidates|Where-Object {Test-Path -LiteralPath $_ -PathType Leaf})|Select-Object -First 1
if(-not $codeCli){throw 'Installed VS Code CLI unavailable'}
& $codeCli --user-data-dir $data --extensions-dir $extensions --install-extension $candidate --force
if($LASTEXITCODE -ne 0){throw 'Isolated extension install failed'}
$found=@(Get-ChildItem -LiteralPath $extensions -Directory | Where-Object { $_.Name -eq 'local-prototype.feature-projection-prototype-p0-0.1.0' })
if($found.Count -ne 1){throw 'Installed P2 crossnav candidate missing'}
& '.\scripts\verify-installed-p2-cross-navigation.ps1' -SmokeRoot $smokeRoot
if(-not $?){throw 'Installed P2 crossnav verifier failed'}
CheckHistorical
Write-Output ('P2_CROSSNAV_SMOKE_ROOT='+$smokeRoot)
Write-Output ('P2_CROSSNAV_VSIX='+$candidate)
Write-Output 'P2_CROSS_NAVIGATION_INSTALLED_ACCEPTANCE_DONE'
