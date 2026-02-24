@echo off
echo ============================================================
echo  GazeAssist - Python Eye Tracking Backend Installer
echo ============================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.9+ from https://python.org
    pause
    exit /b 1
)

echo [1/2] Installing Python dependencies...
pip install -r python_backend\requirements.txt

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies.
    echo Try running as Administrator or use: pip install --user -r python_backend\requirements.txt
    pause
    exit /b 1
)

echo.
echo [2/2] Starting Python Eye Tracking Backend on port 5001...
echo.
echo   Access it at: http://localhost:5001
echo   Press Ctrl+C to stop
echo.
python python_backend\eye_tracker.py
