@echo off
:: ============================================================
:: start-app.bat — MPA Monitor Windows Launcher
:: Starts both the frontend static server and the FastAPI
:: inference service in separate console windows.
:: ============================================================

setlocal

set "APP_DIR=%~dp0"
set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
set "SERVE=%APPDATA%\npm\serve.cmd"
set "NODE=C:\Program Files\nodejs\node.exe"

echo.
echo  ============================================
echo   MPA Monitor — Starting application...
echo  ============================================
echo.

:: ── Check prerequisites ──────────────────────────────────────
if not exist "%NODE%" (
    echo ERROR: Node.js not found at %NODE%
    echo Install from: https://nodejs.org
    pause & exit /b 1
)

if not exist "%PYTHON%" (
    echo ERROR: Python not found at %PYTHON%
    echo Install from: https://python.org
    pause & exit /b 1
)

:: ── Start FastAPI inference service ──────────────────────────
echo [1/2] Starting AI Inference Service (port 8000)...
start "MPA Inference Service" cmd /k "cd /d "%APP_DIR%inference_service" && "%PYTHON%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

:: Give uvicorn a moment to start
timeout /t 3 /nobreak > nul

:: ── Start frontend static server ─────────────────────────────
echo [2/2] Starting Frontend Server (port 8080)...
start "MPA Frontend Server" cmd /k ""%SERVE%" -l 8080 -s "%APP_DIR%""

:: Wait for server to start
timeout /t 2 /nobreak > nul

:: ── Open browser ─────────────────────────────────────────────
echo.
echo  Opening MPA Monitor in default browser...
start http://localhost:8080

echo.
echo  ============================================
echo   MPA Monitor is running:
echo    Frontend:  http://localhost:8080
echo    AI API:    http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo.
echo   Login: admin / mpa2026
echo  ============================================
echo.
echo  Close this window or press any key to continue.
pause > nul
