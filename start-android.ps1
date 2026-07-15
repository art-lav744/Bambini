$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DevScript = Join-Path $Root "start-dev.ps1"

Write-Host "=== Outdoor Together: Android HTTPS mode ===" -ForegroundColor Cyan

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "cloudflared is not installed." -ForegroundColor Yellow
    Write-Host "Install it once with:" -ForegroundColor White
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Green
    Write-Host "Then run .\start-android.ps1 again." -ForegroundColor White
    exit 1
}

Write-Host "Starting backend and frontend in separate windows..." -ForegroundColor Yellow
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $DevScript

Write-Host "Waiting for Vite..." -ForegroundColor Yellow
$ViteReady = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 1 | Out-Null
        $ViteReady = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $ViteReady) {
    Write-Host "Vite did not become ready. Check the development PowerShell window." -ForegroundColor Red
    exit 1
}

Write-Host "Opening HTTPS tunnel. Use the https://...trycloudflare.com URL on Android." -ForegroundColor Green
Write-Host "Keep this window open while testing." -ForegroundColor Yellow
cloudflared tunnel --url http://127.0.0.1:5173
