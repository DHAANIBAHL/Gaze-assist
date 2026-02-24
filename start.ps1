# ============================================================
#  GazeAssist - One-click launcher
#  Starts: Python backend (5001) + Node server + React (3000)
# ============================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot   # folder containing this script

# ── Paths ────────────────────────────────────────────────────
$venvPy = Join-Path (Split-Path $root) ".venv\Scripts\python.exe"
$sysPy = Join-Path $root ".venv\Scripts\python.exe"   # fallback: local venv
$fallbackPy = "python"

$pyScript = Join-Path $root "python_backend\eye_tracker.py"
$nodeEntry = Join-Path $root "server\index.js"

# ── Resolve Python executable ─────────────────────────────────
if (Test-Path $venvPy) {
    $pyExe = $venvPy
    Write-Host "[*] Using venv Python: $venvPy" -ForegroundColor Cyan
}
else {
    $pyExe = $fallbackPy
    Write-Host "[!] venv not found, using system Python" -ForegroundColor Yellow
}

# ── Helper: open a new PowerShell window ─────────────────────
function Start-Window {
    param(
        [string]$Title,
        [string]$Command,
        [string]$Color = "DarkBlue"
    )
    $args = "-NoExit -Command `"$Host.UI.RawUI.WindowTitle = '$Title'; $Command`""
    Start-Process powershell -ArgumentList $args -WorkingDirectory $root
}

# ── 1. Python Eye Tracking Backend (port 5001) ────────────────
Write-Host ""
Write-Host "[1/3] Starting Python eye-tracking backend..." -ForegroundColor Green
Start-Window `
    -Title "GazeAssist - Python Backend (5001)" `
    -Command "& '$pyExe' '$pyScript'"

Start-Sleep -Milliseconds 800   # slight stagger so windows don't pile up

# ── 2. Node.js calibration server ────────────────────────────
Write-Host "[2/3] Starting Node.js server..." -ForegroundColor Green
Start-Window `
    -Title "GazeAssist - Node Server" `
    -Command "node '$nodeEntry'"

Start-Sleep -Milliseconds 800

# ── 3. React development server (port 3000) ───────────────────
Write-Host "[3/3] Starting React frontend..." -ForegroundColor Green
Start-Window `
    -Title "GazeAssist - React Frontend (3000)" `
    -Command "npm start"

# ── Done ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All 3 services are starting in new windows" -ForegroundColor Cyan
Write-Host ""
Write-Host "  React frontend  -> http://localhost:3000" -ForegroundColor White
Write-Host "  Node server     -> http://localhost:3001" -ForegroundColor White
Write-Host "  Python backend  -> http://localhost:5001" -ForegroundColor White
Write-Host ""
Write-Host "  Close each window individually to stop a service." -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
