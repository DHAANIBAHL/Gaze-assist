# Gaze Assist Backend - Quick Reference

## 🚀 Quick Start

```bash
# Start backend server
npm run server

# Start both frontend and backend
npm run dev

# Test backend
curl http://localhost:4000/health
```

## 📡 API Endpoints Cheat Sheet

### Health Check
```bash
GET /health
→ { status: "ok", services: {...} }
```

### Calibration Workflow

```javascript
// 1. Create Session
POST /api/calibration/session
Body: { userId: "user123" }
→ { sessionId: "cal_...", status: "created" }

// 2. Add Samples (repeat 30 times per point, 9 points)
POST /api/calibration/sample
Body: {
  sessionId: "cal_...",
  pointIndex: 0,  // 0-8
  screenX: 192,
  screenY: 108,
  eyeLandmarks: {
    leftEye: { centerX, centerY, width, height, aspectRatio },
    rightEye: { centerX, centerY, width, height, aspectRatio }
  }
}
→ { success: true, totalSamples: 30, pointsCompleted: 1 }

// 3. Complete Calibration
POST /api/calibration/complete
Body: { sessionId: "cal_...", userId: "user123" }
→ {
  success: true,
  modelId: "model_...",
  quality: { score: 0.85, recommendation: "Good calibration" },
  training: { accuracy: 15.5 }
}
```

### Prediction

```javascript
// Single Prediction
POST /api/predict
Body: {
  userId: "user123",
  eyeLandmarks: { leftEye: {...}, rightEye: {...} }
}
→ {
  success: true,
  prediction: { x: 640, y: 480, confidence: 0.92 }
}

// Batch Prediction (faster)
POST /api/predict/batch
Body: {
  userId: "user123",
  samples: [eyeLandmarks1, eyeLandmarks2, ...]
}
→ {
  success: true,
  predictions: [{ x, y, confidence }, ...]
}
```

### Model Management

```javascript
// Get Model Info
GET /api/model/:userId
→ { success: true, metadata: {...}, hasTrained: true }

// List All Models
GET /api/models/:userId
→ { success: true, models: [{id, savedAt, metadata}, ...] }

// Get Statistics
GET /api/stats/:userId
→ {
  success: true,
  stats: {
    trained: true,
    accuracy: 15.5,
    sampleCount: 270
  }
}

// Export Model
GET /api/model/:modelId/export
→ Downloads JSON file

// Import Model
POST /api/model/import
Body: { userId: "user123", modelData: {...} }
→ { success: true, modelId: "model_..." }

// Delete Model
DELETE /api/model/:modelId
→ { success: true, message: "Model deleted" }
```

## 📊 Eye Landmarks Format

```javascript
const eyeLandmarks = {
  leftEye: {
    centerX: 0.45,      // Normalized 0-1
    centerY: 0.48,      // Normalized 0-1
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

## 🎯 Calibration Points (9-Point Grid)

```
Screen Layout:
┌─────────────────────────────┐
│ 0         1         2       │  Top Row
│ (10%,10%) (50%,10%) (90%,10%)│
│                             │
│ 3         4         5       │  Middle Row
│ (10%,50%) (50%,50%) (90%,50%)│
│                             │
│ 6         7         8       │  Bottom Row
│ (10%,90%) (50%,90%) (90%,90%)│
└─────────────────────────────┘

Point Indices: 0-8
Samples per Point: 20-50 (recommended: 30)
Total Samples: 270 (9 points × 30 samples)
```

## ⚙️ Configuration

### Environment Variables (.env)
```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/gazeassist
DB_SSL=false
```

### Quality Thresholds
```javascript
// In calibrationService.js
{
  minSamplesPerPoint: 20,
  maxSamplesPerPoint: 50,
  minPoints: 9,
  maxVariance: 100,
  minConfidence: 0.7
}
```

## 📈 Quality Scores

```
Score Range    Quality Level       Action
───────────    ─────────────       ──────
≥ 0.9          Excellent          ✅ Use immediately
≥ 0.8          Good               ✅ Use with confidence
≥ 0.7          Acceptable         ⚠️  Usable, may recalibrate
< 0.7          Poor               ❌ Recalibrate required
```

## 🎓 Feature Engineering

```
Base Features (13):
├── Left Eye: centerX, centerY, width, height, aspectRatio
├── Right Eye: centerX, centerY, width, height, aspectRatio
├── Inter-eye distance
├── Eye center: X, Y
└── Head pose: pitch, yaw, roll (optional)

