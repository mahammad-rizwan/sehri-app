@echo off
cls
echo.
echo 🌙 Sehri Connect - Development Launcher
echo ==========================================
echo.
echo Choose your development setup:
echo.
echo [1] Standard Development (npm start)
echo [2] LAN Mode - Multi-device support
echo [3] Tunnel Mode - Universal access  
echo [4] Start Emulator First
echo [5] Fix Emulator Connection
echo [6] Clear Cache and Start
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" (
    echo Starting standard development server...
    npm start
) else if "%choice%"=="2" (
    echo Starting LAN mode for multiple devices...
    npm run start:lan
) else if "%choice%"=="3" (
    echo Starting tunnel mode for universal access...
    npm run start:tunnel
) else if "%choice%"=="4" (
    echo Starting Android emulator...
    npm run emulator:start
    pause
    echo Now starting development server...
    npm run start:lan
) else if "%choice%"=="5" (
    echo Fixing emulator connection...
    npm run emulator:fix
    pause
) else if "%choice%"=="6" (
    echo Clearing cache and starting...
    npm run start:clear
) else (
    echo Invalid choice. Starting standard mode...
    npm start
)

pause