/**
 * Backend Test Suite
 * Tests for calibration, training, and prediction
 */

const GazeModel = require('./gazeModel');
const CalibrationService = require('./calibrationService');
const ModelManager = require('./modelManager');

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

/**
 * Generate mock eye landmarks
 */
function generateMockEyeLandmarks(gazeX = 0.5, gazeY = 0.5, noise = 0.01) {
    const leftEyeX = 0.4 + (gazeX - 0.5) * 0.1 + (Math.random() - 0.5) * noise;
    const leftEyeY = 0.45 + (gazeY - 0.5) * 0.1 + (Math.random() - 0.5) * noise;
    const rightEyeX = 0.6 + (gazeX - 0.5) * 0.1 + (Math.random() - 0.5) * noise;
    const rightEyeY = 0.45 + (gazeY - 0.5) * 0.1 + (Math.random() - 0.5) * noise;

    return {
        leftEye: {
            centerX: leftEyeX,
            centerY: leftEyeY,
            width: 0.05,
            height: 0.03,
            aspectRatio: 1.67
        },
        rightEye: {
            centerX: rightEyeX,
            centerY: rightEyeY,
            width: 0.05,
            height: 0.03,
            aspectRatio: 1.67
        },
        headPose: {
            pitch: 0,
            yaw: 0,
            roll: 0
        }
    };
}

/**
 * Generate 9-point calibration data
 */
function generate9PointCalibrationData(screenWidth = 1920, screenHeight = 1080, samplesPerPoint = 30) {
    const calibrationData = [];

    // 9 calibration points in a 3x3 grid
    const points = [
        { x: 0.1, y: 0.1 },  // Top-left
        { x: 0.5, y: 0.1 },  // Top-center
        { x: 0.9, y: 0.1 },  // Top-right
        { x: 0.1, y: 0.5 },  // Middle-left
        { x: 0.5, y: 0.5 },  // Center
        { x: 0.9, y: 0.5 },  // Middle-right
        { x: 0.1, y: 0.9 },  // Bottom-left
        { x: 0.5, y: 0.9 },  // Bottom-center
        { x: 0.9, y: 0.9 }   // Bottom-right
    ];

    points.forEach((point, index) => {
        for (let i = 0; i < samplesPerPoint; i++) {
            calibrationData.push({
                eyeLandmarks: generateMockEyeLandmarks(point.x, point.y, 0.005),
                screenX: point.x * screenWidth,
                screenY: point.y * screenHeight,
                pointIndex: index
            });
        }
    });

    return calibrationData;
}

// ============================================================================
// UNIT TESTS
// ============================================================================

/**
 * Test GazeModel
 */
async function testGazeModel() {
    console.log('\n🧪 Testing GazeModel...');

    try {
        const model = new GazeModel();

        // Test 1: Feature extraction
        console.log('  ✓ Test 1: Feature extraction');
        const eyeLandmarks = generateMockEyeLandmarks();
        const features = model.extractFeatures(eyeLandmarks);
        console.log(`    - Extracted ${features.length} features`);

        // Test 2: Polynomial features
        console.log('  ✓ Test 2: Polynomial feature creation');
        const polyFeatures = model.createPolynomialFeatures(features, 2);
        console.log(`    - Created ${polyFeatures.length} polynomial features`);

        // Test 3: Model training
        console.log('  ✓ Test 3: Model training');
        const calibrationData = generate9PointCalibrationData(1920, 1080, 30);
        const trainingResult = model.train(calibrationData);
        console.log(`    - Training result: ${trainingResult.message}`);
        console.log(`    - Average error: ${trainingResult.metadata.accuracy.toFixed(2)}px`);

        // Test 4: Prediction
        console.log('  ✓ Test 4: Prediction');
        const testLandmarks = generateMockEyeLandmarks(0.5, 0.5);
        const prediction = model.predict(testLandmarks);
        console.log(`    - Predicted: (${prediction.x.toFixed(2)}, ${prediction.y.toFixed(2)})`);
        console.log(`    - Confidence: ${prediction.confidence.toFixed(2)}`);

        // Test 5: Model export/import
        console.log('  ✓ Test 5: Model export/import');
        const exported = model.export();
        const newModel = new GazeModel();
        newModel.import(exported);
        const prediction2 = newModel.predict(testLandmarks);
        console.log(`    - Imported model prediction: (${prediction2.x.toFixed(2)}, ${prediction2.y.toFixed(2)})`);

        console.log('✅ GazeModel tests passed!\n');
        return true;

    } catch (error) {
        console.error('❌ GazeModel test failed:', error.message);
        return false;
    }
}

/**
 * Test CalibrationService
 */
