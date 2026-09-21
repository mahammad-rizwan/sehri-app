@echo off
cls
echo.
echo 🌙 Sehri Connect - Quick Emulator Starter
echo ==========================================
echo.

:: Check if emulator is already running
echo [INFO] Checking current emulator status...
adb devices | findstr "device" >nul
if %errorlevel% == 0 (
    echo ✅ Emulator already connected!
    adb devices
    echo.
    echo Ready to run your app! Use: npx expo run:android
    pause
    exit /b 0
)

:: Kill existing processes and reset ADB
echo [INFO] Resetting ADB connection...
adb kill-server >nul 2>&1
timeout /t 2 /nobreak >nul
adb start-server >nul 2>&1

:: Start emulator
echo [INFO] Starting Pixel_8a emulator...
echo [INFO] This may take a few minutes, please wait...
echo.
start /min emulator -avd Pixel_8a -no-snapshot-load -no-audio -gpu host

:: Wait for emulator to connect
echo [INFO] Waiting for emulator to boot up...
set /a counter=0
:wait_loop
timeout /t 5 /nobreak >nul
set /a counter+=5

adb devices | findstr "device" >nul
if %errorlevel% == 0 (
    echo.
    echo ✅ SUCCESS! Emulator connected!
    echo.
    adb devices
    echo.
    echo 🎉 Ready to develop! You can now run:
    echo    npx expo run:android
    echo.
    pause
    exit /b 0
)

echo [%counter%s] Still waiting for emulator...
if %counter% lss 120 goto wait_loop

echo.
echo ❌ Emulator startup timeout. Try running the PowerShell script for more options:
echo    .\scripts\emulator-manager.ps1 fix
echo.
pause
exit /b 1