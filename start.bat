@echo off
title GazeAssist Launcher
color 0B

echo.
echo  ============================================
echo   GazeAssist - Starting all services
echo  ============================================
echo.

:: Change to the directory containing this batch file
cd /d "%~dp0"

:: Run the PowerShell launcher
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"

:: Keep this window open briefly so any startup errors are visible
timeout /t 4 /nobreak >nul
