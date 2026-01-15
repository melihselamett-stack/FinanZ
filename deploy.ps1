# FinansAnaliz IIS Deployment Script
# PowerShell ile çalıştırın: .\deploy.ps1

param(
    [string]$OutputPath = "C:\inetpub\wwwroot\finansanaliz.pakkod.com\publish",
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== FinansAnaliz IIS Deployment ===" -ForegroundColor Cyan
Write-Host "Proje: $ProjectRoot" -ForegroundColor Gray
Write-Host "Hedef: $OutputPath" -ForegroundColor Gray

# Hedef klasörü oluştur
if (!(Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
    Write-Host "Hedef klasör oluşturuldu: $OutputPath" -ForegroundColor Green
}

if (!$SkipBuild) {
    # 1. Frontend Build
    Write-Host "`n[1/4] Frontend build ediliyor..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\frontend\finans-analiz-ui"
    
    if (!(Test-Path "node_modules")) {
        Write-Host "  npm install çalıştırılıyor..." -ForegroundColor Gray
        npm install
    }
    
    # .env.production oluştur (yoksa)
    $envFile = ".env.production"
    if (!(Test-Path $envFile)) {
        @"
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=806066917136-3kctuscckq7ulalbf79mg5p4jcpr36u4.apps.googleusercontent.com
"@ | Out-File -FilePath $envFile -Encoding UTF8
        Write-Host "  .env.production oluşturuldu" -ForegroundColor Gray
    }
    
    npm run build
    Write-Host "  Frontend build tamamlandı" -ForegroundColor Green
    
    # 2. Backend Publish
    Write-Host "`n[2/4] Backend publish ediliyor..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\backend\FinansAnaliz.API"
    dotnet publish -c Release -o $OutputPath --no-self-contained
    Write-Host "  Backend publish tamamlandı" -ForegroundColor Green
    
    Set-Location $ProjectRoot
}

# 3. Frontend dosyalarını wwwroot'a kopyala
Write-Host "`n[3/4] Frontend dosyaları wwwroot'a kopyalanıyor..." -ForegroundColor Yellow
$wwwrootPath = "$OutputPath\wwwroot"

if (!(Test-Path $wwwrootPath)) {
    New-Item -ItemType Directory -Path $wwwrootPath -Force | Out-Null
}

# dist klasöründeki dosyaları kopyala
$distPath = "$ProjectRoot\frontend\finans-analiz-ui\dist"
if (Test-Path $distPath) {
    Copy-Item -Path "$distPath\*" -Destination $wwwrootPath -Recurse -Force
    Write-Host "  Frontend dosyaları kopyalandı" -ForegroundColor Green
} else {
    Write-Host "  UYARI: dist klasörü bulunamadı. Önce frontend build edin." -ForegroundColor Red
}

# 4. Dosya listesi
Write-Host "`n[4/4] Deployment tamamlandı!" -ForegroundColor Green
Write-Host "`nOluşturulan dosyalar:" -ForegroundColor Cyan
Get-ChildItem $OutputPath -Recurse -File | Select-Object -First 20 | ForEach-Object {
    Write-Host "  $($_.FullName.Replace($OutputPath, ''))" -ForegroundColor Gray
}

$fileCount = (Get-ChildItem $OutputPath -Recurse -File).Count
Write-Host "  ... toplam $fileCount dosya" -ForegroundColor Gray

# IIS Talimatları
Write-Host @"

=== IIS Kurulum Talimatları ===

1. IIS Manager'ı açın

2. Sites > Add Website:
   - Site name: FinansAnaliz
   - Physical path: $OutputPath
   - Binding: 
     - Type: https
     - Host name: finansanaliz.pakkod.com
     - SSL certificate: (sertifikanızı seçin)

3. Application Pool ayarları:
   - .NET CLR version: No Managed Code
   - Managed pipeline mode: Integrated
   - Identity: ApplicationPoolIdentity (veya özel hesap)

4. IIS'i yeniden başlatın:
   iisreset

5. Test edin:
   https://finansanaliz.pakkod.com

=== Onemli Dosya Kontrolleri ===

wwwroot/index.html    : $(if(Test-Path "$wwwrootPath\index.html"){"[OK] Mevcut"}else{"[X] YOK!"})
wwwroot/assets/       : $(if(Test-Path "$wwwrootPath\assets"){"[OK] Mevcut"}else{"[X] YOK!"})
FinansAnaliz.API.dll  : $(if(Test-Path "$OutputPath\FinansAnaliz.API.dll"){"[OK] Mevcut"}else{"[X] YOK!"})
web.config            : $(if(Test-Path "$OutputPath\web.config"){"[OK] Mevcut"}else{"[X] YOK!"})
appsettings.json      : $(if(Test-Path "$OutputPath\appsettings.json"){"[OK] Mevcut"}else{"[X] YOK!"})

"@ -ForegroundColor Cyan

Write-Host "Deployment tamamlandı!" -ForegroundColor Green
