@echo off
title VaultDrop - Dev Server
cd /d "%~dp0"
echo ====================================================================
echo   Starting VaultDrop in Live Development Mode (Vite + Express)
echo   Vite Client: http://localhost:5173
echo   API Server:  http://localhost:3001
echo ====================================================================
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

npm run dev

pause
