/**
 * Calibration Service
 * Manages calibration sessions, data validation, and quality assessment
 */

class CalibrationService {
    constructor() {
        this.sessions = new Map(); // userId -> calibration session
        this.qualityThresholds = {
            minSamplesPerPoint: 20,
            maxSamplesPerPoint: 50,
            minPoints: 5, // Reduced from 9 to allow partial calibration
            maxVariance: 100, // pixels
            minConfidence: 0.6 // Reduced from 0.7 for more flexibility
        };
    }

    /**
     * Create a new calibration session
     * @param {String} userId - User identifier
     * @returns {Object} Session info
     */
    createSession(userId) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            userId: userId || 'anonymous',
            startTime: Date.now(),
            points: [],
            samples: [],
            status: 'active',
            metadata: {
                screenWidth: null,
                screenHeight: null,
                cameraResolution: null
            }
        };

        this.sessions.set(sessionId, session);
        return { sessionId, status: 'created' };
    }

    /**
     * Add calibration sample
     * @param {String} sessionId - Session identifier
     * @param {Object} sample - Calibration sample data
     * @returns {Object} Result
     */
    addSample(sessionId, sample) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Invalid session ID');
        }

        if (session.status !== 'active') {
            throw new Error('Session is not active');
        }

        // Validate sample
        const validation = this.validateSample(sample);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Add sample to session
        session.samples.push({
            ...sample,
            timestamp: Date.now(),
            pointIndex: sample.pointIndex
        });

        // Check if point is complete
        const pointSamples = session.samples.filter(s => s.pointIndex === sample.pointIndex);
        if (pointSamples.length >= this.qualityThresholds.minSamplesPerPoint) {
            const pointQuality = this.assessPointQuality(pointSamples);

            if (!session.points.find(p => p.index === sample.pointIndex)) {
                session.points.push({
                    index: sample.pointIndex,
                    screenX: sample.screenX,
                    screenY: sample.screenY,
                    sampleCount: pointSamples.length,
                    quality: pointQuality
                });
            }
        }

        return {
            success: true,
            totalSamples: session.samples.length,
            pointsCompleted: session.points.length,
            currentPointSamples: pointSamples.length
        };
    }

    /**
     * Validate calibration sample
     * @param {Object} sample - Sample to validate
     * @returns {Object} Validation result
     */
    validateSample(sample) {
        if (!sample.eyeLandmarks) {
            return { valid: false, error: 'Missing eye landmarks' };
        }

        if (!sample.eyeLandmarks.leftEye || !sample.eyeLandmarks.rightEye) {
            return { valid: false, error: 'Incomplete eye data' };
        }

        if (typeof sample.screenX !== 'number' || typeof sample.screenY !== 'number') {
            return { valid: false, error: 'Invalid screen coordinates' };
        }

        if (typeof sample.pointIndex !== 'number' || sample.pointIndex < 0 || sample.pointIndex > 8) {
            return { valid: false, error: 'Invalid point index' };
        }

        // Check for reasonable eye landmark values
        const { leftEye, rightEye } = sample.eyeLandmarks;
        if (leftEye.centerX < 0 || leftEye.centerX > 1 ||
            leftEye.centerY < 0 || leftEye.centerY > 1 ||
            rightEye.centerX < 0 || rightEye.centerX > 1 ||
            rightEye.centerY < 0 || rightEye.centerY > 1) {
            return { valid: false, error: 'Eye landmarks out of range' };
        }

        return { valid: true };
    }

    /**
     * Assess quality of samples for a calibration point
     * @param {Array} samples - Samples for a single point
     * @returns {Object} Quality metrics
     */
    assessPointQuality(samples) {
        if (samples.length === 0) {
            return { score: 0, variance: Infinity, stability: 0 };
        }

        // Calculate variance in eye positions
        const leftEyeX = samples.map(s => s.eyeLandmarks.leftEye.centerX);
        const leftEyeY = samples.map(s => s.eyeLandmarks.leftEye.centerY);
        const rightEyeX = samples.map(s => s.eyeLandmarks.rightEye.centerX);
        const rightEyeY = samples.map(s => s.eyeLandmarks.rightEye.centerY);

        const variance = {
            leftEyeX: this.calculateVariance(leftEyeX),
            leftEyeY: this.calculateVariance(leftEyeY),
            rightEyeX: this.calculateVariance(rightEyeX),
            rightEyeY: this.calculateVariance(rightEyeY)
        };

        const avgVariance = (variance.leftEyeX + variance.leftEyeY +
            variance.rightEyeX + variance.rightEyeY) / 4;

        // Calculate stability (lower variance = higher stability)
        const stability = Math.max(0, 1 - (avgVariance * 1000)); // Scale factor

        // Calculate overall quality score
        const sampleScore = Math.min(samples.length / this.qualityThresholds.minSamplesPerPoint, 1);
        const qualityScore = (stability * 0.7 + sampleScore * 0.3);

        return {
            score: qualityScore,
            variance: avgVariance,
            stability: stability,
            sampleCount: samples.length
        };
    }

    /**
     * Calculate variance of an array
     * @param {Array} values - Numeric values
     * @returns {Number} Variance
     */
    calculateVariance(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }

    /**
     * Complete calibration session
     * @param {String} sessionId - Session identifier
     * @returns {Object} Calibration data
     */
    completeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Invalid session ID');
        }

        if (session.points.length < this.qualityThresholds.minPoints) {
            throw new Error(`Insufficient calibration points. Got ${session.points.length}, need ${this.qualityThresholds.minPoints}`);
        }

        // Assess overall session quality
        const sessionQuality = this.assessSessionQuality(session);

        if (sessionQuality.score < this.qualityThresholds.minConfidence) {
            return {
                success: false,
                error: 'Calibration quality too low',
                quality: sessionQuality,
                recommendation: 'Please recalibrate with better lighting and stable head position'
            };
        }

        session.status = 'completed';
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;
        session.quality = sessionQuality;

        // Prepare calibration data for model training
        const calibrationData = this.prepareCalibrationData(session);

        return {
            success: true,
            sessionId: sessionId,
            quality: sessionQuality,
            calibrationData: calibrationData,
            metadata: {
                duration: session.duration,
                totalSamples: session.samples.length,
                pointsCalibrated: session.points.length
            }
        };
    }

    /**
     * Assess overall session quality
     * @param {Object} session - Calibration session
     * @returns {Object} Quality assessment
     */
    assessSessionQuality(session) {
        // Handle empty points array
        if (!session.points || session.points.length === 0) {
            return {
                score: 0,
                avgPointQuality: 0,
                minPointQuality: 0,
                coverage: 0,
                temporalConsistency: 0,
                recommendation: 'No calibration points collected',
                totalSamples: session.samples ? session.samples.length : 0,
                averageVariance: 0
            };
        }

        const pointQualities = session.points.map(p => p.quality.score);
        const avgQuality = pointQualities.reduce((a, b) => a + b, 0) / pointQualities.length;
        const minQuality = Math.min(...pointQualities);

        // Check for coverage of all 9 points
        const coverage = session.points.length / 9;

        // Calculate temporal consistency
        const temporalConsistency = this.calculateTemporalConsistency(session.samples);

        const overallScore = (avgQuality * 0.5 + minQuality * 0.3 + coverage * 0.1 + temporalConsistency * 0.1);

        // Calculate average variance
        const variances = session.points.map(p => p.quality.variance || 0);
        const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;

        return {
            score: overallScore,
            avgPointQuality: avgQuality,
            minPointQuality: minQuality,
            coverage: coverage,
            temporalConsistency: temporalConsistency,
            recommendation: this.getQualityRecommendation(overallScore),
            totalSamples: session.samples.length,
            averageVariance: avgVariance
        };
    }

    /**
     * Calculate temporal consistency of samples
     * @param {Array} samples - All calibration samples
     * @returns {Number} Consistency score (0-1)
     */
    calculateTemporalConsistency(samples) {
        if (samples.length < 2) return 1;

        let consistencySum = 0;
        let comparisons = 0;

        // Compare consecutive samples for the same point
        for (let i = 0; i < 9; i++) {
            const pointSamples = samples.filter(s => s.pointIndex === i);
            if (pointSamples.length < 2) continue;

            for (let j = 1; j < pointSamples.length; j++) {
                const prev = pointSamples[j - 1].eyeLandmarks;
                const curr = pointSamples[j].eyeLandmarks;

                const distance = Math.sqrt(
                    Math.pow(curr.leftEye.centerX - prev.leftEye.centerX, 2) +
                    Math.pow(curr.leftEye.centerY - prev.leftEye.centerY, 2)
                );

                // Lower distance = higher consistency
                consistencySum += Math.max(0, 1 - distance * 10);
                comparisons++;
            }
        }

        return comparisons > 0 ? consistencySum / comparisons : 1;
    }

    /**
     * Get quality recommendation based on score
     * @param {Number} score - Quality score
     * @returns {String} Recommendation
     */
    getQualityRecommendation(score) {
        if (score >= 0.9) return 'Excellent calibration';
        if (score >= 0.8) return 'Good calibration';
        if (score >= 0.7) return 'Acceptable calibration';
        if (score >= 0.6) return 'Fair calibration - consider recalibrating';
        return 'Poor calibration - please recalibrate';
    }

    /**
     * Prepare calibration data for model training
     * @param {Object} session - Completed session
     * @returns {Array} Formatted calibration data
     */
    prepareCalibrationData(session) {
        const calibrationData = [];

        for (const point of session.points) {
            const pointSamples = session.samples.filter(s => s.pointIndex === point.index);

            // Use all samples for training (better generalization)
            for (const sample of pointSamples) {
                calibrationData.push({
                    eyeLandmarks: sample.eyeLandmarks,
                    screenX: sample.screenX,
                    screenY: sample.screenY,
                    pointIndex: sample.pointIndex,
                    quality: point.quality.score
                });
            }
        }

        return calibrationData;
    }

    /**
     * Get session info
     * @param {String} sessionId - Session identifier
     * @returns {Object} Session information
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Invalid session ID');
        }

        return {
            id: session.id,
            userId: session.userId,
            status: session.status,
            pointsCompleted: session.points.length,
            totalSamples: session.samples.length,
            startTime: session.startTime,
            duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime
        };
    }

    /**
     * Delete session
     * @param {String} sessionId - Session identifier
     */
    deleteSession(sessionId) {
        this.sessions.delete(sessionId);
    }

    /**
     * Clean up old sessions (older than 1 hour)
     */
    cleanupOldSessions() {
        const oneHourAgo = Date.now() - 3600000;
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.startTime < oneHourAgo) {
                this.sessions.delete(sessionId);
            }
        }
    }

    /**
     * Generate unique session ID
     * @returns {String} Session ID
     */
    generateSessionId() {
        return `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = CalibrationService;
