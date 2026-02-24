# Training Guide for Gaze Assist Model

This guide explains how to train the gaze tracking model for improved accuracy.

## Quick Start

### Option 1: Automated Training (Recommended)

Use the provided training script to automatically train the model with simulated calibration data:

```bash
node train_from_dataset.js
```

This will:
- ✅ Generate realistic eye landmark data for 9 calibration points
- ✅ Collect 30 samples per point (270 total samples)
- ✅ Train the polynomial regression model
- ✅ Validate accuracy with test predictions
- ✅ Save the trained model for your user

**Expected Output:**
```
🚀 Starting Gaze Assist Model Training
✅ Backend is running
📝 Creating calibration session...
✅ Session created: session_xxx
📸 Collecting calibration data...
  Point 1/9 (192, 108): 10...20...30...✓
  Point 2/9 (960, 108): 10...20...30...✓
  ...
✅ Training completed successfully!
📈 Training Results:
  Quality Score: 0.850
  Training Accuracy: 15.23px
  Model ID: model_xxx
```

### Option 2: Manual Calibration (Best Accuracy)

For the best accuracy, use the web interface to calibrate with your actual eyes:

1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   - Navigate to `http://localhost:3000`
   - Go to the Calibration page

3. **Follow calibration process:**
   - Look at each of the 9 calibration points
   - Keep your head still
   - Let the system collect 30 samples per point
   - Complete calibration

4. **Model is automatically trained and saved!**

## Training Script Details

### What the Script Does

The `train_from_dataset.js` script:

1. **Generates Realistic Eye Data:**
   - Simulates eye landmark positions based on gaze direction
   - Adds natural variation (eye jitter, head movement)
   - Creates data in the exact format expected by the backend

2. **9-Point Calibration Grid:**
   ```
   1 -------- 2 -------- 3
   |                     |
   4 -------- 5 -------- 6
   |                     |
   7 -------- 8 -------- 9
   ```

3. **Collects 30 Samples Per Point:**
   - Total: 270 calibration samples
   - Each sample includes left eye, right eye, and head pose data

4. **Trains Polynomial Regression Model:**
   - Extracts 13 base features from eye landmarks
   - Creates ~200 polynomial features
   - Trains separate models for X and Y coordinates
   - Applies normalization for better accuracy

5. **Validates Accuracy:**
   - Tests predictions on unseen data
   - Calculates average error in pixels
   - Reports confidence scores

### Customizing Training Parameters

Edit `train_from_dataset.js` to customize:

```javascript
// Number of samples per calibration point
const SAMPLES_PER_POINT = 30;  // Increase for better accuracy

// Screen resolution
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;

// Calibration points (can add more for better coverage)
const CALIBRATION_POINTS = [
  { x: 0.1, y: 0.1, index: 0 },
  // ... add more points
];
```

## Understanding Training Results

### Quality Score
- **0.8 - 1.0**: Excellent calibration
- **0.6 - 0.8**: Good calibration
- **0.4 - 0.6**: Fair calibration (consider recalibrating)
- **< 0.4**: Poor calibration (recalibrate required)

### Training Accuracy
- **< 20px**: Excellent for most use cases
- **20-40px**: Good for general gaze tracking
- **40-60px**: Acceptable for coarse tracking
- **> 60px**: Poor accuracy (recalibrate)

### Confidence Score
- **> 0.8**: High confidence prediction
- **0.6 - 0.8**: Medium confidence
- **< 0.6**: Low confidence (may be inaccurate)

## Using Your Eye Image Dataset

Your dataset (`Dataset/IRIS + PUPIL + EYE/`) contains eye segmentation images. To use this data:

### Option A: Extract Eye Features (Advanced)

You would need to:
1. Process images to extract eye landmarks
2. Use a tool like MediaPipe or OpenCV to detect eye features
3. Convert features to the required format
4. Map images to known gaze positions

**This requires additional setup and is more complex.**

### Option B: Use for Testing/Validation

Use the images to:
- Validate that your eye detection works
- Test different lighting conditions
- Verify segmentation quality

## Training Best Practices

### For Best Accuracy:

