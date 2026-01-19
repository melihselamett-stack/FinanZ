# FinansAnaliz Durdurma Script'i
# PowerShell ile çalıştırın: .\stop-dev.ps1

Write-Host "=== FinansAnaliz Servisleri Durduruluyor ===" -ForegroundColor Cyan
Write-Host ""

# Backend process'lerini durdur
Write-Host "[1/2] Backend process'leri durduruluyor..." -ForegroundColor Yellow
$backendProcesses = Get-Process | Where-Object {
    $_.ProcessName -like "*FinansAnaliz*" -or 
    ($_.Path -like "*FinansAnaliz.API*" -and $_.ProcessName -eq "dotnet")
}

if ($backendProcesses) {
    foreach ($proc in $backendProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  Process durduruldu: $($proc.ProcessName) (ID: $($proc.Id))" -ForegroundColor Green
        } catch {
            Write-Host "  Process durdurulamadı: $($proc.ProcessName) (ID: $($proc.Id))" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  Backend process bulunamadı" -ForegroundColor Gray
}

# Frontend process'lerini durdur (node/vite)
Write-Host ""
Write-Host "[2/2] Frontend process'leri durduruluyor..." -ForegroundColor Yellow
$frontendProcesses = Get-Process | Where-Object {
    ($_.ProcessName -eq "node" -and $_.Path -like "*finans-analiz-ui*") -or
    ($_.ProcessName -eq "node" -and $_.CommandLine -like "*vite*")
}

if ($frontendProcesses) {
    foreach ($proc in $frontendProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  Process durduruldu: $($proc.ProcessName) (ID: $($proc.Id))" -ForegroundColor Green
        } catch {
            Write-Host "  Process durdurulamadı: $($proc.ProcessName) (ID: $($proc.Id))" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  Frontend process bulunamadı" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Durdurma Tamamlandı! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Tüm servisler durduruldu. Yeniden başlatmak için .\start-dev.ps1 çalıştırın." -ForegroundColor Cyan
