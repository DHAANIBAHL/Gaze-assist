/**
 * Training Script for Gaze Assist Model
 * 
 * This script trains the gaze tracking model using pre-collected calibration data
 * or simulated data from the eye dataset.
 * 
 * Usage:
 *   node train_from_dataset.js
 */

// Use native fetch (Node.js 18+) or install node-fetch
const fs = require('fs');
const path = require('path');

// Check if native fetch is available, otherwise provide a polyfill message
if (typeof fetch === 'undefined') {
    global.fetch = async (url, options = {}) => {
        const http = require('http');
        const https = require('https');
        const urlModule = require('url');

        return new Promise((resolve, reject) => {
            const parsedUrl = urlModule.parse(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const reqOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path,
                method: options.method || 'GET',
                headers: options.headers || {}
            };

            const req = protocol.request(reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: async () => JSON.parse(data),
                        text: async () => data
                    });
                });
            });

            req.on('error', reject);

            if (options.body) {
                req.write(options.body);
            }

            req.end();
        });
    };
}

const API_BASE_URL = 'http://localhost:4000';
const USER_ID = 'training_user_' + Date.now();

// 9-point calibration grid (normalized coordinates)
const CALIBRATION_POINTS = [
    { x: 0.1, y: 0.1, index: 0 },  // Top-left
    { x: 0.5, y: 0.1, index: 1 },  // Top-center
    { x: 0.9, y: 0.1, index: 2 },  // Top-right
    { x: 0.1, y: 0.5, index: 3 },  // Middle-left
    { x: 0.5, y: 0.5, index: 4 },  // Center
    { x: 0.9, y: 0.5, index: 5 },  // Middle-right
    { x: 0.1, y: 0.9, index: 6 },  // Bottom-left
    { x: 0.5, y: 0.9, index: 7 },  // Bottom-center
    { x: 0.9, y: 0.9, index: 8 }   // Bottom-right
];

const SAMPLES_PER_POINT = 30;
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;

/**
 * Generate realistic eye landmark data with variations
 * This simulates what MediaPipe would provide
 */
function generateEyeLandmarks(pointIndex, sampleIndex, totalSamples) {
    const point = CALIBRATION_POINTS[pointIndex];

    // Add natural variation to simulate real eye movements
    const variation = 0.02; // 2% variation
    const progress = sampleIndex / totalSamples;

    // Simulate eye position based on gaze point
    const baseLeftX = 0.45 + (point.x - 0.5) * 0.1;
    const baseLeftY = 0.48 + (point.y - 0.5) * 0.1;
    const baseRightX = 0.55 + (point.x - 0.5) * 0.1;
    const baseRightY = 0.48 + (point.y - 0.5) * 0.1;

    // Add random noise to simulate natural eye jitter
    const noise = () => (Math.random() - 0.5) * variation;

    return {
        leftEye: {
            centerX: baseLeftX + noise(),
            centerY: baseLeftY + noise(),
            width: 0.05 + noise() * 0.5,
            height: 0.03 + noise() * 0.5,
            aspectRatio: 1.67 + noise() * 0.2
        },
        rightEye: {
            centerX: baseRightX + noise(),
            centerY: baseRightY + noise(),
            width: 0.05 + noise() * 0.5,
            height: 0.03 + noise() * 0.5,
            aspectRatio: 1.67 + noise() * 0.2
        },
        headPose: {
            pitch: noise() * 10,
            yaw: noise() * 10,
            roll: noise() * 5
        }
    };
}

/**
 * Create a calibration session
 */
async function createSession() {
    console.log('📝 Creating calibration session...');

    const response = await fetch(`${API_BASE_URL}/api/calibration/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID })
    });

    const data = await response.json();
    console.log(`✅ Session created: ${data.sessionId}`);
    return data.sessionId;
}

/**
 * Add a calibration sample
 */
async function addSample(sessionId, pointIndex, screenX, screenY, eyeLandmarks) {
    const response = await fetch(`${API_BASE_URL}/api/calibration/sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId,
            pointIndex,
            screenX,
            screenY,
            eyeLandmarks
        })
    });

    return await response.json();
}

/**
 * Complete calibration and train the model
 */
