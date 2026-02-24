/**
 * Simple backend test
 */

const GazeModel = require('./gazeModel');

console.log('Testing GazeModel...');

try {
    const model = new GazeModel();
    console.log('✓ GazeModel instantiated');

    // Test feature extraction
    const eyeLandmarks = {
        leftEye: {
            centerX: 0.4,
            centerY: 0.45,
            width: 0.05,
            height: 0.03,
            aspectRatio: 1.67
        },
        rightEye: {
            centerX: 0.6,
            centerY: 0.45,
            width: 0.05,
            height: 0.03,
            aspectRatio: 1.67
        }
    };

    const features = model.extractFeatures(eyeLandmarks);
    console.log(`✓ Extracted ${features.length} features`);

    console.log('\n✅ Basic test passed!');
} catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
}
