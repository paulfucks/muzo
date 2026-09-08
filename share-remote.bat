@echo off
title Muzo - Remote Mobile Access (Worldwide)
cd /d "%~dp0"

echo =======================================================
echo   🌍 Muzo Remote Access for Mobile & Other Devices
echo   Create a free, secure worldwide link (4G/5G mobile data)
echo =======================================================
echo.

if not exist "%~dp0cloudflared.exe" (
    echo Downloading lightweight tunnel helper (cloudflared)...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%~dp0cloudflared.exe'"
)

echo.
echo Starting secure tunnel to your Muzo player...
echo Open the https://...trycloudflare.com link on your phone!
echo.
"%~dp0cloudflared.exe" tunnel --url http://localhost:5050

pause
