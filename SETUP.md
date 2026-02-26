# GazeAssist Setup Guide

This guide explains how to configure API keys, secrets, and environment variables for GazeAssist.

## Summary: No External API Keys Required

GazeAssist does **not** use third-party API keys (e.g., OpenAI, Google Cloud). MediaPipe models download from public URLs. The configuration values below are **secrets, URLs, and ports** you must set manually for your environment.

---

## Complete List of Configuration Values

| Variable | Required | Where Used | Purpose |
|----------|----------|------------|---------|
| `API_PORT` | No (default: 4000) | Node server | Port for the Node/Express API |
| `CORS_ORIGIN` | No (default: localhost:3000) | Node server | Allowed origin for CORS |
| `DATABASE_URL` | No | Node server | PostgreSQL connection string for persistent calibration |
| `DB_SSL` | No (default: false) | Node server | Set to `true` if PostgreSQL requires SSL |
| `FLASK_SECRET_KEY` | Yes (recommended) | Python backend | Secret for Flask session signing |
| `REACT_APP_API_URL` | No (default: localhost:4000) | React frontend | Node API base URL |
| `REACT_APP_PYTHON_BACKEND` | No (default: localhost:5001) | React frontend | Python eye tracker URL for WebSocket/calibration |
| `DEBUG` | No | Python backend | Set to `1` to show OpenCV debug windows |
| `OPENCV_LOG_LEVEL` | No | Python backend | e.g. `SILENT` to reduce OpenCV logs |

---

## Step-by-Step Placement Instructions

### Step 1: Create root `.env` (Node backend + Python when run via npm)

**File:** `.env`  
**Location:** Project root (same folder as `package.json`)

| Variable | Value | Notes |
|----------|-------|-------|
| `API_PORT` | `4000` | Node API port; avoid conflict with React's PORT |
| `CORS_ORIGIN` | `http://localhost:3000` | Change if frontend runs elsewhere |
| `DATABASE_URL` | *(leave empty or set)* | e.g. `postgresql://user:password@localhost:5432/gazeassist` |
| `DB_SSL` | `false` | Set `true` for cloud PostgreSQL |
| `FLASK_SECRET_KEY` | *Generate a random string* | e.g. 32+ chars; used by Python backend |

**Example `.env`:**
```
API_PORT=4000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=
DB_SSL=false
FLASK_SECRET_KEY=your-random-secret-at-least-32-characters
```

### Step 2: Create root `.env.local` (React frontend)

**File:** `.env.local`  
**Location:** Project root (gitignored)

| Variable | Value | Notes |
|----------|-------|-------|
| `REACT_APP_API_URL` | `http://localhost:4000` | Node API URL |
| `REACT_APP_PYTHON_BACKEND` | `http://localhost:5001` | Python backend URL; change if deployed elsewhere |

**Example `.env.local`:**
```
REACT_APP_API_URL=http://localhost:4000
REACT_APP_PYTHON_BACKEND=http://localhost:5001
```

### Step 3: Create `python_backend/.env` (optional, for standalone Python runs)

**File:** `python_backend/.env`  
**Location:** Inside `python_backend` folder

| Variable | Value | Notes |
|----------|-------|-------|
| `FLASK_SECRET_KEY` | Same as root `.env` | Required for Flask |
| `DEBUG` | `0` or `1` | `1` shows OpenCV debug windows |
| `OPENCV_LOG_LEVEL` | `SILENT` | Reduces OpenCV console output |

---

## Quick Reference: Where Each File Lives

| File | Purpose |
|------|---------|
| `.env` | Node + Python (via run-backend); do not commit real secrets |
| `.env.local` | React only; gitignored; overrides `.env` for frontend |
| `.env.example` | Template; commit to repo; no real secrets |
| `python_backend/.env` | Python only when run standalone; optional |

---

## Generating FLASK_SECRET_KEY

**Option A (Node):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B (Python):**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output and set it as `FLASK_SECRET_KEY` in your `.env` file.

---

## PostgreSQL Setup (Optional)

If you use `DATABASE_URL`, run the schema to create the required table:

```bash
psql $DATABASE_URL -f server/schema.sql
```

Or connect to your database and run the SQL in `server/schema.sql`.

---

## Running the Application

1. Copy `.env.example` to `.env` and fill in values (especially `FLASK_SECRET_KEY`).
2. Create `.env.local` with React variables (or use defaults).
3. Install dependencies: `npm install` and `pip install -r python_backend/requirements.txt` (in venv).
4. Run all services: `npm run start:all`
