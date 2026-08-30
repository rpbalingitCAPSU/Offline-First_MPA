@echo off
:: ============================================================
:: start-inference.bat — Start FastAPI inference service only
:: ============================================================

set "APP_DIR=%~dp0"
set "PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"

echo Starting MPA Inference Service on http://127.0.0.1:8000 ...
echo API docs available at: http://127.0.0.1:8000/docs
echo Press Ctrl+C to stop.
echo.

cd /d "%APP_DIR%inference_service"
"%PYTHON%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
