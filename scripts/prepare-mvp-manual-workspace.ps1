[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspace='C:\Users\alexa\Downloads\feature-projection-mvp-manual-acceptance'
if(Test-Path -LiteralPath $workspace){throw "Refusing to overwrite existing manual workspace: $workspace"}
$source=Join-Path $root 'fixtures\workspace-scope-isolation'
function CopyFixture([string]$from,[string]$to){
 if(!(Test-Path -LiteralPath $from -PathType Container)){throw "Missing fixture $from"}
 [IO.Directory]::CreateDirectory($to)|Out-Null
 foreach($item in Get-ChildItem -LiteralPath $from -Force){
  if($item.Name -notin @('node_modules','bin','obj','dist')){
   Copy-Item -LiteralPath $item.FullName -Destination $to -Recurse -Force
  }
 }
}
foreach($app in @('account-web','billing-web')){
 $src=Join-Path $source ('apps\'+$app)
 $dst=Join-Path $workspace ('apps\'+$app)
 CopyFixture $src $dst
 $modules=Join-Path $src 'node_modules'
 if(!(Test-Path -LiteralPath (Join-Path $modules 'vitest\package.json'))){throw "Missing installed Vitest dependencies: $modules"}
 New-Item -ItemType Junction -Path (Join-Path $dst 'node_modules') -Target $modules|Out-Null
}
foreach($name in @('account-api','billing-api')){
 CopyFixture (Join-Path $source ('services\'+$name)) (Join-Path $workspace ('services\'+$name))
}
CopyFixture (Join-Path $root 'fixtures\responsibility-proof') (Join-Path $workspace 'responsibility')
CopyFixture (Join-Path $root 'fixtures\assertion-helper-proof') (Join-Path $workspace 'assertions')
$spaces=@(
 @{id='accounts';sources=@(
  @{id='frontend';role='frontend';root='apps/account-web/spec/feature-tests';adapter='vitest-5';frameworkProject='apps/account-web'},
  @{id='backend';role='backend';root='services/account-api/Features';adapter='xunit-v3';frameworkProject='services/account-api';projectFile='Account.Api.FeatureTests.csproj'}
 )},
 @{id='billing';sources=@(
  @{id='frontend';role='frontend';root='apps/billing-web/spec/feature-tests';adapter='vitest-5';frameworkProject='apps/billing-web'},
  @{id='backend';role='backend';root='services/billing-api/Features';adapter='xunit-v3';frameworkProject='services/billing-api';projectFile='Billing.Api.FeatureTests.csproj'}
 )},
 @{id='responsibility';sources=@(
  @{id='backend';role='backend';root='responsibility/Features';adapter='xunit-v3';frameworkProject='responsibility';projectFile='Responsibility.FeatureTests.csproj'}
 )},
 @{id='assertions';sources=@(
  @{id='backend';role='backend';root='assertions/Features';adapter='xunit-v3';frameworkProject='assertions';projectFile='AssertionHelper.FeatureTests.csproj'}
 )}
)
$settingsDir=Join-Path $workspace '.vscode'
[IO.Directory]::CreateDirectory($settingsDir)|Out-Null
$settings=@{'featureProjection.featureSpaces'=$spaces} |ConvertTo-Json -Depth 12
[IO.File]::WriteAllText((Join-Path $settingsDir 'settings.json'),$settings,[Text.UTF8Encoding]::new($false))
foreach($csproj in @(
 'services\account-api\Account.Api.FeatureTests.csproj',
 'services\billing-api\Billing.Api.FeatureTests.csproj',
 'responsibility\Responsibility.FeatureTests.csproj',
 'assertions\AssertionHelper.FeatureTests.csproj'
)){
 & dotnet restore (Join-Path $workspace $csproj) --nologo
 if($LASTEXITCODE -ne 0){throw "Cannot restore manual fixture $csproj"}
}
$files=@(Get-ChildItem -LiteralPath $workspace -Recurse -File -Force |
 Where-Object{$_.FullName -notmatch '\\(node_modules|bin|obj|dist)\\' -and
 $_.Extension -in @('.cs','.csproj','.ts','.tsx','.json')})
$baseline=[ordered]@{}
foreach($f in $files){
 $rel=$f.FullName.Substring($workspace.Length+1).Replace('\','/')
 $baseline[$rel]=(Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
}
$reports=Join-Path $root 'artifacts\local-acceptance-results'
[IO.Directory]::CreateDirectory($reports)|Out-Null
$manifest=Join-Path $reports 'mvp-manual-workspace-baseline.json'
if(Test-Path -LiteralPath $manifest){throw 'Refuse to overwrite existing baseline manifest'}
$data=[ordered]@{workspace=$workspace;createdAtUtc=[datetime]::UtcNow.ToString('o');files=$baseline}
[IO.File]::WriteAllText($manifest,($data|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
Write-Output 'MANUAL_MVP_WORKSPACE_PREPARED=PASS'
Write-Output ('WORKSPACE='+$workspace)
Write-Output ('FEATURE_SPACES='+($spaces|ForEach-Object{$_.id}) -join ',')
Write-Output ('BASELINE_FILES='+$files.Count)
Write-Output ('BASELINE_MANIFEST='+$manifest)
