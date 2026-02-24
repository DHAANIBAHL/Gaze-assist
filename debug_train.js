/**
 * Debug Image Training Script
 * This version includes detailed error logging to identify the backend issue
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE = 'http://localhost:4000';
const USER_ID = 'debug_user_' + Date.now();
const DATASET_PATH = path.join(__dirname, 'Dataset', 'IRIS + PUPIL + EYE', 'train', 'image');
const SCREEN_WIDTH = 1920;
const SCREEN_HEIGHT = 1080;

function parseFilename(filename) {
    const parts = filename.replace('.png', '').split('_');
    if (parts.length >= 5) {
        return {
            subject: parts[0],
            session: parts[1],
            eye: parts[2],
            condition: parts[3],
            position: parseInt(parts[4]),
            sample: parts[5] ? parseInt(parts[5]) : 0,
            filename
        };
    }
    return null;
}

function mapPositionToCalibrationPoint(position) {
    const posStr = position.toString();
    const firstDigit = parseInt(posStr[0]);
    const secondDigit = parseInt(posStr[1] || '0');

    if (firstDigit === 2) {
        if (secondDigit <= 1) return 0;
        if (secondDigit <= 4) return 1;
        return 2;
    } else if (firstDigit === 3) {
        if (secondDigit <= 1) return 3;
        if (secondDigit <= 4) return 4;
        return 5;
    } else if (firstDigit === 4 || firstDigit === 5) {
        if (secondDigit <= 1) return 6;
        if (secondDigit <= 4) return 7;
        return 8;
    }
    return 4;
}

function getScreenCoordinates(pointIndex) {
    const positions = [
        { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
        { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
        { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }
    ];
    const pos = positions[pointIndex] || positions[4];
    return { x: pos.x * SCREEN_WIDTH, y: pos.y * SCREEN_HEIGHT };
}

function generateEyeLandmarks(pointIndex, sampleNum) {
    const screenPos = getScreenCoordinates(pointIndex);
    const gazeX = screenPos.x / SCREEN_WIDTH;
    const gazeY = screenPos.y / SCREEN_HEIGHT;

    const variation = 0.01;
    const sampleVariation = (sampleNum % 10) / 100 * variation;
    const noise = () => (Math.random() - 0.5) * variation;

    return {
        leftEye: {
            centerX: 0.45 + (gazeX - 0.5) * 0.08 + sampleVariation + noise(),
            centerY: 0.48 + (gazeY - 0.5) * 0.08 + sampleVariation + noise(),
            width: 0.05 + noise() * 0.5,
            height: 0.03 + noise() * 0.5,
            aspectRatio: 1.67 + noise() * 0.2
        },
        rightEye: {
            centerX: 0.55 + (gazeX - 0.5) * 0.08 + sampleVariation + noise(),
            centerY: 0.48 + (gazeY - 0.5) * 0.08 + sampleVariation + noise(),
            width: 0.05 + noise() * 0.5,
            height: 0.03 + noise() * 0.5,
            aspectRatio: 1.67 + noise() * 0.2
        },
        headPose: {
            pitch: noise() * 5,
            yaw: noise() * 5,
            roll: noise() * 3
        }
    };
}

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`\n[DEBUG] Response Status: ${res.statusCode}`);
                console.log(`[DEBUG] Response Body: ${data.substring(0, 500)}`);

                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed, null, 2)}`));
                    }
                } catch (e) {
                    console.error('[DEBUG] Failed to parse JSON:', e.message);
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            console.error('[DEBUG] Request error:', err);
            reject(err);
        });

        if (body) {
            const bodyStr = JSON.stringify(body);
            console.log(`[DEBUG] Request to ${method} ${path}`);
            console.log(`[DEBUG] Body length: ${bodyStr.length} bytes`);
            req.write(bodyStr);
        }

        req.end();
    });
}

async function debugTrain() {
    console.log('🔍 DEBUG: Image Training\n');
    console.log(`User ID: ${USER_ID}`);
    console.log(`Dataset: ${DATASET_PATH}\n`);

    try {
        if (!fs.existsSync(DATASET_PATH)) {
            throw new Error(`Dataset not found: ${DATASET_PATH}`);
        }

        const imageFiles = fs.readdirSync(DATASET_PATH)
            .filter(f => f.endsWith('.png'))
            .map(f => ({ filename: f, metadata: parseFilename(f) }))
            .filter(img => img.metadata !== null);

        console.log(`Found ${imageFiles.length} images\n`);

        // Test 1: Health check
        console.log('TEST 1: Health Check');
        const health = await makeRequest('GET', '/health');
        console.log('✅ Backend healthy\n');

        // Test 2: Create session
        console.log('TEST 2: Create Session');
        const session = await makeRequest('POST', '/api/calibration/session', { userId: USER_ID });
        console.log(`✅ Session: ${session.sessionId}\n`);

        // Test 3: Add a few samples
        console.log('TEST 3: Add Sample Data');
        const byPoint = {};
        for (const img of imageFiles) {
            const point = mapPositionToCalibrationPoint(img.metadata.position);
            if (!byPoint[point]) byPoint[point] = [];
            byPoint[point].push(img);
        }

        // Add 25 samples per point (exceeds minimum of 20)
        let sampleCount = 0;
        for (let point = 0; point < 9; point++) {
            const images = byPoint[point] || [];
            if (images.length === 0) continue;

            const samples = images.slice(0, 25);
            console.log(`  Point ${point}: Adding ${samples.length} samples...`);

            for (const img of samples) {
                const coords = getScreenCoordinates(point);
                const landmarks = generateEyeLandmarks(point, img.metadata.sample);

                try {
                    await makeRequest('POST', '/api/calibration/sample', {
                        sessionId: session.sessionId,
                        pointIndex: point,
                        screenX: coords.x,
                        screenY: coords.y,
                        eyeLandmarks: landmarks
                    });
                    sampleCount++;
                } catch (err) {
                    console.error(`  ❌ Error adding sample: ${err.message}`);
                    throw err;
                }
            }
        }

        console.log(`✅ Added ${sampleCount} samples\n`);

        // Test 4: Get session info
        console.log('TEST 4: Get Session Info');
        try {
            const sessionInfo = await makeRequest('GET', `/api/calibration/session/${session.sessionId}`);
            console.log('Session Info:', JSON.stringify(sessionInfo, null, 2));
        } catch (err) {
            console.error('⚠️  Could not get session info:', err.message);
        }

        // Test 5: Complete calibration
        console.log('\nTEST 5: Complete Calibration (This is where it fails)');
        console.log('Sending request to /api/calibration/complete...\n');

        try {
            const result = await makeRequest('POST', '/api/calibration/complete', {
                sessionId: session.sessionId,
                userId: USER_ID
            });

            console.log('\n✅ SUCCESS! Training completed!');
            console.log('Result:', JSON.stringify(result, null, 2));

        } catch (err) {
            console.error('\n❌ FAILED at completion step');
            console.error('Error:', err.message);
            console.error('\nThis is the error we need to fix!');
            throw err;
        }

    } catch (error) {
        console.error('\n💥 Error:', error.message);
        console.error('\nStack:', error.stack);
    }
}

debugTrain();
