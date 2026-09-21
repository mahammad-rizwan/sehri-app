param([string]$Action = "status")

Write-Host "Sehri Connect - Emulator Helper" -ForegroundColor Cyan

switch ($Action) {
    "start" {
        Write-Host "Starting emulator..." -ForegroundColor Yellow
        adb kill-server
        Start-Sleep 2
        adb start-server
        Start-Process emulator -ArgumentList "-avd", "Pixel_8a", "-no-snapshot-load"
        
        $counter = 0
        do {
            Start-Sleep 5
            $counter += 5
            Write-Host "Waiting... $counter seconds" -ForegroundColor Yellow
            $devices = adb devices | Select-String "device$"
            if ($devices) {
                Write-Host "SUCCESS! Emulator connected!" -ForegroundColor Green
                adb devices
                break
            }
        } while ($counter -lt 60)
    }
    "fix" {
        Write-Host "Fixing connection..." -ForegroundColor Yellow
        adb kill-server
        Start-Sleep 2
        adb start-server
        adb devices
    }
    "status" {
        Write-Host "Current status:" -ForegroundColor Cyan
        Write-Host "Available AVDs:" -ForegroundColor Yellow
        emulator -list-avds
        Write-Host "Connected devices:" -ForegroundColor Yellow  
        adb devices
    }
    default {
        Write-Host "Usage: .\emulator-helper.ps1 [start|fix|status]" -ForegroundColor Yellow
    }
}