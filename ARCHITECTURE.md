# Gaze Assist Backend Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Calibration  │  │ Gaze Control │  │  Accuracy    │              │
│  │  Component   │  │  Component   │  │    Test      │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                      │
│         └──────────────────┼──────────────────┘                      │
│                            │                                         │
│                    ┌───────▼────────┐                                │
│                    │  API Client    │                                │
│                    │ (gazeBackend)  │                                │
│                    └───────┬────────┘                                │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             │ HTTP/REST API
                             │
┌────────────────────────────▼──────────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Express Server (index.js)                 │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │ Calibration  │  │  Prediction  │  │    Model     │      │    │
│  │  │  Endpoints   │  │  Endpoints   │  │  Management  │      │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │    │
│  └─────────┼──────────────────┼──────────────────┼─────────────┘    │
│            │                  │                  │                   │
│  ┌─────────▼──────────┐  ┌───▼──────────┐  ┌───▼──────────┐        │
│  │ CalibrationService │  │  GazeModel   │  │ ModelManager │        │
│  │                    │  │              │  │              │        │
│  │ • Session Mgmt    │  │ • Feature    │  │ • Persistence│        │
│  │ • Sample Valid.   │  │   Extraction │  │ • Versioning │        │
│  │ • Quality Check   │  │ • Polynomial │  │ • Caching    │        │
│  │ • Data Prep       │  │   Features   │  │ • Import/    │        │
│  │                    │  │ • Training   │  │   Export     │        │
│  │                    │  │ • Prediction │  │              │        │
│  └────────────────────┘  └──────────────┘  └───────┬──────┘        │
│                                                     │               │
└─────────────────────────────────────────────────────┼───────────────┘
                                                      │
                                                      │
                                          ┌───────────▼──────────┐
                                          │   File System        │
                                          │                      │
                                          │  models/             │
                                          │  ├── model_user1.json│
                                          │  ├── model_user2.json│
                                          │  └── user_*_latest   │
                                          └──────────────────────┘
                                                      │
                                                      │ (Optional)
                                          ┌───────────▼──────────┐
                                          │   PostgreSQL DB      │
                                          │                      │
                                          │  • calibration_      │
                                          │    sessions          │
                                          │  • gaze_models       │
                                          │  • users             │
                                          │  • quality_metrics   │
                                          └──────────────────────┘
```

## Data Flow

### 1. Calibration Flow

```
User Action                Backend Processing              Result
───────────                ──────────────────              ──────

Start Calibration
    │
    ├─► POST /api/calibration/session
    │       │
    │       ├─► CalibrationService.createSession()
    │       │       │
    │       │       └─► Generate session ID
    │       │
    │       └─► Return: { sessionId, status }
    │
    └─► Session Created ✓


Look at Point 1
    │
    ├─► POST /api/calibration/sample
    │       │
    │       ├─► CalibrationService.addSample()
    │       │       │
    │       │       ├─► Validate eye landmarks
    │       │       ├─► Store sample data
    │       │       └─► Assess point quality
    │       │
    │       └─► Return: { success, samplesCollected }
    │
    └─► Sample Collected ✓


[Repeat for all 9 points × 30 samples]


Complete Calibration
    │
    ├─► POST /api/calibration/complete
    │       │
    │       ├─► CalibrationService.completeSession()
    │       │       │
    │       │       ├─► Validate 9 points complete
    │       │       ├─► Assess overall quality
    │       │       └─► Prepare training data
    │       │
    │       ├─► ModelManager.trainModel()
    │       │       │
    │       │       ├─► GazeModel.train()
    │       │       │       │
    │       │       │       ├─► Extract features
    │       │       │       ├─► Create polynomial features
    │       │       │       ├─► Normalize data
    │       │       │       ├─► Solve regression (X & Y)
    │       │       │       └─► Calculate accuracy
    │       │       │
    │       │       └─► Save model to filesystem
    │       │
    │       └─► Return: { modelId, quality, accuracy }
    │
    └─► Model Trained ✓
```

### 2. Prediction Flow

```
Eye Movement              Backend Processing              Result
─────────────             ──────────────────              ──────

Detect Eye Position
    │
    ├─► Extract eye landmarks
    │       │
    │       └─► { leftEye, rightEye, headPose }
    │
    ├─► POST /api/predict
    │       │
    │       ├─► ModelManager.predict()
    │       │       │
    │       │       ├─► Get active model for user
    │       │       │
    │       │       └─► GazeModel.predict()
    │       │               │
    │       │               ├─► Extract features (13)
    │       │               ├─► Create polynomial features (~200)
    │       │               ├─► Normalize features
    │       │               ├─► Apply coefficients
    │       │               │       X = features · βx
    │       │               │       Y = features · βy
    │       │               └─► Calculate confidence
    │       │
    │       └─► Return: { x, y, confidence }
    │
    └─► Update Cursor Position ✓
```

## Component Interactions

```
┌──────────────────────────────────────────────────────────────┐
│                     CalibrationService                        │
│                                                               │
│  createSession()  ──┐                                         │
│  addSample()      ──┼─► Session Management                   │
│  completeSession()──┘                                         │
│                                                               │
│  validateSample() ──┐                                         │
│  assessQuality()  ──┼─► Quality Control                      │
│  calculateMetrics()─┘                                         │
│                                                               │
│  prepareData()    ───► Data Preparation ──┐                  │
└───────────────────────────────────────────┼──────────────────┘
                                            │
                                            │ Calibration Data
                                            ▼
