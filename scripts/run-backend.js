#!/usr/bin/env node
/**
 * Cross-platform script to run the Python eye tracker backend.
 * Uses venv/Scripts/python.exe on Windows, venv/bin/python on Unix.
 */
const { spawn } = require('child_process');
const path = require('path');

// Load root .env so FLASK_SECRET_KEY, DEBUG, etc. are passed to Python child
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isWin = process.platform === 'win32';
const venvPython = path.join(
  __dirname,
  '..',
  isWin ? 'venv\\Scripts\\python.exe' : 'venv/bin/python'
);
const scriptPath = path.join(__dirname, '..', 'python_backend', 'eye_tracker.py');

const proc = spawn(venvPython, [scriptPath], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});

proc.on('error', (err) => {
  console.error('Failed to start Python backend:', err.message);
  console.error('Ensure you have created the virtual environment:');
  console.error('  python -m venv venv');
  console.error('  venv\\Scripts\\pip install -r python_backend/requirements.txt   (Windows)');
  console.error('  venv/bin/pip install -r python_backend/requirements.txt        (macOS/Linux)');
  process.exit(1);
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});
