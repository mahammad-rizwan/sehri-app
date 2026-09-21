# Sehri Connect - Emulator Connection Manager
param(
    [string]$Action = "start",
    [string]$AVD = "Pixel_8a",
    [int]$Timeout = 60
)

Write-Host "🌙 Sehri Connect - Emulator Manager" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

function Test-EmulatorConnection {
    Write-Status "Checking emulator connection..." "Yellow"
    $devices = adb devices 2>$null
    $connectedDevices = $devices | Select-String "device$"
    
    if ($connectedDevices) {
        Write-Status "✅ Emulator connected successfully!" "Green"
        adb devices
        return $true
    } else {
        Write-Status "❌ No connected emulator found" "Red"
        return $false
    }
}

function Reset-ADB {
    Write-Status "Resetting ADB connection..." "Yellow"
    adb kill-server | Out-Null
    Start-Sleep -Seconds 2
    adb start-server | Out-Null
}

function Start-Emulator {
    Write-Status "Starting Android emulator: $AVD" "Yellow"
    
    # Check if AVD exists
    $avdList = emulator -list-avds 2>$null
    if ($avdList -notcontains $AVD) {
        Write-Status "❌ AVD '$AVD' not found. Available AVDs:" "Red"
        emulator -list-avds
        return $false
    }
    
    # Kill existing emulator processes
    Write-Status "Stopping existing emulator processes..." "Yellow"
    Get-Process -Name "*emulator*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Reset ADB
    Reset-ADB
    
    # Start emulator
    Write-Status "Launching emulator (this may take a few minutes)..." "Yellow"
    Start-Process -FilePath "emulator" -ArgumentList "-avd", $AVD, "-no-snapshot-load", "-no-audio", "-gpu", "host" -WindowStyle Minimized
    
    # Wait for connection
    $counter = 0
    do {
        Start-Sleep -Seconds 5
        $counter += 5
        Write-Status "Waiting for emulator... ($counter/$Timeout seconds)" "Yellow"
        
        if (Test-EmulatorConnection) {
            Write-Status "🎉 Emulator ready for development!" "Green"
            return $true
        }
        
    } while ($counter -lt $Timeout)
    
    Write-Status "❌ Emulator startup timeout after $Timeout seconds" "Red"
    return $false
}

function Fix-Connection {
    Write-Status "Attempting to fix emulator connection..." "Yellow"
    
    Reset-ADB
    
    if (Test-EmulatorConnection) {
        Write-Status "🔧 Connection fixed!" "Green"
        return $true
    }
    
    Write-Status "Trying to restart emulator..." "Yellow"
    return Start-Emulator
}

function Stop-Emulator {
    Write-Status "Stopping emulator..." "Yellow"
    
    # Graceful shutdown
    adb emu kill 2>$null
    Start-Sleep -Seconds 3
    
    # Force kill
    Get-Process -Name "*emulator*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Reset ADB
    adb kill-server | Out-Null
    
    Write-Status "✅ Emulator stopped" "Green"
}

function Show-Status {
    Write-Status "Current emulator status:" "Cyan"
    
    Write-Host "`n📱 Available AVDs:" -ForegroundColor Cyan
    emulator -list-avds
    
    Write-Host "`n🔌 Connected devices:" -ForegroundColor Cyan
    adb devices
    
    Write-Host "`n🏃 Running emulator processes:" -ForegroundColor Cyan
    $processes = Get-Process -Name "*emulator*" -ErrorAction SilentlyContinue
    if ($processes) {
        $processes | Format-Table ProcessName, Id, CPU -AutoSize
    } else {
        Write-Host "No emulator processes running" -ForegroundColor Gray
    }
}

# Main execution
switch ($Action.ToLower()) {
    "start" {
        if (Start-Emulator) {
            Write-Status "You can now run: npx expo run:android" "Cyan"
        }
    }
    "stop" {
        Stop-Emulator
    }
    "fix" {
        Fix-Connection
    }
    "status" {
        Show-Status
    }
    "restart" {
        Stop-Emulator
        Start-Sleep -Seconds 3
        Start-Emulator
    }
    default {
        Write-Host "Usage: .\emulator-manager.ps1 [start|stop|fix|status|restart]" -ForegroundColor Yellow
        Write-Host "Available actions:" -ForegroundColor Cyan
        Write-Host "  start   - Start the emulator"
        Write-Host "  stop    - Stop the emulator"  
        Write-Host "  fix     - Fix connection issues"
        Write-Host "  status  - Show current status"
        Write-Host "  restart - Restart the emulator"
    }
}