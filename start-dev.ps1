# FinansAnaliz Hızlı Başlatma Script'i
# PowerShell ile çalıştırın: .\start-dev.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== FinansAnaliz Geliştirme Ortamı Başlatılıyor ===" -ForegroundColor Cyan
Write-Host ""

# Backend başlat
Write-Host "[1/2] Backend başlatılıyor..." -ForegroundColor Yellow
$backendPath = Join-Path $ProjectRoot "backend\FinansAnaliz.API"

if (!(Test-Path $backendPath)) {
    Write-Host "  HATA: Backend klasörü bulunamadı: $backendPath" -ForegroundColor Red
    exit 1
}

# Backend'i yeni bir PowerShell penceresinde başlat
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend başlatılıyor...' -ForegroundColor Green; dotnet run" -WindowStyle Normal

Write-Host "  Backend başlatıldı (yeni pencerede)" -ForegroundColor Green
Write-Host "  Backend URL: http://localhost:5297" -ForegroundColor Gray
Write-Host ""

# Kısa bir bekleme
Start-Sleep -Seconds 3

# Frontend başlat
Write-Host "[2/2] Frontend başlatılıyor..." -ForegroundColor Yellow
$frontendPath = Join-Path $ProjectRoot "frontend\finans-analiz-ui"

if (!(Test-Path $frontendPath)) {
    Write-Host "  HATA: Frontend klasörü bulunamadı: $frontendPath" -ForegroundColor Red
    exit 1
}

# node_modules kontrolü
if (!(Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "  node_modules bulunamadı, npm install çalıştırılıyor..." -ForegroundColor Yellow
    Set-Location $frontendPath
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  HATA: npm install başarısız!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  npm install tamamlandı" -ForegroundColor Green
}

# Frontend'i yeni bir PowerShell penceresinde başlat
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend başlatılıyor...' -ForegroundColor Green; npm run dev" -WindowStyle Normal

Write-Host "  Frontend başlatıldı (yeni pencerede)" -ForegroundColor Green
Write-Host "  Frontend URL: http://localhost:5173" -ForegroundColor Gray
Write-Host ""

# Başlatma tamamlandı
Write-Host "=== Başlatma Tamamlandı! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Uygulamalar şu adreslerde çalışıyor:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:5297" -ForegroundColor White
Write-Host ""
Write-Host "Tarayıcınızda http://localhost:5173 adresini açabilirsiniz." -ForegroundColor Yellow
Write-Host ""
Write-Host "Not: Uygulamaları durdurmak için açılan PowerShell pencerelerini kapatın." -ForegroundColor Gray
