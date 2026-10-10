$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

function Invoke-NativeChecked {
    param(
        [Parameter(Mandatory=$true)][scriptblock]$Command,
        [Parameter(Mandatory=$true)][string]$Name
    )
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

Write-Host "`n=== 1. NODE CORE ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm install } "npm install (core)"
Invoke-NativeChecked { npm test } "npm test"

Write-Host "`n=== 2. REAL VITEST ===" -ForegroundColor Cyan
Push-Location ".\fixtures\workspace\frontend"
Invoke-NativeChecked { npm install } "npm install (frontend)"
Invoke-NativeChecked { npx vitest run } "vitest run"
Pop-Location

Write-Host "`n=== 3. REAL BACKEND TESTS ===" -ForegroundColor Cyan
Invoke-NativeChecked { dotnet test --project ".\fixtures\workspace\backend\Backend.FeatureTests.csproj" -c Release } "backend dotnet test"

Write-Host "`n=== 4. BUILD DOTNET WORKER ===" -ForegroundColor Cyan
Invoke-NativeChecked { dotnet build ".\workers\dotnet\FeatureProjection.DotNetWorker.csproj" -c Release } "dotnet worker build"

Write-Host "`n=== 5. REAL XUNIT CASE MATERIALIZATION ===" -ForegroundColor Cyan
$backend = (Resolve-Path ".\fixtures\workspace\backend").Path
$backendFeatures = (Resolve-Path ".\fixtures\workspace\backend\Features").Path
$backendProject = (Resolve-Path ".\fixtures\workspace\backend\Backend.FeatureTests.csproj").Path
$workerDll = (Resolve-Path ".\workers\dotnet\bin\Release\net8.0\FeatureProjection.DotNetWorker.dll").Path

$inputJson = @{
    command = "materialize-xunit"
    featureSpaceId = "app"
    source = @{
        id = "backend"
        role = "backend"
        root = $backendFeatures
        adapter = "xunit-v3"
        frameworkProject = $backend
        projectFile = $backendProject
    }
} | ConvertTo-Json -Depth 8 -Compress

$raw = $inputJson | dotnet $workerDll
Write-Host $raw
$result = $raw | ConvertFrom-Json

if ($result.diagnostics.Count -gt 0) {
    throw "xUnit materializer diagnostics: $($result.diagnostics | ConvertTo-Json -Depth 8 -Compress)"
}

$actual = @($result.cases | ForEach-Object { $_.situationId } | Sort-Object)
$expected = @("email_has_invalid_format", "passwords_dont_match")
if (($actual -join "|") -ne ($expected -join "|")) {
    throw "Unexpected xUnit situations. Expected '$($expected -join ', ')', got '$($actual -join ', ')'"
}

Write-Host "xUnit situations OK: $($actual -join ', ')" -ForegroundColor Green

Write-Host "`n=== 6. REAL END-TO-END PROJECTION (NO MOCK CASES) ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm run demo:real } "real end-to-end projection"

Write-Host "`n=== REAL P0 CHECK PASSED ===" -ForegroundColor Green
