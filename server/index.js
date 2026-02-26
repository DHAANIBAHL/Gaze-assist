require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const CalibrationService = require('./calibrationService');
const ModelManager = require('./modelManager');

const app = express();
const port = process.env.API_PORT || process.env.PORT || 4000;

// Initialize services
const calibrationService = new CalibrationService();
const modelManager = new ModelManager('./models');

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' })); // Increased limit for calibration data

// Configure PostgreSQL connection (optional - for persistent storage)
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
}

// Cleanup old sessions every hour
setInterval(() => {
  calibrationService.cleanupOldSessions();
  modelManager.cleanupOldModels();
}, 3600000);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      calibration: 'active',
      modelManager: 'active',
      database: pool ? 'connected' : 'not configured'
    }
  });
});

// ============================================================================
// CALIBRATION ENDPOINTS
// ============================================================================

/**
 * Create new calibration session
 * POST /api/calibration/session
 * Body: { userId?: string }
 */
app.post('/api/calibration/session', (req, res) => {
  try {
    const { userId } = req.body;
    const result = calibrationService.createSession(userId || 'anonymous');
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating calibration session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add calibration sample to session
 * POST /api/calibration/sample
 * Body: { sessionId, pointIndex, screenX, screenY, eyeLandmarks }
 */
app.post('/api/calibration/sample', (req, res) => {
  try {
    const { sessionId, pointIndex, screenX, screenY, eyeLandmarks } = req.body;

    if (!sessionId || typeof pointIndex !== 'number' || !eyeLandmarks) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sample = { pointIndex, screenX, screenY, eyeLandmarks };
    const result = calibrationService.addSample(sessionId, sample);

    res.json(result);
  } catch (error) {
    console.error('Error adding calibration sample:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Complete calibration and train model
 * POST /api/calibration/complete
 * Body: { sessionId, userId }
 */
app.post('/api/calibration/complete', async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Complete calibration session
    const calibrationResult = calibrationService.completeSession(sessionId);

    if (!calibrationResult.success) {
      return res.status(400).json(calibrationResult);
    }

    // Train model with calibration data
    const trainingResult = await modelManager.trainModel(
      userId || 'anonymous',
      calibrationResult.calibrationData
    );

    // Optionally save to database
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO calibration_sessions (user_id, calibration_data, calibration_model, quality_score)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [
            userId || null,
            JSON.stringify(calibrationResult.calibrationData),
            JSON.stringify(trainingResult.metadata),
            calibrationResult.quality.score
          ]
        );
      } catch (dbError) {
        console.error('Database save error (non-critical):', dbError);
      }
    }

    res.json({
      success: true,
      sessionId: sessionId,
      modelId: trainingResult.modelId,
      quality: calibrationResult.quality,
      training: trainingResult.metadata,
      sessionMetadata: calibrationResult.metadata,
      message: 'Calibration completed and model trained successfully'
    });

  } catch (error) {
    console.error('Error completing calibration:', error);
    console.error(error.stack); // Print full stack trace
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

/**
 * Get calibration session info
 * GET /api/calibration/session/:sessionId
 */
app.get('/api/calibration/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = calibrationService.getSession(sessionId);
    res.json(session);
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(404).json({ error: error.message });
  }
});

// ============================================================================
// PREDICTION ENDPOINTS
// ============================================================================

/**
 * Predict gaze coordinates
 * POST /api/predict
 * Body: { userId, eyeLandmarks }
 */
app.post('/api/predict', async (req, res) => {
  try {
    const { userId, eyeLandmarks } = req.body;

    if (!eyeLandmarks) {
      return res.status(400).json({ error: 'Eye landmarks required' });
    }

    const prediction = await modelManager.predict(userId || 'anonymous', eyeLandmarks);

    res.json({
      success: true,
      prediction: prediction,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error predicting gaze:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Batch predict (for performance)
 * POST /api/predict/batch
 * Body: { userId, samples: [eyeLandmarks, ...] }
 */
app.post('/api/predict/batch', async (req, res) => {
  try {
    const { userId, samples } = req.body;

    if (!samples || !Array.isArray(samples)) {
      return res.status(400).json({ error: 'Samples array required' });
    }

    const model = await modelManager.getActiveModel(userId || 'anonymous');
    if (!model) {
      return res.status(400).json({ error: 'No trained model found. Please calibrate first.' });
    }

    const predictions = samples.map(eyeLandmarks => {
      try {
        return model.predict(eyeLandmarks);
      } catch (error) {
        return { error: error.message };
      }
    });

    res.json({
      success: true,
      predictions: predictions,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error in batch prediction:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// MODEL MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Get user's active model info
 * GET /api/model/:userId
 */
app.get('/api/model/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const model = await modelManager.getActiveModel(userId);

    if (!model) {
      return res.status(404).json({ error: 'No model found for user' });
    }

    const modelData = model.export();
    res.json({
      success: true,
      metadata: modelData.metadata,
      hasTrained: modelData.metadata.trained
    });

  } catch (error) {
    console.error('Error getting model:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * List all models for a user
 * GET /api/models/:userId
 */
app.get('/api/models/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const models = await modelManager.listUserModels(userId);
    res.json({ success: true, models: models });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a model
 * DELETE /api/model/:modelId
 */
app.delete('/api/model/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    await modelManager.deleteModel(modelId);
    res.json({ success: true, message: 'Model deleted' });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export model
 * GET /api/model/:modelId/export
 */
app.get('/api/model/:modelId/export', async (req, res) => {
  try {
    const { modelId } = req.params;
    const modelData = await modelManager.exportModel(modelId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${modelId}.json"`);
    res.json(modelData);

  } catch (error) {
    console.error('Error exporting model:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Import model
 * POST /api/model/import
 * Body: { userId, modelData }
 */
app.post('/api/model/import', async (req, res) => {
  try {
    const { userId, modelData } = req.body;

    if (!userId || !modelData) {
      return res.status(400).json({ error: 'User ID and model data required' });
    }

    const modelId = await modelManager.importModel(userId, modelData);

    res.json({
      success: true,
      modelId: modelId,
      message: 'Model imported successfully'
    });

  } catch (error) {
    console.error('Error importing model:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

/**
 * Get model statistics
 * GET /api/stats/:userId
 */
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const model = await modelManager.getActiveModel(userId);

    if (!model) {
      return res.status(404).json({ error: 'No model found' });
    }

    const modelData = model.export();

    res.json({
      success: true,
      stats: {
        trained: modelData.metadata.trained,
        trainingDate: modelData.metadata.trainingDate,
        sampleCount: modelData.metadata.sampleCount,
        accuracy: modelData.metadata.accuracy,
        maxError: modelData.metadata.maxError,
        minError: modelData.metadata.minError
      }
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// LEGACY ENDPOINT (for backward compatibility)
// ============================================================================

app.post('/api/calibration', async (req, res) => {
  try {
    const { userId, calibrationData, calibrationModel } = req.body;

    if (!calibrationData || !calibrationModel) {
      return res.status(400).send('Missing calibrationData or calibrationModel');
    }

    if (pool) {
      const result = await pool.query(
        `INSERT INTO calibration_sessions (user_id, calibration_data, calibration_model)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId || null, calibrationData, calibrationModel]
      );
      res.status(201).json({ id: result.rows[0].id });
    } else {
      res.status(201).json({
        id: Date.now(),
        message: 'Saved in memory (database not configured)'
      });
    }
  } catch (err) {
    console.error('Error saving calibration:', err);
    res.status(500).send('Failed to save calibration');
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(port, () => {
  console.log(`\n🚀 Gaze Assist Backend Server`);
  console.log(`📡 API listening on port ${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`📊 Database: ${pool ? 'Connected' : 'Not configured (using in-memory storage)'}`);
  console.log(`\n📚 Available Endpoints:`);
  console.log(`   POST   /api/calibration/session      - Create calibration session`);
  console.log(`   POST   /api/calibration/sample       - Add calibration sample`);
  console.log(`   POST   /api/calibration/complete     - Complete calibration & train`);
  console.log(`   POST   /api/predict                  - Predict gaze coordinates`);
  console.log(`   POST   /api/predict/batch            - Batch prediction`);
  console.log(`   GET    /api/model/:userId            - Get user's model info`);
  console.log(`   GET    /api/models/:userId           - List user's models`);
  console.log(`   GET    /api/stats/:userId            - Get model statistics`);
  console.log(`\n✨ Ready for gaze tracking!\n`);
});
