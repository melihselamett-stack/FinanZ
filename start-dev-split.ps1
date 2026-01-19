# FinansAnaliz Split Terminal Başlatma Script'i
# VS Code'da split terminal için kullanın
# PowerShell ile çalıştırın: .\start-dev-split.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== FinansAnaliz Split Terminal Başlatma ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bu script VS Code terminal'inde çalıştırılmalıdır." -ForegroundColor Yellow
Write-Host ""
Write-Host "Adımlar:" -ForegroundColor Cyan
Write-Host "1. VS Code'da Terminal'i açın (Ctrl+`)" -ForegroundColor White
Write-Host "2. Terminal'i split yapın (sağ üstteki split butonu veya Ctrl+Shift+5)" -ForegroundColor White
Write-Host "3. Sol terminalde backend, sağ terminalde frontend komutlarını çalıştırın" -ForegroundColor White
Write-Host ""
Write-Host "=== Komutlar ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "SOL TERMINAL (Backend):" -ForegroundColor Green
Write-Host "cd backend\FinansAnaliz.API" -ForegroundColor Yellow
Write-Host "dotnet run" -ForegroundColor Yellow
Write-Host ""
Write-Host "SAĞ TERMINAL (Frontend):" -ForegroundColor Green
Write-Host "cd frontend\finans-analiz-ui" -ForegroundColor Yellow
Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "=== Alternatif: Otomatik Başlatma ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "VS Code'da split terminal açıldıktan sonra, bu script'i çalıştırabilirsiniz:" -ForegroundColor White
Write-Host ""

# Eğer VS Code içindeyse, komutları otomatik çalıştırmayı dene
$backendPath = Join-Path $ProjectRoot "backend\FinansAnaliz.API"
$frontendPath = Join-Path $ProjectRoot "frontend\finans-analiz-ui"

# node_modules kontrolü
if (!(Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "node_modules bulunamadı, npm install çalıştırılıyor..." -ForegroundColor Yellow
    Set-Location $frontendPath
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "HATA: npm install başarısız!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Not: VS Code'da split terminal açmak için:" -ForegroundColor Gray
Write-Host "  - Terminal açıkken sağ üstteki 'Split Terminal' butonuna tıklayın" -ForegroundColor Gray
Write-Host "  - Veya Ctrl+Shift+5 tuşlarına basın" -ForegroundColor Gray
Write-Host ""
