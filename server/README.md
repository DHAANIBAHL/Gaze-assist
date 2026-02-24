# Gaze Assist Backend

A robust backend system for the 9-point eye tracking calibration and gaze prediction system. This backend provides machine learning-based gaze prediction with high accuracy using polynomial regression.

## Features

### 🎯 Core Capabilities
- **9-Point Calibration System**: Comprehensive calibration with quality assessment
- **Machine Learning Model**: Polynomial regression with feature engineering
- **Real-time Prediction**: Low-latency gaze coordinate prediction
- **Model Persistence**: Save and load user-specific models
- **Quality Metrics**: Automatic calibration quality assessment
- **Batch Processing**: Efficient batch prediction for performance

### 🔧 Technical Features
- **Feature Extraction**: Advanced eye landmark feature engineering
- **Polynomial Features**: 2nd-degree polynomial features for better accuracy
- **Normalization**: Z-score normalization for stable training
- **Matrix Operations**: Custom linear algebra implementation
- **Session Management**: Automatic cleanup of old sessions
- **Model Versioning**: Keep multiple models per user

## Architecture

```
server/
├── index.js              # Main Express server with API endpoints
├── gazeModel.js          # Core ML model (polynomial regression)
├── calibrationService.js # Calibration session management
├── modelManager.js       # Model persistence and versioning
└── models/               # Saved model files (auto-created)
```

## API Endpoints

### Calibration

#### Create Calibration Session
```http
POST /api/calibration/session
Content-Type: application/json

{
  "userId": "user123" // optional, defaults to "anonymous"
}

Response:
{
  "sessionId": "cal_1234567890_abc123",
  "status": "created"
}
```

#### Add Calibration Sample
```http
POST /api/calibration/sample
Content-Type: application/json

{
  "sessionId": "cal_1234567890_abc123",
  "pointIndex": 0,  // 0-8 for 9 points
  "screenX": 100,   // pixel coordinates
  "screenY": 200,
  "eyeLandmarks": {
    "leftEye": {
      "centerX": 0.45,
      "centerY": 0.48,
      "width": 0.05,
      "height": 0.03,
      "aspectRatio": 1.67
    },
    "rightEye": {
      "centerX": 0.55,
      "centerY": 0.48,
      "width": 0.05,
      "height": 0.03,
      "aspectRatio": 1.67
    },
    "headPose": {  // optional
      "pitch": 0,
      "yaw": 0,
      "roll": 0
    }
  }
}

Response:
{
  "success": true,
  "totalSamples": 30,
  "pointsCompleted": 1,
  "currentPointSamples": 30
}
```

#### Complete Calibration
```http
POST /api/calibration/complete
Content-Type: application/json

{
  "sessionId": "cal_1234567890_abc123",
  "userId": "user123"
}

Response:
{
  "success": true,
  "sessionId": "cal_1234567890_abc123",
  "modelId": "model_user123_1234567890_xyz789",
  "quality": {
    "score": 0.85,
    "avgPointQuality": 0.88,
    "minPointQuality": 0.75,
    "coverage": 1.0,
    "temporalConsistency": 0.92,
    "recommendation": "Good calibration"
  },
  "training": {
    "trained": true,
    "trainingDate": "2026-02-04T14:00:00.000Z",
    "sampleCount": 270,
    "accuracy": 15.5,  // average error in pixels
    "maxError": 45.2,
    "minError": 3.1
  },
  "message": "Calibration completed and model trained successfully"
}
```

### Prediction

#### Predict Gaze Coordinates
```http
POST /api/predict
Content-Type: application/json

{
  "userId": "user123",
  "eyeLandmarks": {
    "leftEye": { ... },
    "rightEye": { ... }
  }
}

Response:
{
  "success": true,
  "prediction": {
    "x": 640,
    "y": 480,
    "confidence": 0.92
  },
  "timestamp": 1234567890123
}
```