┌──────────────────────────────────────────────────────────────┐
│                        GazeModel                              │
│                                                               │
│  train(calibrationData)                                       │
│    │                                                          │
│    ├─► extractFeatures()                                     │
│    │     └─► [13 base features]                              │
│    │                                                          │
│    ├─► createPolynomialFeatures()                            │
│    │     └─► [~200 polynomial features]                      │
│    │                                                          │
│    ├─► calculateNormalization()                              │
│    │     └─► { mean, std }                                   │
│    │                                                          │
│    ├─► solveLinearRegression()                               │
│    │     ├─► X^T X                                           │
│    │     ├─► (X^T X)^-1                                      │
│    │     └─► β = (X^T X)^-1 X^T y                            │
│    │                                                          │
│    └─► Return: { coefficientsX, coefficientsY, metadata }   │
│                                                               │
│  predict(eyeLandmarks)                                        │
│    │                                                          │
│    ├─► extractFeatures()                                     │
│    ├─► createPolynomialFeatures()                            │
│    ├─► normalize()                                           │
│    ├─► dotProduct(features, coefficients)                    │
│    └─► Return: { x, y, confidence }                          │
│                                                               │
│  export() / import()  ──► Model Serialization                │
└───────────────────────────────────────────┬──────────────────┘
                                            │
                                            │ Model Data
                                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      ModelManager                             │
│                                                               │
│  trainModel()      ──┐                                        │
│  saveModel()       ──┼─► Model Lifecycle                     │
│  loadModel()       ──┤                                        │
│  deleteModel()     ──┘                                        │
│                                                               │
│  getActiveModel()  ──┐                                        │
│  predict()         ──┼─► Prediction Interface                │
│  predictBatch()    ──┘                                        │
│                                                               │
│  exportModel()     ──┐                                        │
│  importModel()     ──┼─► Import/Export                       │
│  listUserModels()  ──┘                                        │
│                                                               │
│  Cache: Map<userId, model>  ──► In-Memory Cache              │
└──────────────────────────────────────────────────────────────┘
```

## Machine Learning Pipeline

```
Input: Eye Landmarks
    │
    ▼
┌─────────────────────────────────────┐
│     Feature Extraction (13)         │
│                                     │
│  • Left Eye: X, Y, W, H, AR        │
│  • Right Eye: X, Y, W, H, AR       │
│  • Eye Distance                     │
│  • Eye Center: X, Y                 │
│  • Head Pose: pitch, yaw, roll     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Polynomial Feature Creation       │
│                                     │
│  • Original features (13)           │
│  • Squared terms (13)               │
│  • Interaction terms (~78)          │
│  • Bias term (1)                    │
│  ─────────────────────              │
│  Total: ~200 features               │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      Z-Score Normalization          │
│                                     │
│  normalized = (x - μ) / σ           │
│                                     │
│  where μ = mean, σ = std            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│     Linear Regression (Training)    │
│                                     │
│  β = (X^T X)^-1 X^T y               │
│                                     │
│  Separate models for X and Y        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│        Prediction (Inference)       │
│                                     │
│  x_pred = features · βx             │
│  y_pred = features · βy             │
│                                     │
│  confidence = similarity_score      │
└─────────────┬───────────────────────┘
              │
              ▼
Output: (x, y, confidence)
```

## Quality Assessment Pipeline

```
Calibration Samples (270 total)
    │
    ├─► Per-Point Analysis (9 points)
    │       │
    │       ├─► Calculate Variance
    │       │     └─► Eye position stability
    │       │
    │       ├─► Calculate Stability
    │       │     └─► 1 - (variance × scale)
    │       │
    │       └─► Point Quality Score
    │             └─► (stability × 0.7 + samples × 0.3)
    │
    ├─► Temporal Consistency
    │       │
    │       └─► Compare consecutive samples
    │             └─► Distance between samples
    │
    ├─► Coverage Check
    │       │
    │       └─► Points completed / 9
    │
    └─► Overall Quality Score
            │
            ├─► Average point quality × 0.5
            ├─► Minimum point quality × 0.3
            ├─► Coverage × 0.1
            └─► Temporal consistency × 0.1
            
            ▼
    Quality Recommendation
    ├─► ≥ 0.9: "Excellent calibration"
    ├─► ≥ 0.8: "Good calibration"
    ├─► ≥ 0.7: "Acceptable calibration"
    └─► < 0.7: "Poor calibration - recalibrate"
```

## File Structure

```
gaze-assist-app/
├── server/
│   ├── index.js                 # Express server & API endpoints
│   ├── gazeModel.js             # ML model implementation
│   ├── calibrationService.js    # Calibration logic
│   ├── modelManager.js          # Model persistence
│   ├── test.js                  # Test suite
│   ├── simple-test.js           # Basic tests
│   ├── schema.sql               # Database schema
│   ├── README.md                # Backend documentation
│   └── models/                  # Saved models (auto-created)
│       ├── model_user1_*.json
│       ├── model_user2_*.json
│       └── user_*_latest.txt
│
├── src/
│   ├── api/
│   │   └── gazeBackend.js       # API client (to be created)
│   ├── components/
│   │   ├── Calibration.js       # Calibration UI
│   │   └── GazeControl.js       # Gaze control UI
│   └── ...
│
├── BACKEND_SUMMARY.md           # This summary
├── BACKEND_INTEGRATION.md       # Integration guide
├── USAGE_GUIDE.md               # User guide
├── package.json
└── .env                         # Environment config
```

---

This architecture provides a **scalable, accurate, and maintainable** backend for your gaze tracking application!
