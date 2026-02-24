/**
 * Gaze Prediction Model
 * Implements polynomial regression for eye tracking with 9-point calibration
 */

class GazeModel {
  constructor() {
    // Model coefficients for X and Y predictions
    this.coefficientsX = null;
    this.coefficientsY = null;

    // Normalization parameters
    this.normalizationParams = {
      eyeFeatures: { mean: null, std: null },
      screenCoords: { mean: null, std: null }
    };

    // Model metadata
    this.metadata = {
      trained: false,
      trainingDate: null,
      sampleCount: 0,
      accuracy: null
    };
  }

  /**
   * Extract features from eye landmarks
   * @param {Object} eyeLandmarks - Face mesh eye landmarks
   * @returns {Array} Feature vector
   */
  extractFeatures(eyeLandmarks) {
    if (!eyeLandmarks || !eyeLandmarks.leftEye || !eyeLandmarks.rightEye) {
      throw new Error('Invalid eye landmarks');
    }

    const features = [];

    // Left eye features
    const leftEye = eyeLandmarks.leftEye;
    features.push(
      leftEye.centerX,
      leftEye.centerY,
      leftEye.width,
      leftEye.height,
      leftEye.aspectRatio || (leftEye.width / leftEye.height)
    );

    // Right eye features
    const rightEye = eyeLandmarks.rightEye;
    features.push(
      rightEye.centerX,
      rightEye.centerY,
      rightEye.width,
      rightEye.height,
      rightEye.aspectRatio || (rightEye.width / rightEye.height)
    );

    // Inter-eye features
    const eyeDistance = Math.sqrt(
      Math.pow(rightEye.centerX - leftEye.centerX, 2) +
      Math.pow(rightEye.centerY - leftEye.centerY, 2)
    );
    features.push(eyeDistance);

    // Eye center point
    const eyeCenterX = (leftEye.centerX + rightEye.centerX) / 2;
    const eyeCenterY = (leftEye.centerY + rightEye.centerY) / 2;
    features.push(eyeCenterX, eyeCenterY);

    // Head pose if available
    if (eyeLandmarks.headPose) {
      features.push(
        eyeLandmarks.headPose.pitch || 0,
        eyeLandmarks.headPose.yaw || 0,
        eyeLandmarks.headPose.roll || 0
      );
    }

    return features;
  }

  /**
   * Create polynomial features for better accuracy
   * @param {Array} features - Base features
   * @param {Number} degree - Polynomial degree (default: 2)
   * @returns {Array} Polynomial features
   */
  createPolynomialFeatures(features, degree = 2) {
    const polyFeatures = [...features];

    // Add squared terms
    if (degree >= 2) {
      for (let i = 0; i < features.length; i++) {
        polyFeatures.push(features[i] * features[i]);
      }

      // Add interaction terms (cross products)
      for (let i = 0; i < features.length; i++) {
        for (let j = i + 1; j < features.length; j++) {
          polyFeatures.push(features[i] * features[j]);
        }
      }
    }

    // Add cubic terms if needed
    if (degree >= 3) {
      for (let i = 0; i < features.length; i++) {
        polyFeatures.push(features[i] * features[i] * features[i]);
      }
    }

    // Add bias term
    polyFeatures.push(1);

    return polyFeatures;
  }

  /**
   * Normalize features using z-score normalization
   * @param {Array} features - Raw features
   * @param {Object} params - Normalization parameters
   * @returns {Array} Normalized features
   */
  normalize(features, params) {
    if (!params.mean || !params.std) {
      return features;
    }

    return features.map((val, idx) => {
      const mean = params.mean[idx] || 0;
      const std = params.std[idx] || 1;
      return std !== 0 ? (val - mean) / std : val;
    });
  }