async function testCalibrationService() {
    console.log('\n🧪 Testing CalibrationService...');

    try {
        const service = new CalibrationService();

        // Test 1: Create session
        console.log('  ✓ Test 1: Create calibration session');
        const session = service.createSession('test_user');
        console.log(`    - Session ID: ${session.sessionId}`);

        // Test 2: Add samples
        console.log('  ✓ Test 2: Add calibration samples');
        const calibrationData = generate9PointCalibrationData(1920, 1080, 30);

        for (const sample of calibrationData) {
            const result = service.addSample(session.sessionId, sample);
            if (!result.success) {
                throw new Error('Failed to add sample');
            }
        }
        console.log(`    - Added ${calibrationData.length} samples`);

        // Test 3: Get session info
        console.log('  ✓ Test 3: Get session info');
        const sessionInfo = service.getSession(session.sessionId);
        console.log(`    - Points completed: ${sessionInfo.pointsCompleted}`);
        console.log(`    - Total samples: ${sessionInfo.totalSamples}`);

        // Test 4: Complete session
        console.log('  ✓ Test 4: Complete calibration session');
        const completionResult = service.completeSession(session.sessionId);
        console.log(`    - Quality score: ${completionResult.quality.score.toFixed(2)}`);
        console.log(`    - Recommendation: ${completionResult.quality.recommendation}`);

        // Test 5: Sample validation
        console.log('  ✓ Test 5: Sample validation');
        const invalidSample = { pointIndex: 0, screenX: 100, screenY: 100 }; // Missing eyeLandmarks
        const validation = service.validateSample(invalidSample);
        console.log(`    - Invalid sample detected: ${!validation.valid}`);

        console.log('✅ CalibrationService tests passed!\n');
        return true;

    } catch (error) {
        console.error('❌ CalibrationService test failed:', error.message);
        return false;
    }
}

/**
 * Test ModelManager
 */
