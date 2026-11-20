@echo off
title VaultDrop - Zero-Knowledge Ephemeral Sharing SaaS
cd /d "%~dp0"
echo ====================================================================
echo   Starting VaultDrop Server...
echo   Local URL:   http://localhost:3001
echo ====================================================================
echo.

:: Automatically open browser
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3001"

:: Start Node.js server (listening on 0.0.0.0 for all LAN/Wi-Fi devices)
node server/index.js

pause