1. **Good Lighting:**
   - Ensure face is well-lit
   - Avoid backlighting
   - Consistent lighting during calibration and use

2. **Head Position:**
   - Keep head still during calibration
   - Maintain similar distance from screen
   - Sit at comfortable viewing angle

3. **Calibration Quality:**
   - Look directly at each calibration point
   - Wait for all samples to be collected
   - Recalibrate if quality score is low

4. **Multiple Calibrations:**
   - Calibrate for different lighting conditions
   - Calibrate for different seating positions
   - Keep the best performing model

## Troubleshooting

### Training Fails

**Error: "Backend is not healthy"**
```bash
# Make sure backend is running
npm run server
```

**Error: "Quality score too low"**
- Increase `SAMPLES_PER_POINT` in training script
- Check that calibration points cover the full screen
- Verify eye landmark data is properly formatted

### Low Accuracy

**Predictions are off by > 50px:**
1. Recalibrate the system
2. Check that screen resolution matches
3. Verify eye landmarks are normalized (0-1 range)
4. Increase calibration samples

**Predictions are inconsistent:**
1. Check for head movement during use
2. Verify lighting conditions are similar to calibration
3. Ensure webcam is stable and not moving

### Model Not Saving

**Check file permissions:**
```bash
# Verify models directory exists
ls -la models/

# Check write permissions
```

**Check disk space:**
```bash
# Ensure enough space for model files (~50KB per model)
```

## Advanced: Batch Training

To train multiple models for different users or conditions:

```javascript
// Create custom training script
const { trainModel } = require('./train_from_dataset');

async function batchTrain() {
  const conditions = [
    { name: 'bright_light', variation: 0.01 },
    { name: 'dim_light', variation: 0.03 },
    { name: 'normal_light', variation: 0.02 }
  ];
  
  for (const condition of conditions) {
    console.log(`Training for ${condition.name}...`);
    await trainModel(condition);
  }
}

batchTrain();
```

## Model Management

### View Saved Models

```bash
# List all trained models
ls -la models/

# View model metadata
cat models/user_xxx_model.json
```

### Export Model

```bash
# Use the API to export
curl http://localhost:4000/api/model/export/USER_ID > my_model.json
```

### Import Model

```bash
# Use the API to import
curl -X POST http://localhost:4000/api/model/import \
  -H "Content-Type: application/json" \
  -d @my_model.json
```

## Performance Optimization

### For Faster Training:

1. **Reduce samples per point** (minimum 20):
   ```javascript
   const SAMPLES_PER_POINT = 20;
   ```

2. **Use fewer calibration points** (minimum 5):
   ```javascript
   const CALIBRATION_POINTS = [
     { x: 0.1, y: 0.1 },   // Top-left
     { x: 0.9, y: 0.1 },   // Top-right
     { x: 0.5, y: 0.5 },   // Center
     { x: 0.1, y: 0.9 },   // Bottom-left
     { x: 0.9, y: 0.9 }    // Bottom-right
   ];
   ```

### For Better Accuracy:

1. **Increase samples per point** (up to 50):
   ```javascript
   const SAMPLES_PER_POINT = 50;
   ```

2. **Add more calibration points** (up to 16):
   ```javascript
   // Add intermediate points for better coverage
   ```

## Next Steps

After training:

1. ✅ **Test the model** - Use the web interface to verify accuracy
2. ✅ **Integrate with frontend** - Follow `BACKEND_INTEGRATION.md`
3. ✅ **Monitor performance** - Check prediction accuracy during use
4. ✅ **Recalibrate as needed** - If accuracy degrades over time
5. ✅ **Deploy** - When satisfied with accuracy

## API Reference

See `BACKEND_INTEGRATION.md` for complete API documentation.

Quick reference:
- `POST /api/calibration/session` - Create calibration session
- `POST /api/calibration/sample` - Add calibration sample
- `POST /api/calibration/complete` - Complete calibration and train
- `POST /api/predict` - Predict gaze position
- `GET /api/stats/:userId` - Get model statistics

---

**Questions?** Check the other documentation files or review the inline code comments!

🎯 **Happy training!** 👁️✨
