# Backend Integration Guide

This guide explains how to integrate the backend API with your frontend gaze tracking application.

## Quick Start

### 1. Start the Backend Server

```bash
# Option 1: Run backend only
npm run server

# Option 2: Run both frontend and backend concurrently
npm run dev
```

The backend will be available at `http://localhost:4000`

### 2. Verify Backend is Running

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-04T14:00:00.000Z",
  "services": {
    "calibration": "active",
    "modelManager": "active",
    "database": "not configured"
  }
}
```

## Frontend Integration

### Step 1: Create API Client

Create `src/api/gazeBackend.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

class GazeBackendAPI {
  constructor() {
    this.userId = this.getUserId();
    this.sessionId = null;
  }

  getUserId() {
    // Get or create user ID
    let userId = localStorage.getItem('gaze_user_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('gaze_user_id', userId);
    }
    return userId;
  }

  async createCalibrationSession() {
    const response = await fetch(`${API_BASE_URL}/api/calibration/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.userId })
    });
    const data = await response.json();
    this.sessionId = data.sessionId;
    return data;
  }

  async addCalibrationSample(pointIndex, screenX, screenY, eyeLandmarks) {
    const response = await fetch(`${API_BASE_URL}/api/calibration/sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        pointIndex,
        screenX,
        screenY,
        eyeLandmarks
      })
    });
    return await response.json();
  }

  async completeCalibration() {
    const response = await fetch(`${API_BASE_URL}/api/calibration/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        userId: this.userId
      })
    });
    return await response.json();
  }

  async predict(eyeLandmarks) {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.userId,
        eyeLandmarks
      })
    });
    return await response.json();
  }

  async getModelInfo() {
    const response = await fetch(`${API_BASE_URL}/api/model/${this.userId}`);
    return await response.json();
  }

  async getStats() {
    const response = await fetch(`${API_BASE_URL}/api/stats/${this.userId}`);
    return await response.json();
  }
}

export default new GazeBackendAPI();
```

### Step 2: Update Calibration Component

Modify your `Calibration.js` to use the backend:

```javascript
import gazeAPI from '../api/gazeBackend';

// In your calibration component:

const startCalibration = async () => {
  try {
    // Create calibration session
    const session = await gazeAPI.createCalibrationSession();
    console.log('Calibration session created:', session.sessionId);
    
    // Start calibration process
    setIsCalibrating(true);
  } catch (error) {
    console.error('Failed to start calibration:', error);
  }
};

const collectCalibrationData = async (pointIndex, screenX, screenY, eyeLandmarks) => {
  try {
    const result = await gazeAPI.addCalibrationSample(
      pointIndex,
      screenX,
      screenY,
      eyeLandmarks
    );
    
    console.log(`Point ${pointIndex}: ${result.currentPointSamples} samples collected`);
    
    return result;
  } catch (error) {
    console.error('Failed to add calibration sample:', error);
  }
};

const finishCalibration = async () => {
  try {
    const result = await gazeAPI.completeCalibration();
    
    if (result.success) {
      console.log('Calibration completed!');
      console.log('Quality score:', result.quality.score);
      console.log('Model accuracy:', result.training.accuracy, 'px');
      
      // Navigate to gaze control page
      navigate('/gaze-control');
    } else {
      console.error('Calibration failed:', result.error);
      alert('Calibration quality too low. Please try again.');
    }
  } catch (error) {
    console.error('Failed to complete calibration:', error);
  }
};
```

### Step 3: Update Gaze Control Component

Modify your `GazeControl.js` to use backend predictions:

```javascript
import gazeAPI from '../api/gazeBackend';

// In your gaze control component:

const predictGaze = async (eyeLandmarks) => {
  try {
    const result = await gazeAPI.predict(eyeLandmarks);
    
    if (result.success) {
      const { x, y, confidence } = result.prediction;
      
      // Update cursor position
      setCursorPosition({ x, y });
      
      // Optional: Use confidence for visual feedback
      if (confidence < 0.7) {
        console.warn('Low prediction confidence:', confidence);
      }
      
      return { x, y, confidence };
    }
  } catch (error) {
    console.error('Prediction failed:', error);
    // Fall back to client-side prediction if needed
  }
};

// In your animation loop:
const updateGaze = async () => {
  if (!faceDetected || !eyeLandmarks) return;
  
  // Get prediction from backend
  const prediction = await predictGaze(eyeLandmarks);
  
  if (prediction) {
    // Use predicted coordinates
    updateCursor(prediction.x, prediction.y);
  }
  
  requestAnimationFrame(updateGaze);
};
```

## Eye Landmarks Format

The backend expects eye landmarks in this format:

```javascript
const eyeLandmarks = {
  leftEye: {
    centerX: 0.45,      // Normalized (0-1)
    centerY: 0.48,      // Normalized (0-1)
    width: 0.05,        // Normalized
    height: 0.03,       // Normalized
    aspectRatio: 1.67   // width/height
  },
  rightEye: {
    centerX: 0.55,
    centerY: 0.48,
    width: 0.05,
    height: 0.03,
    aspectRatio: 1.67
  },
  headPose: {           // Optional
    pitch: 0,
    yaw: 0,
    roll: 0
  }
};
```

### Converting from MediaPipe Face Mesh

If you're using MediaPipe Face Mesh, convert landmarks like this:

```javascript
function extractEyeLandmarks(faceLandmarks, videoWidth, videoHeight) {
  // MediaPipe eye landmark indices
  const LEFT_EYE_INDICES = [33, 133, 160, 159, 158, 157, 173];
  const RIGHT_EYE_INDICES = [362, 263, 387, 386, 385, 384, 398];
  
  const leftEyePoints = LEFT_EYE_INDICES.map(i => faceLandmarks[i]);
  const rightEyePoints = RIGHT_EYE_INDICES.map(i => faceLandmarks[i]);
  
  // Calculate bounding boxes
  const leftEyeBounds = getBoundingBox(leftEyePoints);
  const rightEyeBounds = getBoundingBox(rightEyePoints);
  
  return {
    leftEye: {
      centerX: leftEyeBounds.centerX / videoWidth,
      centerY: leftEyeBounds.centerY / videoHeight,
      width: leftEyeBounds.width / videoWidth,
      height: leftEyeBounds.height / videoHeight,
      aspectRatio: leftEyeBounds.width / leftEyeBounds.height
    },
    rightEye: {
      centerX: rightEyeBounds.centerX / videoWidth,
      centerY: rightEyeBounds.centerY / videoHeight,
      width: rightEyeBounds.width / videoWidth,
      height: rightEyeBounds.height / videoHeight,
      aspectRatio: rightEyeBounds.width / rightEyeBounds.height
    }
  };
}

function getBoundingBox(points) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY
  };
}
```

## Calibration Workflow

### Complete Integration Example

```javascript
import { useEffect, useState } from 'react';
import gazeAPI from '../api/gazeBackend';

function CalibrationPage() {
  const [currentPoint, setCurrentPoint] = useState(0);
  const [samplesCollected, setSamplesCollected] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  
  const CALIBRATION_POINTS = [
    { x: 0.1, y: 0.1 },  // Top-left
    { x: 0.5, y: 0.1 },  // Top-center
    { x: 0.9, y: 0.1 },  // Top-right
    { x: 0.1, y: 0.5 },  // Middle-left
    { x: 0.5, y: 0.5 },  // Center
    { x: 0.9, y: 0.5 },  // Middle-right
    { x: 0.1, y: 0.9 },  // Bottom-left
    { x: 0.5, y: 0.9 },  // Bottom-center
    { x: 0.9, y: 0.9 }   // Bottom-right
  ];
  
  const SAMPLES_PER_POINT = 30;
  
  const startCalibration = async () => {
    await gazeAPI.createCalibrationSession();
    setIsCalibrating(true);
    setCurrentPoint(0);
    setSamplesCollected(0);
  };
  
  const collectSample = async (eyeLandmarks) => {
    if (!isCalibrating) return;
    
    const point = CALIBRATION_POINTS[currentPoint];
    const screenX = point.x * window.innerWidth;
    const screenY = point.y * window.innerHeight;
    
    const result = await gazeAPI.addCalibrationSample(
      currentPoint,
      screenX,
      screenY,
      eyeLandmarks
    );
    
    setSamplesCollected(result.currentPointSamples);
    
    // Move to next point when enough samples collected
    if (result.currentPointSamples >= SAMPLES_PER_POINT) {
      if (currentPoint < CALIBRATION_POINTS.length - 1) {
        setCurrentPoint(currentPoint + 1);
        setSamplesCollected(0);
      } else {
        // All points done, complete calibration
        await completeCalibration();
      }
    }
  };
  
  const completeCalibration = async () => {
    const result = await gazeAPI.completeCalibration();
    
    if (result.success) {
      alert(`Calibration complete! Quality: ${result.quality.score.toFixed(2)}`);
      // Navigate to gaze control
    } else {
      alert('Calibration failed. Please try again.');
    }
    
    setIsCalibrating(false);
  };
  
  return (
    <div>
      {/* Your calibration UI */}
      <button onClick={startCalibration}>Start Calibration</button>
      {isCalibrating && (
        <div>
          <p>Point {currentPoint + 1} of 9</p>
          <p>Samples: {samplesCollected} / {SAMPLES_PER_POINT}</p>
        </div>
      )}
    </div>
  );
}
```

## Performance Optimization

### 1. Batch Predictions (for better performance)

```javascript
// Instead of predicting one at a time
const predictions = await gazeAPI.predictBatch([
  eyeLandmarks1,
  eyeLandmarks2,
  eyeLandmarks3
]);
```

### 2. Client-Side Caching

```javascript
// Cache model locally for offline use
const cacheModel = async () => {
  const modelData = await gazeAPI.exportModel();
  localStorage.setItem('gaze_model', JSON.stringify(modelData));
};

// Use cached model when offline
const getCachedModel = () => {
  const cached = localStorage.getItem('gaze_model');
  return cached ? JSON.parse(cached) : null;
};
```

### 3. Debounce Predictions

```javascript
import { debounce } from 'lodash';

const debouncedPredict = debounce(async (eyeLandmarks) => {
  await gazeAPI.predict(eyeLandmarks);
}, 50); // 50ms debounce
```

## Error Handling

```javascript
async function safePrediction(eyeLandmarks) {
  try {
    const result = await gazeAPI.predict(eyeLandmarks);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.prediction;
    
  } catch (error) {
    console.error('Prediction error:', error);
    
    // Fall back to client-side prediction
    return clientSidePredict(eyeLandmarks);
  }
}
```

## Testing the Integration

### 1. Test Health Endpoint

```javascript
async function testBackend() {
  try {
    const response = await fetch('http://localhost:4000/health');
    const data = await response.json();
    console.log('Backend status:', data);
  } catch (error) {
    console.error('Backend not available:', error);
  }
}
```

### 2. Test Calibration Flow

```javascript
async function testCalibrationFlow() {
  // 1. Create session
  const session = await gazeAPI.createCalibrationSession();
  console.log('Session created:', session);
  
  // 2. Add sample
  const result = await gazeAPI.addCalibrationSample(
    0, 100, 100,
    { leftEye: {...}, rightEye: {...} }
  );
  console.log('Sample added:', result);
  
  // 3. Get session info
  const info = await gazeAPI.getSessionInfo(session.sessionId);
  console.log('Session info:', info);
}
```

## Environment Variables

Create `.env` file in your project root:

```env
# Frontend
REACT_APP_API_URL=http://localhost:4000

# Backend
PORT=4000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/gazeassist
```

## Troubleshooting

### Backend not responding
- Check if server is running: `npm run server`
- Verify port 4000 is not in use
- Check CORS settings

### Predictions not accurate
- Recalibrate the system
- Check calibration quality score
- Ensure eye landmarks are normalized (0-1)

### High latency
- Use batch predictions
- Implement client-side caching
- Consider WebSocket for real-time streaming

## Next Steps

1. ✅ Integrate backend API with frontend
2. ✅ Test calibration workflow
3. ✅ Implement error handling
4. ✅ Add performance optimizations
5. 📊 Monitor accuracy and adjust
6. 🚀 Deploy to production

---

For more details, see the [Backend README](./server/README.md)
