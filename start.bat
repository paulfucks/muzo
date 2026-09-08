@echo off
title Muzo - Free Music Player
cd /d "%~dp0"

echo =======================================================
echo   🎵 Launching Muzo Free Music Player...
echo   Smart Recommendations • Free Songs • No Ads
echo =======================================================
echo.
echo Starting local server on http://localhost:5050 ...

start "" http://localhost:5050
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 5050

pause
