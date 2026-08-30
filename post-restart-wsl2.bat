@echo off
:: ============================================================
:: post-restart-wsl2.bat — Run as Administrator AFTER reboot
:: Sets WSL2 as default and installs Ubuntu 22.04
:: ============================================================

echo [WSL2] Setting WSL2 as default version...
wsl --set-default-version 2

echo [WSL2] Installing Ubuntu 22.04 (this downloads ~500 MB, may take a few minutes)...
wsl --install -d Ubuntu-22.04

echo.
echo [WSL2] Ubuntu 22.04 installed. On first launch, create a UNIX username and password.
echo After setup, run provision-ubuntu.sh inside WSL to install Python + FastAPI.
echo.
echo   To open WSL:   wsl
echo   To run setup:  bash provision-ubuntu.sh
echo.
pause