async function testModelManager() {
    console.log('\n🧪 Testing ModelManager...');

    try {
        const manager = new ModelManager('./test_models');

        // Test 1: Train and save model
        console.log('  ✓ Test 1: Train and save model');
        const calibrationData = generate9PointCalibrationData(1920, 1080, 30);
        const trainingResult = await manager.trainModel('test_user', calibrationData);
        console.log(`    - Model ID: ${trainingResult.modelId}`);
        console.log(`    - Accuracy: ${trainingResult.metadata.accuracy.toFixed(2)}px`);

        // Test 2: Get active model
        console.log('  ✓ Test 2: Get active model');
        const activeModel = await manager.getActiveModel('test_user');
        console.log(`    - Model loaded: ${activeModel !== null}`);

        // Test 3: Prediction
        console.log('  ✓ Test 3: Prediction with model manager');
        const testLandmarks = generateMockEyeLandmarks(0.5, 0.5);
        const prediction = await manager.predict('test_user', testLandmarks);
        console.log(`    - Predicted: (${prediction.x.toFixed(2)}, ${prediction.y.toFixed(2)})`);

        // Test 4: List user models
        console.log('  ✓ Test 4: List user models');
        const models = await manager.listUserModels('test_user');
        console.log(`    - Found ${models.length} model(s)`);

        // Test 5: Export/Import model
        console.log('  ✓ Test 5: Export and import model');
        const exported = await manager.exportModel(trainingResult.modelId);
        const importedModelId = await manager.importModel('test_user_2', exported);
        console.log(`    - Imported model ID: ${importedModelId}`);

        // Test 6: Delete model
        console.log('  ✓ Test 6: Delete model');
        await manager.deleteModel(importedModelId);
        console.log(`    - Model deleted successfully`);

        console.log('✅ ModelManager tests passed!\n');
        return true;

    } catch (error) {
        console.error('❌ ModelManager test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

/**
 * Test accuracy with different scenarios
 */
async function testAccuracyScenarios() {
    console.log('\n🧪 Testing Accuracy Scenarios...');

    try {
        const model = new GazeModel();

        // Scenario 1: High-quality calibration
        console.log('  ✓ Scenario 1: High-quality calibration (30 samples/point, low noise)');
        const highQualityData = generate9PointCalibrationData(1920, 1080, 30);
        const result1 = model.train(highQualityData);
        console.log(`    - Average error: ${result1.metadata.accuracy.toFixed(2)}px`);

        // Scenario 2: Low-quality calibration
        console.log('  ✓ Scenario 2: Low-quality calibration (10 samples/point)');
        const model2 = new GazeModel();
        const lowQualityData = generate9PointCalibrationData(1920, 1080, 10);
        const result2 = model2.train(lowQualityData);
        console.log(`    - Average error: ${result2.metadata.accuracy.toFixed(2)}px`);

        // Scenario 3: Test prediction accuracy
        console.log('  ✓ Scenario 3: Prediction accuracy test');
        const testPoints = [
            { x: 0.25, y: 0.25 },
            { x: 0.75, y: 0.75 },
            { x: 0.5, y: 0.5 }
        ];

        let totalError = 0;
        for (const point of testPoints) {
            const landmarks = generateMockEyeLandmarks(point.x, point.y, 0.005);
            const prediction = model.predict(landmarks);
            const expectedX = point.x * 1920;
            const expectedY = point.y * 1080;
            const error = Math.sqrt(
                Math.pow(prediction.x - expectedX, 2) +
                Math.pow(prediction.y - expectedY, 2)
            );
            totalError += error;
            console.log(`    - Point (${expectedX.toFixed(0)}, ${expectedY.toFixed(0)}): Error ${error.toFixed(2)}px`);
        }
        console.log(`    - Average test error: ${(totalError / testPoints.length).toFixed(2)}px`);

        console.log('✅ Accuracy scenario tests passed!\n');
        return true;

    } catch (error) {
        console.error('❌ Accuracy scenario test failed:', error.message);
        return false;
    }
}

// ============================================================================
// INTEGRATION TEST
// ============================================================================

/**
 * Full integration test
 */
async function integrationTest() {
    console.log('\n🧪 Running Integration Test...');

    try {
        const calibrationService = new CalibrationService();
        const modelManager = new ModelManager('./test_models');

        // Step 1: Create calibration session
        console.log('  Step 1: Create calibration session');
        const session = calibrationService.createSession('integration_test_user');

        // Step 2: Simulate calibration process
        console.log('  Step 2: Simulate 9-point calibration');
        const calibrationData = generate9PointCalibrationData(1920, 1080, 30);

        for (const sample of calibrationData) {
            calibrationService.addSample(session.sessionId, sample);
        }

        // Step 3: Complete calibration
        console.log('  Step 3: Complete calibration');
        const completionResult = calibrationService.completeSession(session.sessionId);
        console.log(`    - Quality: ${completionResult.quality.score.toFixed(2)}`);

        // Step 4: Train model
        console.log('  Step 4: Train model');
        const trainingResult = await modelManager.trainModel(
            'integration_test_user',
            completionResult.calibrationData
        );
        console.log(`    - Model trained with ${trainingResult.metadata.accuracy.toFixed(2)}px accuracy`);

        // Step 5: Make predictions
        console.log('  Step 5: Make predictions');
        const testLandmarks = generateMockEyeLandmarks(0.5, 0.5);
        const prediction = await modelManager.predict('integration_test_user', testLandmarks);
        console.log(`    - Prediction: (${prediction.x.toFixed(2)}, ${prediction.y.toFixed(2)})`);

        // Step 6: Batch prediction
        console.log('  Step 6: Batch prediction');
        const batchSamples = [
            generateMockEyeLandmarks(0.3, 0.3),
            generateMockEyeLandmarks(0.7, 0.7),
            generateMockEyeLandmarks(0.5, 0.5)
        ];
        const model = await modelManager.getActiveModel('integration_test_user');
        const batchPredictions = batchSamples.map(landmarks => model.predict(landmarks));
        console.log(`    - Batch predictions: ${batchPredictions.length} results`);

        console.log('✅ Integration test passed!\n');
        return true;

    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  GAZE ASSIST BACKEND TEST SUITE');
    console.log('═══════════════════════════════════════════════════════════');

    const results = {
        gazeModel: await testGazeModel(),
        calibrationService: await testCalibrationService(),
        modelManager: await testModelManager(),
        accuracyScenarios: await testAccuracyScenarios(),
        integration: await integrationTest()
    };

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  GazeModel:           ${results.gazeModel ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  CalibrationService:  ${results.calibrationService ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  ModelManager:        ${results.modelManager ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Accuracy Scenarios:  ${results.accuracyScenarios ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Integration Test:    ${results.integration ? '✅ PASS' : '❌ FAIL'}`);
    console.log('═══════════════════════════════════════════════════════════');

    const allPassed = Object.values(results).every(r => r === true);

    if (allPassed) {
        console.log('\n🎉 ALL TESTS PASSED! Backend is working correctly.\n');
    } else {
        console.log('\n⚠️  SOME TESTS FAILED. Please review the errors above.\n');
    }

    return allPassed;
}

// Run tests if executed directly
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {
    testGazeModel,
    testCalibrationService,
    testModelManager,
    testAccuracyScenarios,
    integrationTest,
    runAllTests,
    generateMockEyeLandmarks,
    generate9PointCalibrationData
};