  /**
   * Calculate normalization parameters from training data
   * @param {Array} dataMatrix - 2D array of features
   * @returns {Object} Mean and std for each feature
   */
  calculateNormalizationParams(dataMatrix) {
    const numFeatures = dataMatrix[0].length;
    const numSamples = dataMatrix.length;

    const mean = new Array(numFeatures).fill(0);
    const std = new Array(numFeatures).fill(0);

    // Calculate mean
    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numFeatures; j++) {
        mean[j] += dataMatrix[i][j];
      }
    }
    mean.forEach((val, idx) => { mean[idx] = val / numSamples; });

    // Calculate standard deviation
    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j < numFeatures; j++) {
        std[j] += Math.pow(dataMatrix[i][j] - mean[j], 2);
      }
    }
    std.forEach((val, idx) => {
      std[idx] = Math.sqrt(val / numSamples);
      // Prevent division by zero
      if (std[idx] === 0) std[idx] = 1;
    });

    return { mean, std };
  }

  /**
   * Solve linear regression using normal equation
   * @param {Array} X - Feature matrix
   * @param {Array} y - Target values
   * @returns {Array} Coefficients
   */
  solveLinearRegression(X, y) {
    // Using Ridge Regression (L2 regularization) to prevent singular matrices
    // β = (X^T X + λI)^-1 X^T y
    const lambda = 1e-5; // Small regularization parameter

    const XT = this.transpose(X);
    const XTX = this.matrixMultiply(XT, X);

    // Add lambda to diagonal elements
    const n = XTX.length;
    for (let i = 0; i < n; i++) {
      XTX[i][i] += lambda;
    }

    const XTXinv = this.matrixInverse(XTX);
    const XTy = this.matrixVectorMultiply(XT, y);
    const coefficients = this.matrixVectorMultiply(XTXinv, XTy);

    return coefficients;
  }

  /**
   * Train the gaze prediction model
   * @param {Array} calibrationData - Array of {eyeLandmarks, screenX, screenY}
   * @returns {Object} Training results
   */
  train(calibrationData) {
    console.log('DEBUG: GazeModel.train called with', calibrationData ? calibrationData.length : 'null', 'samples');

    if (!calibrationData || calibrationData.length < 9) {
      throw new Error('Insufficient calibration data. Need at least 9 points.');
    }

    try {
      // Extract features and targets
      const features = [];
      const targetsX = [];
      const targetsY = [];

      console.log('DEBUG: Extracting features...');
      for (const sample of calibrationData) {
        if (!sample.eyeLandmarks) console.log('DEBUG: Missing eyeLandmarks in sample');
        const baseFeatures = this.extractFeatures(sample.eyeLandmarks);
        const polyFeatures = this.createPolynomialFeatures(baseFeatures, 2);
        features.push(polyFeatures);
        targetsX.push(sample.screenX);
        targetsY.push(sample.screenY);
      }
      console.log('DEBUG: Features extracted. Count:', features.length);

      // Calculate normalization parameters
      console.log('DEBUG: Calculating normalization params...');
      this.normalizationParams.eyeFeatures = this.calculateNormalizationParams(features);

      console.log('DEBUG: Calculating screen coord params...');
      this.normalizationParams.screenCoords = {
        mean: [
          targetsX.reduce((a, b) => a + b, 0) / targetsX.length,
          targetsY.reduce((a, b) => a + b, 0) / targetsY.length
        ],
        std: [
          Math.sqrt(targetsX.reduce((sum, val) => sum + Math.pow(val - (this.normalizationParams.screenCoords && this.normalizationParams.screenCoords.mean ? this.normalizationParams.screenCoords.mean[0] : 0), 2), 0) / targetsX.length),
          Math.sqrt(targetsY.reduce((sum, val) => sum + Math.pow(val - (this.normalizationParams.screenCoords && this.normalizationParams.screenCoords.mean ? this.normalizationParams.screenCoords.mean[1] : 0), 2), 0) / targetsY.length)
        ]
      };
      console.log('DEBUG: Normalization params calculated');

      // Normalize features
      const normalizedFeatures = features.map(f =>
        this.normalize(f, this.normalizationParams.eyeFeatures)
      );

      // Train separate models for X and Y coordinates
      console.log('DEBUG: Solving linear regression...');
      this.coefficientsX = this.solveLinearRegression(normalizedFeatures, targetsX);
      this.coefficientsY = this.solveLinearRegression(normalizedFeatures, targetsY);

      // Calculate training accuracy
      const predictions = normalizedFeatures.map(f => ({
        x: this.dotProduct(f, this.coefficientsX),
        y: this.dotProduct(f, this.coefficientsY)
      }));

      const errors = predictions.map((pred, idx) => {
        const dx = pred.x - targetsX[idx];
        const dy = pred.y - targetsY[idx];
        return Math.sqrt(dx * dx + dy * dy);
      });

      const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;

      // Update metadata
      this.metadata = {
        trained: true,
        trainingDate: new Date().toISOString(),
        sampleCount: calibrationData.length,
        accuracy: avgError,
        maxError: Math.max(...errors),
        minError: Math.min(...errors)
      };

      return {
        success: true,
        metadata: this.metadata,
        message: `Model trained successfully with ${calibrationData.length} samples. Average error: ${avgError.toFixed(2)}px`
      };

    } catch (error) {
      throw new Error(`Training failed: ${error.message}`);
    }
  }

  /**
   * Predict gaze coordinates from eye landmarks
   * @param {Object} eyeLandmarks - Current eye landmarks
   * @returns {Object} Predicted {x, y} screen coordinates
   */
  predict(eyeLandmarks) {
    if (!this.metadata.trained) {
      throw new Error('Model not trained. Please calibrate first.');
    }

    try {
      // Extract and process features
      const baseFeatures = this.extractFeatures(eyeLandmarks);
      const polyFeatures = this.createPolynomialFeatures(baseFeatures, 2);
      const normalizedFeatures = this.normalize(polyFeatures, this.normalizationParams.eyeFeatures);

      // Predict coordinates
      const x = this.dotProduct(normalizedFeatures, this.coefficientsX);
      const y = this.dotProduct(normalizedFeatures, this.coefficientsY);

      return { x, y, confidence: this.calculateConfidence(normalizedFeatures) };

    } catch (error) {
      throw new Error(`Prediction failed: ${error.message}`);
    }
  }

  /**
   * Calculate prediction confidence based on feature similarity to training data
   * @param {Array} features - Current features
   * @returns {Number} Confidence score (0-1)
   */
  calculateConfidence(features) {
    // Simple confidence based on feature magnitude
    // In production, use Mahalanobis distance or similar
    const magnitude = Math.sqrt(features.reduce((sum, val) => sum + val * val, 0));
    const expectedMagnitude = Math.sqrt(features.length);
    const ratio = Math.min(magnitude / expectedMagnitude, expectedMagnitude / magnitude);
    return Math.max(0, Math.min(1, ratio));
  }

  /**
   * Matrix operations
   */
  transpose(matrix) {
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
  }

  matrixMultiply(A, B) {
    const result = [];
    for (let i = 0; i < A.length; i++) {
      result[i] = [];
      for (let j = 0; j < B[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < A[0].length; k++) {
          sum += A[i][k] * B[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  matrixVectorMultiply(matrix, vector) {
    return matrix.map(row => this.dotProduct(row, vector));
  }

  dotProduct(a, b) {
    return a.reduce((sum, val, idx) => sum + val * b[idx], 0);
  }

  matrixInverse(matrix) {
    const n = matrix.length;
    const identity = Array(n).fill(0).map((_, i) =>
      Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    );

    const augmented = matrix.map((row, i) => [...row, ...identity[i]]);

    // Gaussian elimination with partial pivoting
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Make diagonal 1
      const divisor = augmented[i][i];
      if (Math.abs(divisor) < 1e-10) {
        throw new Error('Matrix is singular');
      }
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= divisor;
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    return augmented.map(row => row.slice(n));
  }

  /**
   * Export model for persistence
   */
  export() {
    return {
      coefficientsX: this.coefficientsX,
      coefficientsY: this.coefficientsY,
      normalizationParams: this.normalizationParams,
      metadata: this.metadata
    };
  }

  /**
   * Import model from saved state
   */
  import(modelData) {
    this.coefficientsX = modelData.coefficientsX;
    this.coefficientsY = modelData.coefficientsY;
    this.normalizationParams = modelData.normalizationParams;
    this.metadata = modelData.metadata;
  }
}

module.exports = GazeModel;