Polynomial Features (~200):
├── Original features (13)
├── Squared terms (13)
├── Interaction terms (~78)
└── Bias term (1)
```

## 🧪 Testing Commands

```bash
# Simple test
node server/simple-test.js

# Full test suite
node server/test.js

# Health check
curl http://localhost:4000/health

# Test calibration session
curl -X POST http://localhost:4000/api/calibration/session \
  -H "Content-Type: application/json" \
  -d '{"userId":"test"}'
```

## 🐛 Common Errors

```javascript
// No model found
{ error: "No trained model found for user. Please calibrate first." }
→ Solution: Complete calibration first

// Invalid eye landmarks
{ error: "Missing eye landmarks" }
→ Solution: Ensure eyeLandmarks object is complete

// Insufficient samples
{ error: "Insufficient calibration data. Need at least 9 points." }
→ Solution: Complete all 9 calibration points

// Poor quality
{ success: false, error: "Calibration quality too low" }
→ Solution: Recalibrate with better lighting and stable head
```

## 📁 File Locations

```
server/
├── index.js              # Main server (PORT 4000)
├── gazeModel.js          # ML model
├── calibrationService.js # Calibration logic
├── modelManager.js       # Model persistence
└── models/               # Saved models
    ├── model_user1_*.json
    └── user_*_latest.txt
```

## 🔗 Integration Example

```javascript
// Frontend API Client
import gazeAPI from './api/gazeBackend';

// Start calibration
const session = await gazeAPI.createCalibrationSession();

// Add sample
await gazeAPI.addCalibrationSample(
  0,              // pointIndex
  192, 108,       // screenX, screenY
  eyeLandmarks    // eye data
);

// Complete calibration
const result = await gazeAPI.completeCalibration();
console.log('Quality:', result.quality.score);

// Predict gaze
const prediction = await gazeAPI.predict(eyeLandmarks);
console.log('Gaze:', prediction.x, prediction.y);
```

## 📊 Performance Benchmarks

```
Operation              Latency    Throughput
─────────────          ───────    ──────────
Single Prediction      < 5ms      200+ req/s
Batch Prediction       ~2ms/item  500+ items/s
Model Training         50-200ms   N/A
Session Creation       < 1ms      1000+ req/s
Sample Addition        < 2ms      500+ req/s
```

## 🎯 Accuracy Expectations

```
Calibration Quality    Expected Error
───────────────────    ──────────────
Excellent (≥0.9)       5-15 pixels
Good (≥0.8)            10-20 pixels
Acceptable (≥0.7)      15-25 pixels
Poor (<0.7)            >30 pixels
```

## 🔐 Security Notes

- No authentication implemented (add as needed)
- CORS configured for localhost:3000
- Database is optional
- Models stored in filesystem
- User IDs are client-generated

## 📚 Documentation Files

```
BACKEND_SUMMARY.md       # Complete overview
BACKEND_INTEGRATION.md   # Frontend integration guide
ARCHITECTURE.md          # System architecture
server/README.md         # API documentation
server/schema.sql        # Database schema
USAGE_GUIDE.md          # User guide
```

## 🆘 Support

```bash
# Check server status
curl http://localhost:4000/health

# View server logs
npm run server

# Run tests
node server/test.js

# Check model files
ls server/models/
```

---

**Quick Links:**
- API Docs: `server/README.md`
- Integration: `BACKEND_INTEGRATION.md`
- Architecture: `ARCHITECTURE.md`
- Tests: `server/test.js`
