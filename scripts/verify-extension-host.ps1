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

Write-Host "`n=== 1. INSTALL/BUILD EXTENSION ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm install } "npm install"
Invoke-NativeChecked { npm run build } "npm run build"

Write-Host "`n=== 2. INSTALL FIXTURE FRONTEND DEPENDENCIES ===" -ForegroundColor Cyan
Push-Location ".\fixtures\workspace\frontend"
Invoke-NativeChecked { npm install } "frontend npm install"
Pop-Location

Write-Host "`n=== 3. PREPARE CLEAN BOOTSTRAP CONDITIONS ===" -ForegroundColor Cyan
Remove-Item ".\workers\dotnet\bin" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".\workers\dotnet\obj" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".\fixtures\workspace\backend\bin" -Recurse -Force -ErrorAction SilentlyContinue
# Keep/restore backend NuGet assets so Roslyn can open the project before the extension's
# explicit trusted Refresh builds the parameterized test assembly.
Invoke-NativeChecked { dotnet restore ".\fixtures\workspace\backend\Backend.FeatureTests.csproj" } "backend dotnet restore"

if (-not $env:VSCODE_EXECUTABLE_PATH) {
    # Build the candidate list explicitly as an array. PowerShell unwraps a
    # single pipeline result to a scalar, so indexing `$candidates[0]` on a
    # single string would return the first character (for example, "C").
    $candidatePaths = @()
    if ($env:LOCALAPPDATA) {
        $candidatePaths += (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe")
        $candidatePaths += (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code Insiders\Code - Insiders.exe")
    }
    if ($env:ProgramFiles) {
        $candidatePaths += (Join-Path $env:ProgramFiles "Microsoft VS Code\Code.exe")
        $candidatePaths += (Join-Path $env:ProgramFiles "Microsoft VS Code Insiders\Code - Insiders.exe")
    }
    if (${env:ProgramFiles(x86)}) {
        $candidatePaths += (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code\Code.exe")
        $candidatePaths += (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code Insiders\Code - Insiders.exe")
    }

    $candidates = @($candidatePaths | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) })
    $installedCode = $candidates | Select-Object -First 1
    if ($installedCode) {
        $env:VSCODE_EXECUTABLE_PATH = [string]$installedCode
        Write-Host "Using installed VS Code: $env:VSCODE_EXECUTABLE_PATH"
    } else {
        Write-Host "Installed VS Code executable not found in common locations; @vscode/test-electron will download VS Code." -ForegroundColor Yellow
    }
}

if ($env:VSCODE_EXECUTABLE_PATH) {
    if (-not (Test-Path -LiteralPath $env:VSCODE_EXECUTABLE_PATH -PathType Leaf)) {
        throw "VSCODE_EXECUTABLE_PATH does not point to a file: '$env:VSCODE_EXECUTABLE_PATH'"
    }
    $resolvedVsCode = (Resolve-Path -LiteralPath $env:VSCODE_EXECUTABLE_PATH).Path
    $fileName = [System.IO.Path]::GetFileName($resolvedVsCode)
    if ($fileName -notin @('Code.exe', 'Code - Insiders.exe')) {
        throw "Unexpected VS Code executable path: '$resolvedVsCode'"
    }
    $env:VSCODE_EXECUTABLE_PATH = $resolvedVsCode
}

Write-Host "`n=== 4. EXTENSION HOST SMOKE ===" -ForegroundColor Cyan
Invoke-NativeChecked { npm run test:extension } "Extension Host smoke"

Write-Host "`n=== EXTENSION HOST SMOKE PASSED ===" -ForegroundColor Green
