$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"

Write-Host "=== Bambini: Android HTTPS mode ===" -ForegroundColor Cyan

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "cloudflared is not installed." -ForegroundColor Yellow
    Write-Host "Install it once with:" -ForegroundColor White
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Green
    Write-Host "Then run .\start-android.ps1 again." -ForegroundColor White
    exit 1
}

if (-not (Test-Path $Python)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    Push-Location $Backend
    python -m venv .venv
    Pop-Location
}

Write-Host "Installing/updating backend dependencies..." -ForegroundColor Yellow
& $Python -m pip install -r (Join-Path $Backend "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend dependency installation failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Push-Location $Frontend
try {
    if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        npm.cmd install
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    Write-Host "Building the frontend for stable Android testing..." -ForegroundColor Yellow
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend build failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

$BackendReady = $false
try {
    $Response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2
    $BackendReady = $Response.status -eq "ok"
} catch {
    $BackendReady = $false
}

if (-not $BackendReady) {
    Write-Host "Starting FastAPI on http://127.0.0.1:8000 ..." -ForegroundColor Green
    $BackendCommand = "Set-Location '$Backend'; & '$Python' -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
    Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $BackendCommand
}

Write-Host "Waiting for the Android test server..." -ForegroundColor Yellow
$AppReady = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $ApiResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 2
        $ProfileResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8000/profile" -UseBasicParsing -TimeoutSec 2
        if ($ApiResponse.status -eq "ok" -and $ProfileResponse.StatusCode -eq 200) {
            $AppReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $AppReady) {
    Write-Host "The Android test server did not become ready." -ForegroundColor Red
    Write-Host "Check the FastAPI PowerShell window for details." -ForegroundColor Yellow
    exit 1
}

Write-Host "App is ready: http://127.0.0.1:8000/profile" -ForegroundColor Green
Write-Host "Opening HTTPS tunnel. Use the https://...trycloudflare.com URL on Android." -ForegroundColor Green
Write-Host "Keep this window open while testing." -ForegroundColor Yellow
cloudflared tunnel --url http://127.0.0.1:8000
