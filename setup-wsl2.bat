@echo off
:: ============================================================
:: setup-wsl2.bat — Run as Administrator
:: Enables WSL2 + VirtualMachinePlatform, installs Ubuntu 22.04
:: for Jetson-compatible MPA Monitor development environment
:: ============================================================

echo [WSL2 Setup] Enabling Windows Subsystem for Linux...
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not enable WSL feature. Check you are running as Administrator.
    pause & exit /b 1
)

echo [WSL2 Setup] Enabling Virtual Machine Platform...
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not enable VirtualMachinePlatform.
    pause & exit /b 1
)

echo.
echo [WSL2 Setup] Features enabled. A restart is required before continuing.
echo After restarting, run: wsl --set-default-version 2
echo Then run:              wsl --install -d Ubuntu-22.04
echo.

choice /C YN /M "Restart now? (Y=Yes, N=No - restart manually later)"
if %ERRORLEVEL% == 1 shutdown /r /t 10 /c "Restarting to enable WSL2 for MPA Monitor"
if %ERRORLEVEL% == 2 echo Please restart manually then continue with post-restart-wsl2.bat
pause
