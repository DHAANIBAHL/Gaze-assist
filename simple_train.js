/**
 * Simple Training Script - Trains the gaze model step by step
 * This version includes better error handling and debugging
 */

const http = require('http');

const API_BASE = 'http://localhost:4000';
const USER_ID = 'training_user_' + Date.now();

// Helper function to make HTTP requests
function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${parsed.error || data}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

// Generate realistic eye landmarks
function generateEyeLandmarks(gazeX, gazeY) {
    const noise = () => (Math.random() - 0.5) * 0.01;

    return {
        leftEye: {
            centerX: 0.45 + (gazeX - 0.5) * 0.08 + noise(),
            centerY: 0.48 + (gazeY - 0.5) * 0.08 + noise(),
            width: 0.05 + noise(),
            height: 0.03 + noise(),
            aspectRatio: 1.67 + noise() * 0.2
        },
        rightEye: {
            centerX: 0.55 + (gazeX - 0.5) * 0.08 + noise(),
            centerY: 0.48 + (gazeY - 0.5) * 0.08 + noise(),
            width: 0.05 + noise(),
            height: 0.03 + noise(),
            aspectRatio: 1.67 + noise() * 0.2
        },
        headPose: {
            pitch: noise() * 5,
            yaw: noise() * 5,
            roll: noise() * 3
        }
    };
}

async function train() {
    console.log('🚀 Gaze Assist Training Script\n');
    console.log(`User ID: ${USER_ID}\n`);

    try {
        // Step 1: Check backend health
        console.log('1️⃣  Checking backend...');
        const health = await makeRequest('GET', '/health');
        console.log('✅ Backend is healthy\n');

        // Step 2: Create calibration session
        console.log('2️⃣  Creating calibration session...');
        const session = await makeRequest('POST', '/api/calibration/session', { userId: USER_ID });
        console.log(`✅ Session created: ${session.sessionId}\n`);

        // Step 3: Collect calibration data
        console.log('3️⃣  Collecting calibration data...\n');

        const points = [
            { x: 0.1, y: 0.1, name: 'Top-Left' },
            { x: 0.5, y: 0.1, name: 'Top-Center' },
            { x: 0.9, y: 0.1, name: 'Top-Right' },
            { x: 0.1, y: 0.5, name: 'Middle-Left' },
            { x: 0.5, y: 0.5, name: 'Center' },
            { x: 0.9, y: 0.5, name: 'Middle-Right' },
            { x: 0.1, y: 0.9, name: 'Bottom-Left' },
            { x: 0.5, y: 0.9, name: 'Bottom-Center' },
            { x: 0.9, y: 0.9, name: 'Bottom-Right' }
        ];

        const SAMPLES_PER_POINT = 30;
        const SCREEN_WIDTH = 1920;
        const SCREEN_HEIGHT = 1080;

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const screenX = point.x * SCREEN_WIDTH;
            const screenY = point.y * SCREEN_HEIGHT;

            process.stdout.write(`   Point ${i + 1}/9 (${point.name}): `);

            for (let j = 0; j < SAMPLES_PER_POINT; j++) {
                const eyeLandmarks = generateEyeLandmarks(point.x, point.y);

                try {
                    await makeRequest('POST', '/api/calibration/sample', {
                        sessionId: session.sessionId,
                        pointIndex: i,
                        screenX,
                        screenY,
                        eyeLandmarks
                    });

                    if ((j + 1) % 10 === 0) {
                        process.stdout.write(`${j + 1}...`);
                    }
                } catch (error) {
                    console.error(`\n❌ Error adding sample: ${error.message}`);
                    throw error;
                }
            }

            console.log('✓');
        }

        console.log('\n4️⃣  Training model...');
        const result = await makeRequest('POST', '/api/calibration/complete', {
            sessionId: session.sessionId,
            userId: USER_ID
        });

        if (result.success) {
            console.log('✅ Training completed!\n');
            console.log('📊 Results:');
            console.log(`   Quality Score: ${result.quality.score.toFixed(3)}`);
            console.log(`   Total Samples: ${result.quality.totalSamples}`);
            console.log(`   Training Accuracy: ${result.training.accuracy.toFixed(2)}px`);
            console.log(`   Training Time: ${result.training.trainingTime}ms`);
            console.log(`   Model ID: ${result.modelId}\n`);

            // Step 5: Test predictions
            console.log('5️⃣  Testing predictions...\n');

            const testCases = [
                { x: 0.25, y: 0.25, name: 'Quarter Top-Left' },
                { x: 0.75, y: 0.75, name: 'Quarter Bottom-Right' },
                { x: 0.5, y: 0.5, name: 'Center' }
            ];

            let totalError = 0;

            for (const testCase of testCases) {
                const eyeLandmarks = generateEyeLandmarks(testCase.x, testCase.y);
                const prediction = await makeRequest('POST', '/api/predict', {
                    userId: USER_ID,
                    eyeLandmarks
                });

                if (prediction.success) {
                    const expectedX = testCase.x * SCREEN_WIDTH;
                    const expectedY = testCase.y * SCREEN_HEIGHT;
                    const errorX = Math.abs(prediction.prediction.x - expectedX);
                    const errorY = Math.abs(prediction.prediction.y - expectedY);
                    const error = Math.sqrt(errorX * errorX + errorY * errorY);

                    totalError += error;

                    console.log(`   ${testCase.name}:`);
                    console.log(`     Expected: (${expectedX.toFixed(0)}, ${expectedY.toFixed(0)})`);
                    console.log(`     Predicted: (${prediction.prediction.x.toFixed(0)}, ${prediction.prediction.y.toFixed(0)})`);
                    console.log(`     Error: ${error.toFixed(2)}px`);
                    console.log(`     Confidence: ${prediction.prediction.confidence.toFixed(3)}\n`);
                }
            }

            const avgError = totalError / testCases.length;
            console.log(`   Average Test Error: ${avgError.toFixed(2)}px\n`);

            // Step 6: Get model stats
            console.log('6️⃣  Model Statistics:\n');
            const stats = await makeRequest('GET', `/api/stats/${USER_ID}`);

            if (stats.success) {
                console.log(`   Trained: ${stats.stats.trained ? 'Yes' : 'No'}`);
                console.log(`   Training Date: ${new Date(stats.stats.trainingDate).toLocaleString()}`);
                console.log(`   Sample Count: ${stats.stats.sampleCount}`);
                console.log(`   Accuracy: ${stats.stats.accuracy.toFixed(2)}px`);
                console.log(`   Max Error: ${stats.stats.maxError.toFixed(2)}px`);
                console.log(`   Min Error: ${stats.stats.minError.toFixed(2)}px\n`);
            }

            console.log('🎉 Training complete! Model is ready to use.\n');
            console.log(`💾 Model saved for user: ${USER_ID}`);
            console.log('\nYou can now use this model in your frontend application!');

        } else {
            console.error('❌ Training failed:', result.error);
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\nTroubleshooting:');
        console.log('  - Make sure the backend is running: npm run server');
        console.log('  - Check if port 4000 is accessible');
        console.log('  - Review backend logs for errors');
    }
}

// Run training
train();
