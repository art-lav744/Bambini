$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"

Write-Host "=== Outdoor Together: local development ===" -ForegroundColor Cyan

if (-not (Test-Path $Python)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    Push-Location $Backend
    python -m venv .venv
    Pop-Location
}

Write-Host "Installing/updating backend dependencies..." -ForegroundColor Yellow
& $Python -m pip install -r (Join-Path $Backend "requirements.txt")

Write-Host "Starting FastAPI on http://127.0.0.1:8000 ..." -ForegroundColor Green
$BackendCommand = "Set-Location '$Backend'; & '$Python' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $BackendCommand

Write-Host "Waiting for backend health check..." -ForegroundColor Yellow
$BackendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $Response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 1
        if ($Response.status -eq "ok") {
            $BackendReady = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 700
    }
}

if (-not $BackendReady) {
    Write-Host "Backend did not become ready. Check the FastAPI PowerShell window." -ForegroundColor Red
    exit 1
}

Write-Host "Backend is ready." -ForegroundColor Green

Push-Location $Frontend
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Starting Vite on http://localhost:5173 ..." -ForegroundColor Green
npm run dev
Pop-Location
