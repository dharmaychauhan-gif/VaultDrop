@echo off
title VaultDrop - Test Suite Runner
cd /d "%~dp0"
echo ====================================================================
echo   VaultDrop - Zero-Knowledge Ephemeral Sharing SaaS
echo   Running Automated Test Suite via Node.js
echo ====================================================================
echo.

node run-test.js

echo.
echo ====================================================================
echo Press any key to exit...
pause >nul
