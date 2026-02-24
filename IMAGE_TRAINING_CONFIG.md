# Image Dataset Training Configuration

This file explains how to configure the image-based training for your specific dataset.

## Dataset Structure

Your dataset follows this structure:
```
Dataset/
└── IRIS + PUPIL + EYE/
    ├── train/
    │   ├── image/          # Eye images
    │   └── segmentation/   # Segmentation masks
    └── val/
        ├── image/
        └── segmentation/
```

## Filename Format

Your images follow this naming convention:
```
XXXX_Y_Z_A_BC_DDD.png
```

Where:
- `XXXX`: Subject ID (e.g., 0213, 0214, 0215)
- `Y`: Session number
- `Z`: Eye indicator (1=left, 2=right)
- `A`: Condition code
- `BC`: Position code (20-59)
- `DDD`: Sample number (000-999)

## Position Mapping

The script maps position codes to a 9-point calibration grid:

```
Grid Layout:
0 (Top-Left)      1 (Top-Center)      2 (Top-Right)
3 (Middle-Left)   4 (Center)          5 (Middle-Right)
6 (Bottom-Left)   7 (Bottom-Center)   8 (Bottom-Right)
```

### Default Mapping

Position codes are mapped as follows:

| Position Code | Grid Point | Location |
|--------------|------------|----------|
| 20-21 | 0 | Top-Left |
| 22-24 | 1 | Top-Center |
| 25-29 | 2 | Top-Right |
| 30-31 | 3 | Middle-Left |
| 32-34 | 4 | Center |
| 35-39 | 5 | Middle-Right |
| 40-41 | 6 | Bottom-Left |
| 42-44 | 7 | Bottom-Center |
| 45-59 | 8 | Bottom-Right |

## Customizing Position Mapping

If your dataset uses a different position encoding, edit the `mapPositionToCalibrationPoint()` function in `train_from_images.js`:

```javascript
function mapPositionToCalibrationPoint(position) {
  // Your custom mapping logic here
  // Return a number from 0-8 representing the calibration point
  
  switch(position) {
    case 20: return 0; // Top-Left
    case 21: return 1; // Top-Center
    case 22: return 2; // Top-Right
    // ... add your mappings
    default: return 4; // Center (fallback)
  }
}
```

## Screen Resolution

Default screen resolution is set to 1920x1080. To change this, edit these constants in `train_from_images.js`:

```javascript
const SCREEN_WIDTH = 1920;  // Your screen width
const SCREEN_HEIGHT = 1080; // Your screen height
```

## Feature Extraction

Currently, the script uses **synthetic feature extraction** based on gaze position. This means:

1. It reads the position code from the filename
2. Maps it to a calibration point
3. Generates eye landmarks that correlate with that gaze position
4. Adds natural variation to simulate real eye movement

### Why Synthetic Features?

- **No image processing required**: Works without complex computer vision libraries
- **Fast processing**: Can process hundreds of images quickly
- **Consistent format**: Generates data in the exact format the backend expects
- **Good baseline**: Provides a working model that can be refined

### Upgrading to Real Image Processing

For better accuracy, you can implement actual image processing:

1. **Install OpenCV or TensorFlow.js**:
   ```bash
   npm install @tensorflow/tfjs-node
   npm install @tensorflow-models/face-landmarks-detection
   ```

2. **Modify `extractEyeFeaturesFromImage()` function**:
   ```javascript
   async function extractEyeFeaturesFromImage(imagePath, metadata) {
     // Load image
     const imageBuffer = fs.readFileSync(imagePath);
     
     // Use face detection model to find eyes
     const landmarks = await detectFaceLandmarks(imageBuffer);
     
     // Extract eye regions
     const leftEye = extractEyeRegion(landmarks, 'left');
     const rightEye = extractEyeRegion(landmarks, 'right');
     
     // Calculate eye features
     const eyeLandmarks = {
       leftEye: calculateEyeFeatures(leftEye),
       rightEye: calculateEyeFeatures(rightEye)
     };
     
     return {
       eyeLandmarks,
       pointIndex: mapPositionToCalibrationPoint(metadata.position),
       screenX: ...,
       screenY: ...
     };
   }
   ```

## Running the Training

### Basic Usage

```bash
# Make sure backend is running
npm run server

# In another terminal, run image training
npm run train-from-images
```

### Expected Output

```
🖼️  Training Gaze Model from Pre-processed Images

User ID: image_trained_user_1234567890
Dataset Path: .../Dataset/IRIS + PUPIL + EYE/train/image

📁 Found 187 images

1️⃣  Checking backend...
✅ Backend is healthy

2️⃣  Creating calibration session...
✅ Session created: cal_xxx

3️⃣  Processing images and collecting calibration data...

   Point 1/9 (Top-Left): 10...20...30...✓ (30 samples)
   Point 2/9 (Top-Center): 10...20...30...✓ (30 samples)
   ...
   Point 9/9 (Bottom-Right): 10...20...30...✓ (30 samples)

   Total samples collected: 270

4️⃣  Training model...
✅ Training completed!

📊 Results:
   Quality Score: 0.850
   Total Samples: 270
   Training Accuracy: 18.45px
   Model ID: model_xxx

5️⃣  Testing predictions...
   ...

🎉 Training from images complete!
```

## Troubleshooting

### No images found
- Check that the dataset path is correct
- Verify images are in PNG format
- Ensure the `Dataset` folder is in the project root

### Low quality score
- Check position mapping is correct for your dataset
- Ensure you have images for all 9 calibration points
- Try increasing samples per point (edit `samplesToUse` limit)

### Training fails
- Make sure backend server is running
- Check backend logs for errors
- Verify image filenames follow the expected format

### Poor accuracy
- The synthetic features provide a baseline
- For better accuracy, implement real image processing
- Or use webcam calibration for real eye data

## Advanced Configuration

### Limiting Samples Per Point

Edit this line in `train_from_images.js`:

```javascript
const samplesToUse = images.slice(0, 30); // Change 30 to your desired number
```

### Using Validation Set

To use the validation set instead of training set:

```javascript
const DATASET_PATH = path.join(__dirname, 'Dataset', 'IRIS + PUPIL + EYE', 'val', 'image');
```

### Processing Both Eyes Separately

Currently, the script processes images regardless of which eye they show. To process left and right eyes separately:

```javascript
// Filter by eye
const leftEyeImages = imageFiles.filter(img => img.metadata.eye === '1');
const rightEyeImages = imageFiles.filter(img => img.metadata.eye === '2');
```

## Next Steps

1. **Run the training** with default settings
2. **Check the accuracy** of the trained model
3. **Adjust position mapping** if needed
4. **Implement real image processing** for better accuracy
5. **Compare with webcam calibration** to see the difference

## Integration with Frontend

Once trained, the model can be used in your frontend application:

```javascript
import gazeAPI from './api/gazeBackend';

// Use the image-trained model
gazeAPI.userId = 'image_trained_user_1234567890';

// Make predictions
const prediction = await gazeAPI.predict(eyeLandmarks);
```

---

**Questions?** Check the main documentation files or review the code comments in `train_from_images.js`!
