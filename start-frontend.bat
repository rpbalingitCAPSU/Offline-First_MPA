@echo off
:: ============================================================
:: start-frontend.bat — Serve the MPA Monitor frontend only
:: ============================================================

set "APP_DIR=%~dp0"
set "SERVE=%APPDATA%\npm\serve.cmd"

echo Starting MPA Monitor frontend on http://localhost:8080 ...
echo Press Ctrl+C to stop.
echo.

"%SERVE%" -l 8080 -s "%APP_DIR%"