#### Batch Prediction
```http
POST /api/predict/batch
Content-Type: application/json

{
  "userId": "user123",
  "samples": [
    { "leftEye": {...}, "rightEye": {...} },
    { "leftEye": {...}, "rightEye": {...} }
  ]
}

Response:
{
  "success": true,
  "predictions": [
    { "x": 640, "y": 480, "confidence": 0.92 },
    { "x": 650, "y": 485, "confidence": 0.91 }
  ],
  "timestamp": 1234567890123
}
```

### Model Management

#### Get Model Info
```http
GET /api/model/:userId

Response:
{
  "success": true,
  "metadata": {
    "trained": true,
    "trainingDate": "2026-02-04T14:00:00.000Z",
    "sampleCount": 270,
    "accuracy": 15.5
  },
  "hasTrained": true
}
```

#### List User Models
```http
GET /api/models/:userId

Response:
{
  "success": true,
  "models": [
    {
      "id": "model_user123_1234567890_xyz789",
      "savedAt": "2026-02-04T14:00:00.000Z",
      "metadata": { ... }
    }
  ]
}
```

#### Get Model Statistics
```http
GET /api/stats/:userId

Response:
{
  "success": true,
  "stats": {
    "trained": true,
    "trainingDate": "2026-02-04T14:00:00.000Z",
    "sampleCount": 270,
    "accuracy": 15.5,
    "maxError": 45.2,
    "minError": 3.1
  }
}
```

#### Export Model
```http
GET /api/model/:modelId/export

Response: JSON file download with complete model data
```

#### Import Model
```http
POST /api/model/import
Content-Type: application/json

{
  "userId": "user123",
  "modelData": { ... } // exported model data
}

Response:
{
  "success": true,
  "modelId": "model_user123_1234567891_abc456",
  "message": "Model imported successfully"
}
```

#### Delete Model
```http
DELETE /api/model/:modelId

Response:
{
  "success": true,
  "message": "Model deleted"
}
```

## Installation & Setup

### Prerequisites
- Node.js 14+ 
- npm or yarn
- PostgreSQL (optional, for persistent storage)

### Install Dependencies
```bash
npm install
```

### Environment Variables
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=4000
CORS_ORIGIN=http://localhost:3000

# Database (Optional - for persistent storage)
DATABASE_URL=postgresql://user:password@localhost:5432/gazeassist
DB_SSL=false
```

### Database Setup (Optional)
If using PostgreSQL for persistent storage:

```sql
CREATE TABLE calibration_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  calibration_data JSONB NOT NULL,
  calibration_model JSONB NOT NULL,
  quality_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_id ON calibration_sessions(user_id);
CREATE INDEX idx_created_at ON calibration_sessions(created_at);
```

### Run the Server

#### Development Mode
```bash
npm run server
```

#### With Frontend (Concurrent)
```bash
npm run dev
```

The server will start on `http://localhost:4000`

## How It Works

### 1. Feature Extraction
The system extracts comprehensive features from eye landmarks:
- Left/right eye center positions (X, Y)
- Eye dimensions (width, height, aspect ratio)
- Inter-eye distance
- Combined eye center point
- Head pose (pitch, yaw, roll) if available

### 2. Polynomial Feature Engineering
Base features are expanded to polynomial features:
- Original features
- Squared terms (x²)
- Interaction terms (x₁ × x₂)
- Cubic terms (x³) if needed
- Bias term

This increases model capacity to capture non-linear relationships.

### 3. Normalization
Z-score normalization is applied:
```
normalized_value = (value - mean) / std
```

This ensures stable training and better generalization.

### 4. Model Training
Uses the normal equation for linear regression:
```
β = (X^T X)^(-1) X^T y
```

Separate models are trained for X and Y coordinates.

### 5. Prediction
For new eye landmarks:
1. Extract features
2. Create polynomial features
3. Normalize using training parameters
4. Apply learned coefficients
5. Return predicted (x, y) coordinates