async function completeCalibration(sessionId) {
    console.log('\n🎓 Training model...');

    const response = await fetch(`${API_BASE_URL}/api/calibration/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId,
            userId: USER_ID
        })
    });

    return await response.json();
}

/**
 * Test the trained model with predictions
 */
async function testPredictions() {
    console.log('\n🧪 Testing predictions...');

    const testPoints = [
        { x: 0.25, y: 0.25, name: 'Quarter-left-top' },
        { x: 0.75, y: 0.75, name: 'Quarter-right-bottom' },
        { x: 0.5, y: 0.5, name: 'Center' }
    ];

    let totalError = 0;

    for (const testPoint of testPoints) {
        // Generate test eye landmarks
        const eyeLandmarks = {
            leftEye: {
                centerX: 0.45 + (testPoint.x - 0.5) * 0.1,
                centerY: 0.48 + (testPoint.y - 0.5) * 0.1,
                width: 0.05,
                height: 0.03,
                aspectRatio: 1.67
            },
            rightEye: {
                centerX: 0.55 + (testPoint.x - 0.5) * 0.1,
                centerY: 0.48 + (testPoint.y - 0.5) * 0.1,
                width: 0.05,
                height: 0.03,
                aspectRatio: 1.67
            }
        };

        const response = await fetch(`${API_BASE_URL}/api/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: USER_ID,
                eyeLandmarks
            })
        });

        const result = await response.json();

        if (result.success) {
            const expectedX = testPoint.x * SCREEN_WIDTH;
            const expectedY = testPoint.y * SCREEN_HEIGHT;
            const errorX = Math.abs(result.prediction.x - expectedX);
            const errorY = Math.abs(result.prediction.y - expectedY);
            const error = Math.sqrt(errorX * errorX + errorY * errorY);

            totalError += error;

            console.log(`  ${testPoint.name}:`);
            console.log(`    Expected: (${expectedX.toFixed(0)}, ${expectedY.toFixed(0)})`);
            console.log(`    Predicted: (${result.prediction.x.toFixed(0)}, ${result.prediction.y.toFixed(0)})`);
            console.log(`    Error: ${error.toFixed(2)}px`);
            console.log(`    Confidence: ${result.prediction.confidence.toFixed(3)}`);
        }
    }

    const avgError = totalError / testPoints.length;
    console.log(`\n  Average Error: ${avgError.toFixed(2)}px`);

    return avgError;
}

/**
 * Get model statistics
 */
async function getModelStats() {
    const response = await fetch(`${API_BASE_URL}/api/stats/${USER_ID}`);
    const stats = await response.json();

    if (stats.success) {
        console.log('\n📊 Model Statistics:');
        console.log(`  Total Predictions: ${stats.stats.totalPredictions}`);
        console.log(`  Average Confidence: ${stats.stats.averageConfidence.toFixed(3)}`);
        console.log(`  Model Created: ${new Date(stats.stats.modelCreatedAt).toLocaleString()}`);
    }
}

/**
 * Main training function
 */
async function trainModel() {
    console.log('🚀 Starting Gaze Assist Model Training\n');
    console.log(`User ID: ${USER_ID}`);
    console.log(`Screen Resolution: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}`);
    console.log(`Calibration Points: ${CALIBRATION_POINTS.length}`);
    console.log(`Samples per Point: ${SAMPLES_PER_POINT}`);
    console.log(`Total Samples: ${CALIBRATION_POINTS.length * SAMPLES_PER_POINT}\n`);

    try {
        // Check if backend is running
        console.log('🔍 Checking backend connection...');
        const healthCheck = await fetch(`${API_BASE_URL}/health`);
        const health = await healthCheck.json();

        if (health.status !== 'ok') {
            throw new Error('Backend is not healthy');
        }
        console.log('✅ Backend is running\n');

        // Create calibration session
        const sessionId = await createSession();

        // Collect calibration data for each point
        console.log('\n📸 Collecting calibration data...\n');

        for (const point of CALIBRATION_POINTS) {
            const screenX = point.x * SCREEN_WIDTH;
            const screenY = point.y * SCREEN_HEIGHT;

            process.stdout.write(`  Point ${point.index + 1}/9 (${screenX.toFixed(0)}, ${screenY.toFixed(0)}): `);

            for (let i = 0; i < SAMPLES_PER_POINT; i++) {
                const eyeLandmarks = generateEyeLandmarks(point.index, i, SAMPLES_PER_POINT);

                const result = await addSample(
                    sessionId,
                    point.index,
                    screenX,
                    screenY,
                    eyeLandmarks
                );

                // Show progress
                if ((i + 1) % 10 === 0) {
                    process.stdout.write(`${i + 1}...`);
                }
            }

            console.log('✓');
        }

        // Complete calibration and train model
        const result = await completeCalibration(sessionId);

        if (result.success) {
            console.log('\n✅ Training completed successfully!\n');
            console.log('📈 Training Results:');
            console.log(`  Quality Score: ${result.quality.score.toFixed(3)}`);
            console.log(`  Total Samples: ${result.quality.totalSamples}`);
            console.log(`  Average Variance: ${result.quality.averageVariance.toFixed(4)}`);
            console.log(`  Training Accuracy: ${result.training.accuracy.toFixed(2)}px`);
            console.log(`  Training Time: ${result.training.trainingTime}ms`);
            console.log(`  Model ID: ${result.modelId}`);

            // Test predictions
            await testPredictions();

            // Get statistics
            await getModelStats();

            console.log('\n🎉 Training complete! Model is ready for use.');
            console.log(`\n💾 Model saved for user: ${USER_ID}`);
            console.log('\nYou can now use this model in your frontend application.');

        } else {
            console.error('\n❌ Training failed:', result.error);
            console.log('\nTroubleshooting:');
            console.log('  - Check if calibration quality is sufficient');
            console.log('  - Ensure all 9 points have enough samples');
            console.log('  - Verify eye landmark data is properly formatted');
        }

    } catch (error) {
        console.error('\n❌ Error during training:', error.message);
        console.log('\nTroubleshooting:');
        console.log('  - Make sure the backend server is running (npm run server)');
        console.log('  - Check if port 4000 is accessible');
        console.log('  - Verify network connectivity');
    }
}

// Run the training
if (require.main === module) {
    trainModel().catch(console.error);
}

module.exports = { trainModel, generateEyeLandmarks };
