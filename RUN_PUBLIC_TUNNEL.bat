@echo off
title VaultDrop - Public Internet Tunnel
cd /d "%~dp0"
echo ====================================================================
echo   VaultDrop - Public Internet Tunnel (Share across 4G/5G/Anywhere)
echo ====================================================================
echo.
echo Starting temporary secure public tunnel for port 3001...
echo (Make sure RUN_APP.bat is already running in another window)
echo.

npx --yes localtunnel --port 3001

pause