### 6. Quality Assessment
Calibration quality is assessed based on:
- **Point Quality**: Variance in eye positions per point
- **Coverage**: Percentage of 9 points calibrated
- **Temporal Consistency**: Stability across consecutive samples
- **Overall Score**: Weighted combination of metrics

## Accuracy Optimization

### Calibration Best Practices
1. **Collect sufficient samples**: 20-50 samples per point
2. **Stable head position**: Minimize movement during calibration
3. **Good lighting**: Ensure face is well-lit
4. **Proper distance**: 50-70cm from screen
5. **Cover all points**: Complete all 9 calibration points

### Expected Accuracy
- **Good calibration**: 10-20 pixels average error
- **Excellent calibration**: 5-15 pixels average error
- **Poor calibration**: >30 pixels average error

### Improving Accuracy
1. Recalibrate when:
   - Lighting changes
   - User moves
   - Accuracy degrades
   - After 30-60 minutes

2. Use higher polynomial degree (modify in `gazeModel.js`)
3. Collect more samples per point
4. Add more calibration points (modify grid)

## Performance

### Latency
- **Prediction**: <5ms per sample
- **Batch prediction**: ~2ms per sample
- **Training**: 50-200ms for 270 samples

### Memory
- **Model size**: ~50KB per user
- **Session data**: ~100KB per calibration
- **Active models**: Cached in memory

### Scalability
- Supports multiple concurrent users
- Automatic cleanup of old sessions (1 hour)
- Model versioning (keeps last 5 per user)

## Error Handling

The backend provides detailed error messages:

```javascript
{
  "error": "No trained model found for user. Please calibrate first."
}
```

Common errors:
- Missing calibration
- Invalid eye landmarks
- Insufficient samples
- Poor calibration quality

## Testing

### Health Check
```bash
curl http://localhost:4000/health
```

### Test Calibration Flow
```bash
# 1. Create session
curl -X POST http://localhost:4000/api/calibration/session \
  -H "Content-Type: application/json" \
  -d '{"userId":"test"}'

# 2. Add samples (repeat for each point)
curl -X POST http://localhost:4000/api/calibration/sample \
  -H "Content-Type: application/json" \
  -d '{...}'

# 3. Complete calibration
curl -X POST http://localhost:4000/api/calibration/complete \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"cal_...", "userId":"test"}'
```

## Troubleshooting

### Server won't start
- Check if port 4000 is available
- Verify Node.js version (14+)
- Check for missing dependencies

### Database connection errors
- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Database is optional - server works without it

### Low prediction accuracy
- Recalibrate the system
- Check calibration quality score
- Ensure good lighting conditions
- Verify eye landmarks are valid

### High memory usage
- Reduce model cache size
- Decrease cleanup interval
- Limit concurrent sessions

## Advanced Configuration

### Modify Model Parameters
Edit `server/gazeModel.js`:

```javascript
// Change polynomial degree
createPolynomialFeatures(features, 3) // Use degree 3

// Adjust feature extraction
extractFeatures(eyeLandmarks) {
  // Add custom features
}
```

### Adjust Quality Thresholds
Edit `server/calibrationService.js`:

```javascript
this.qualityThresholds = {
  minSamplesPerPoint: 30,  // Increase for better quality
  maxSamplesPerPoint: 50,
  minPoints: 9,
  maxVariance: 50,         // Lower for stricter quality
  minConfidence: 0.8       // Higher for better calibrations
};
```

## Future Enhancements

- [ ] Deep learning model option (TensorFlow.js)
- [ ] Real-time model adaptation
- [ ] Multi-user calibration sharing
- [ ] Advanced outlier detection
- [ ] Gaze heatmap generation
- [ ] Performance analytics dashboard
- [ ] WebSocket support for streaming
- [ ] Model compression for faster loading

## License

MIT

## Support

For issues or questions, please check:
1. Server logs for error details
2. Health endpoint status
3. Calibration quality metrics
4. Eye landmark validity

---

**Built with ❤️ for accessible eye tracking**
