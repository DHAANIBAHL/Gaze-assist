# GazeAssist – Python Eye Tracking Backend

Real-time eye (iris) tracking using **OpenCV + MediaPipe FaceLandmarker**.
Streams gaze coordinates and hand gestures to the React frontend via **WebSocket (Socket.IO)**.

---

## Quick Start

### 1. Install Python dependencies (one time)
```powershell
pip install flask flask-cors flask-socketio opencv-python mediapipe numpy scipy
```

Or use the requirements file:
```powershell
pip install -r python_backend/requirements.txt
```

### 2. Start the backend
```powershell
python python_backend/eye_tracker.py
```
The server starts on **http://localhost:5001**.  
MediaPipe model files (~30 MB) are automatically downloaded on first run.

### 3. Start the React frontend (in a separate terminal)
```powershell
npm run dev
```

---

## Architecture

```
Webcam
  ↓ OpenCV frame capture (640×480 @ 30fps)
  ↓ MediaPipe FaceLandmarker → iris landmarks (indices 468–475)
  ↓ Iris position ratio → normalized gaze (0-1)
  ↓ Polynomial calibration model (degree-2 least squares)
  ↓ WebSocket (Socket.IO) → React frontend
```

## REST API

| Method | Endpoint                          | Description                        |
|--------|-----------------------------------|------------------------------------|
| POST   | `/api/start`                      | Start camera + tracking loop       |
| POST   | `/api/stop`                       | Stop tracking loop                 |
| GET    | `/api/status`                     | Get running state and gaze coords  |
| POST   | `/api/calibration/reset`          | Reset all calibration data         |
| POST   | `/api/calibration/add_point`      | Add one calibration sample         |
| POST   | `/api/calibration/complete`       | Fit calibration model              |

### add_point body
```json
{
  "gazeX": 0.35,   // raw iris x (0-1)
  "gazeY": 0.42,   // raw iris y (0-1)
  "screenX": 0.1,  // target screen x (0-1 normalized)
  "screenY": 0.1   // target screen y (0-1 normalized)
}
```

## WebSocket Events

**Client → Server**
- `start_tracking` – begin capturing and emitting gaze data
- `stop_tracking` – pause capture

**Server → Client** (`gaze_data` event)
```json
{
  "gazeX": 0.52,         // calibrated gaze x (0-1)
  "gazeY": 0.48,         // calibrated gaze y (0-1)
  "faceDetected": true,  // whether a face is visible
  "gesture": "pinch"     // "pinch" | "palm" | null
}
```

## Gestures

| Gesture         | Action              |
|-----------------|---------------------|
| 🤏 Pinch        | Instant click       |
| ✋ Open palm    | Trigger recalibrate |

## Calibration Flow (9-point)

1. Frontend shows 9 dots on a 3×3 grid
2. User looks at each dot → frontend collects `gaze_data` samples
3. Average samples per dot → `POST /api/calibration/add_point`
4. After all 9 dots → `POST /api/calibration/complete`
5. Backend fits a **degree-2 polynomial** (6 coefficients per axis) for accurate mapping
