@echo off
title Sehri Connect Backend

echo Starting Sehri Connect Backend...
echo.

:: Start backend server in a new window
start "Sehri Backend - Node.js" cmd /k "cd /d "d:\Sehri app\backend" && node src/server.js"

:: Wait 3 seconds for server to boot
timeout /t 3 /nobreak > nul

:: Start ngrok with static domain in a new window
start "Sehri Backend - ngrok Tunnel" cmd /k "C:\Users\ACER\ngrok\ngrok.exe http --domain=ungraded-reminder-booted.ngrok-free.dev 5000"

echo.
echo Both windows are starting...
echo Backend:  http://localhost:5000
echo Public:   https://ungraded-reminder-booted.ngrok-free.dev
echo.
echo You can close this window.
