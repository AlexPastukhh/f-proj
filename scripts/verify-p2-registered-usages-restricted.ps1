[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$smoke='C:\Users\alexa\AppData\Local\Temp\feature-projection-usageview-114750511f14416f8b81d1dffe5530ce'
$extensions=Join-Path $smoke 'extensions'
$workspace=Join-Path $smoke 'workspace-restricted'
$user=Join-Path $smoke 'profile-restricted'
$result=Join-Path $smoke 'result-restricted.json'
foreach($name in @($workspace,$user,$result)){if(Test-Path -LiteralPath $name){throw 'Refuse reuse restricted path'}}
foreach($part in @('frontend','backend')){
 $src=Join-Path $root ('fixtures\workspace\'+$part)
 $dst=Join-Path $workspace $part
 [IO.Directory]::CreateDirectory($dst)|Out-Null
 Get-ChildItem -LiteralPath $src -Force|Where-Object{$_.Name -notin @('node_modules','bin','obj')}|ForEach-Object{Copy-Item -LiteralPath $_.FullName -Destination $dst -Recurse -Force}
}
$vsdir=Join-Path $workspace '.vscode';[IO.Directory]::CreateDirectory($vsdir)|Out-Null
$settings=@{
 'featureProjection.featureSpaces'=@(@{
  id='app'
  sources=@(
   @{id='frontend';role='frontend';root='frontend/src/features';adapter='vitest-5';frameworkProject='frontend';configFile='vitest.config.ts'},
   @{id='backend';role='backend';root='backend/Features';adapter='xunit-v3';frameworkProject='backend';projectFile='Backend.FeatureTests.csproj'}
  )
 })
}
[IO.File]::WriteAllText((Join-Path $vsdir 'settings.json'),($settings|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
[IO.Directory]::CreateDirectory($user)|Out-Null
$env:FEATURE_PROJECTION_SMOKE_RESULT=$result
$env:FEATURE_PROJECTION_EXPECTED_VERSION='0.1.0'
$env:FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT=$extensions
$env:FEATURE_PROJECTION_SMOKE_MODE='untrusted'
$env:FEATURE_PROJECTION_TEST_MODE='1'
$exe=Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\Code.exe'
$driver=(Resolve-Path (Join-Path $root 'test\installed-driver')).Path
$suite=(Resolve-Path (Join-Path $root 'dist\test\suite\index.js')).Path
$arguments=@($workspace,"--extensionDevelopmentPath=$driver","--extensionTestsPath=$suite","--user-data-dir=$user","--extensions-dir=$extensions",
 '--disable-extension=github.copilot-chat','--disable-gpu','--skip-welcome','--skip-release-notes')
try{
 $process=Start-Process -FilePath $exe -ArgumentList $arguments -PassThru
 $deadline=[datetime]::UtcNow.AddSeconds(175)
 while([datetime]::UtcNow -lt $deadline -and !(Test-Path $result)){Start-Sleep -Milliseconds 500}
 if(!(Test-Path $result)){throw 'No restricted smoke result'}
 $proof=[IO.File]::ReadAllText($result)|ConvertFrom-Json
 Write-Output ('UNTRUSTED_SMOKE='+([IO.File]::ReadAllText($result)))
 if(-not $proof.ok -or $proof.mode -ne 'untrusted' -or $proof.trusted -ne $false){throw 'Restricted mode contract failed'}
 $logs=@(Get-ChildItem -LiteralPath $user -Recurse -File -Filter '*Feature Projection.log' -ErrorAction SilentlyContinue)
 foreach($f in $logs){
  if([IO.File]::ReadAllText($f.FullName) -match 'registered-usages:[^\r\n]*spawn'){
   throw 'Registered usages worker launched in untrusted workspace'
  }
 }
 Write-Output 'P2_8_3B_INSTALLED_RESTRICTED_MODE_USAGE_WORKER_BLOCK_PASS'
}finally{
 foreach($key in @('FEATURE_PROJECTION_SMOKE_RESULT','FEATURE_PROJECTION_EXPECTED_VERSION','FEATURE_PROJECTION_EXPECTED_EXTENSION_ROOT','FEATURE_PROJECTION_SMOKE_MODE','FEATURE_PROJECTION_TEST_MODE')){Remove-Item ('Env:'+$key) -ErrorAction SilentlyContinue}
}
