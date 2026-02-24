/**
 * GazeTracker – front-end calibration utility
 *
 * When using the Python OpenCV backend the gaze_data stream already carries
 * calibrated (0-1 normalized) coordinates.  This class is kept for:
 *  - A pure-JS fallback (WebGazer / raw iris) when the backend is unavailable
 *  - Additional EMA smoothing on the frontend side
 */
class GazeTracker {
  constructor() {
    this.calibrationData = [];
    this.isCalibrated = false;
    this.smoothingFactor = 0.32;      // EMA α – increase for less lag, decrease for less jitter
    this.lastGazePoint = { x: 0, y: 0 };
    this.calibrationModel = null;      // { ax, bx, ay, by }
  }

  async initialize() {
    console.log('[GazeTracker] Initialized (calibration + smoothing utility)');
    return true;
  }

  /** Add one calibration sample for the frontend fallback model. */
  addCalibrationPoint(gazePoint, screenPoint) {
    // gazePoint: { rawX, rawY } – either pixel coords from WebGazer,
    //            or 0-1 iris coords when coming from the Python backend.
    this.calibrationData.push({
      gaze: {
        x: gazePoint.rawX ?? gazePoint.x ?? 0.5,
        y: gazePoint.rawY ?? gazePoint.y ?? 0.5
      },
      screen: screenPoint,
    });
  }

  /**
   * Fit a simple linear regression gaze → screen for the JS fallback path.
   * Returns true on success.
   */
  completeCalibration() {
    if (this.calibrationData.length < 4) return false;

    const n = this.calibrationData.length;
    let sumGx = 0, sumGy = 0, sumSx = 0, sumSy = 0;
    let sumGx2 = 0, sumGy2 = 0, sumGxSx = 0, sumGySy = 0;

    this.calibrationData.forEach(({ gaze: { x: gx, y: gy }, screen: { x: sx, y: sy } }) => {
      sumGx += gx; sumGy += gy;
      sumSx += sx; sumSy += sy;
      sumGx2 += gx * gx; sumGy2 += gy * gy;
      sumGxSx += gx * sx; sumGySy += gy * sy;
    });

    const denomX = n * sumGx2 - sumGx * sumGx;
    const denomY = n * sumGy2 - sumGy * sumGy;

    let ax = 0, bx = 0, ay = 0, by = 0;

    if (Math.abs(denomX) > 1e-9) {
      ax = (n * sumGxSx - sumGx * sumSx) / denomX;
      bx = (sumSx - ax * sumGx) / n;
    } else {
      const gxArr = this.calibrationData.map(p => p.gaze.x);
      const sxArr = this.calibrationData.map(p => p.screen.x);
      const minGx = Math.min(...gxArr), maxGx = Math.max(...gxArr);
      const minSx = Math.min(...sxArr), maxSx = Math.max(...sxArr);
      ax = maxGx !== minGx ? (maxSx - minSx) / (maxGx - minGx) : 1;
      bx = minSx - ax * minGx;
    }

    if (Math.abs(denomY) > 1e-9) {
      ay = (n * sumGySy - sumGy * sumSy) / denomY;
      by = (sumSy - ay * sumGy) / n;
    } else {
      const gyArr = this.calibrationData.map(p => p.gaze.y);
      const syArr = this.calibrationData.map(p => p.screen.y);
      const minGy = Math.min(...gyArr), maxGy = Math.max(...gyArr);
      const minSy = Math.min(...syArr), maxSy = Math.max(...syArr);
      ay = maxGy !== minGy ? (maxSy - minSy) / (maxGy - minGy) : 1;
      by = minSy - ay * minGy;
    }

    this.calibrationModel = { ax, bx, ay, by };
    this.isCalibrated = true;
    console.log('[GazeTracker] Calibration complete', this.calibrationModel,
      `(${this.calibrationData.length} pts)`);
    return true;
  }

  resetCalibration() {
    this.calibrationData = [];
    this.isCalibrated = false;
    this.calibrationModel = null;
    this.lastGazePoint = { x: 0, y: 0 };
  }

  getCalibrationResult() {
    return {
      calibrationData: this.calibrationData,
      calibrationModel: this.calibrationModel,
      isCalibrated: this.isCalibrated,
    };
  }

  /**
   * Map a raw gaze point to screen coordinates with optional smoothing.
   *
   * @param {object} gazePoint  – { x, y } normalized 0-1 OR { rawX, rawY }
   * @param {number} screenWidth
   * @param {number} screenHeight
   */
  mapGazeToScreen(gazePoint, screenWidth, screenHeight) {
    let mappedX, mappedY;

    const rawX = gazePoint.rawX ?? gazePoint.x;
    const rawY = gazePoint.rawY ?? gazePoint.y;

    if (this.isCalibrated && this.calibrationModel) {
      const { ax, bx, ay, by } = this.calibrationModel;
      const hasX = Number.isFinite(ax) && Math.abs(ax) > 1e-6;
      const hasY = Number.isFinite(ay) && Math.abs(ay) > 1e-6;

      mappedX = hasX ? ax * rawX + bx : rawX * screenWidth;
      mappedY = hasY ? ay * rawY + by : rawY * screenHeight;
    } else {
      // No calibration – treat raw values as normalized 0-1
      mappedX = rawX * screenWidth;
      mappedY = rawY * screenHeight;
    }

    // Exponential moving average smoothing
    const α = this.smoothingFactor;
    const smoothX = this.lastGazePoint.x + α * (mappedX - this.lastGazePoint.x);
    const smoothY = this.lastGazePoint.y + α * (mappedY - this.lastGazePoint.y);
    this.lastGazePoint = { x: smoothX, y: smoothY };

    return {
      x: Math.max(0, Math.min(screenWidth, smoothX)),
      y: Math.max(0, Math.min(screenHeight, smoothY)),
    };
  }

  dispose() { /* nothing to clean up */ }
}

export default GazeTracker;
