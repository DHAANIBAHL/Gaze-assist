/**
 * Model Manager
 * Handles model persistence, versioning, and user-specific models
 */

const fs = require('fs').promises;
const path = require('path');
const GazeModel = require('./gazeModel');

class ModelManager {
    constructor(modelsDirectory = './models') {
        this.modelsDirectory = modelsDirectory;
        this.activeModels = new Map(); // userId -> GazeModel instance
        this.modelCache = new Map(); // modelId -> model data
        this.ensureModelsDirectory();
    }

    /**
     * Ensure models directory exists
     */
    async ensureModelsDirectory() {
        try {
            await fs.mkdir(this.modelsDirectory, { recursive: true });
        } catch (error) {
            console.error('Error creating models directory:', error);
        }
    }

    /**
     * Train and save a new model
     * @param {String} userId - User identifier
     * @param {Array} calibrationData - Training data
     * @returns {Object} Training result
     */
    async trainModel(userId, calibrationData) {
        try {
            // Create new model instance
            const model = new GazeModel();

            // Train the model
            const trainingResult = model.train(calibrationData);

            if (!trainingResult.success) {
                throw new Error('Model training failed');
            }

            // Save model
            const modelId = await this.saveModel(userId, model);

            // Set as active model for user
            this.activeModels.set(userId, model);

            return {
                success: true,
                modelId: modelId,
                metadata: trainingResult.metadata,
                message: trainingResult.message
            };

        } catch (error) {
            throw new Error(`Model training failed: ${error.message}`);
        }
    }

    /**
     * Save model to disk
     * @param {String} userId - User identifier
     * @param {GazeModel} model - Model instance
     * @returns {String} Model ID
     */
    async saveModel(userId, model) {
        try {
            const modelId = this.generateModelId(userId);
            const modelData = {
                id: modelId,
                userId: userId,
                ...model.export(),
                savedAt: new Date().toISOString()
            };

            const filename = `${modelId}.json`;
            const filepath = path.join(this.modelsDirectory, filename);

            await fs.writeFile(filepath, JSON.stringify(modelData, null, 2));

            // Update cache
            this.modelCache.set(modelId, modelData);

            // Save user's latest model reference
            await this.saveUserModelReference(userId, modelId);

            return modelId;

        } catch (error) {
            throw new Error(`Failed to save model: ${error.message}`);
        }
    }

    /**
     * Load model from disk
     * @param {String} modelId - Model identifier
     * @returns {GazeModel} Model instance
     */
    async loadModel(modelId) {
        try {
            // Check cache first
            if (this.modelCache.has(modelId)) {
                const modelData = this.modelCache.get(modelId);
                const model = new GazeModel();
                model.import(modelData);
                return model;
            }

            // Load from disk
            const filename = `${modelId}.json`;
            const filepath = path.join(this.modelsDirectory, filename);

            const data = await fs.readFile(filepath, 'utf8');
            const modelData = JSON.parse(data);

            const model = new GazeModel();
            model.import(modelData);

            // Update cache
            this.modelCache.set(modelId, modelData);

            return model;

        } catch (error) {
            throw new Error(`Failed to load model: ${error.message}`);
        }
    }

    /**
     * Get active model for user
     * @param {String} userId - User identifier
     * @returns {GazeModel} Model instance or null
     */
    async getActiveModel(userId) {
        // Check if model is already loaded
        if (this.activeModels.has(userId)) {
            return this.activeModels.get(userId);
        }

        // Try to load user's latest model
        try {
            const modelId = await this.getUserLatestModelId(userId);
            if (modelId) {
                const model = await this.loadModel(modelId);
                this.activeModels.set(userId, model);
                return model;
            }
        } catch (error) {
            console.error('Error loading user model:', error);
        }

        return null;
    }

    /**
     * Predict using user's active model
     * @param {String} userId - User identifier
     * @param {Object} eyeLandmarks - Eye landmarks
     * @returns {Object} Prediction result
     */
    async predict(userId, eyeLandmarks) {
        const model = await this.getActiveModel(userId);

        if (!model) {
            throw new Error('No trained model found for user. Please calibrate first.');
        }

        return model.predict(eyeLandmarks);
    }

    /**
     * Save reference to user's latest model
     * @param {String} userId - User identifier
     * @param {String} modelId - Model identifier
     */
    async saveUserModelReference(userId, modelId) {
        try {
            const refFile = path.join(this.modelsDirectory, `user_${userId}_latest.txt`);
            await fs.writeFile(refFile, modelId);
        } catch (error) {
            console.error('Error saving user model reference:', error);
        }
    }

    /**
     * Get user's latest model ID
     * @param {String} userId - User identifier
     * @returns {String|null} Model ID or null
     */
    async getUserLatestModelId(userId) {
        try {
            const refFile = path.join(this.modelsDirectory, `user_${userId}_latest.txt`);
            const modelId = await fs.readFile(refFile, 'utf8');
            return modelId.trim();
        } catch (error) {
            return null;
        }
    }

    /**
     * List all models for a user
     * @param {String} userId - User identifier
     * @returns {Array} List of model metadata
     */
    async listUserModels(userId) {
        try {
            const files = await fs.readdir(this.modelsDirectory);
            const modelFiles = files.filter(f => f.startsWith(`model_${userId}_`) && f.endsWith('.json'));

            const models = [];
            for (const file of modelFiles) {
                try {
                    const filepath = path.join(this.modelsDirectory, file);
                    const data = await fs.readFile(filepath, 'utf8');
                    const modelData = JSON.parse(data);

                    models.push({
                        id: modelData.id,
                        savedAt: modelData.savedAt,
                        metadata: modelData.metadata
                    });
                } catch (error) {
                    console.error(`Error reading model file ${file}:`, error);
                }
            }

            // Sort by date, newest first
            models.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

            return models;

        } catch (error) {
            throw new Error(`Failed to list models: ${error.message}`);
        }
    }

    /**
     * Delete a model
     * @param {String} modelId - Model identifier
     */
    async deleteModel(modelId) {
        try {
            const filename = `${modelId}.json`;
            const filepath = path.join(this.modelsDirectory, filename);
            await fs.unlink(filepath);

            // Remove from cache
            this.modelCache.delete(modelId);

            // Remove from active models if loaded
            for (const [userId, model] of this.activeModels.entries()) {
                const exportedModel = model.export();
                if (exportedModel.metadata && exportedModel.metadata.modelId === modelId) {
                    this.activeModels.delete(userId);
                }
            }

        } catch (error) {
            throw new Error(`Failed to delete model: ${error.message}`);
        }
    }

    /**
     * Get model metadata
     * @param {String} modelId - Model identifier
     * @returns {Object} Model metadata
     */
    async getModelMetadata(modelId) {
        try {
            const filename = `${modelId}.json`;
            const filepath = path.join(this.modelsDirectory, filename);

            const data = await fs.readFile(filepath, 'utf8');
            const modelData = JSON.parse(data);

            return {
                id: modelData.id,
                userId: modelData.userId,
                metadata: modelData.metadata,
                savedAt: modelData.savedAt
            };

        } catch (error) {
            throw new Error(`Failed to get model metadata: ${error.message}`);
        }
    }

    /**
     * Clean up old models (keep only last 5 per user)
     */
    async cleanupOldModels() {
        try {
            const files = await fs.readdir(this.modelsDirectory);
            const modelFiles = files.filter(f => f.startsWith('model_') && f.endsWith('.json'));

            // Group by user
            const userModels = new Map();
            for (const file of modelFiles) {
                const match = file.match(/^model_(.+?)_/);
                if (match) {
                    const userId = match[1];
                    if (!userModels.has(userId)) {
                        userModels.set(userId, []);
                    }
                    userModels.get(userId).push(file);
                }
            }

            // Delete old models for each user
            for (const [userId, files] of userModels.entries()) {
                if (files.length > 5) {
                    // Get file stats and sort by modification time
                    const fileStats = await Promise.all(
                        files.map(async (file) => {
                            const filepath = path.join(this.modelsDirectory, file);
                            const stats = await fs.stat(filepath);
                            return { file, mtime: stats.mtime };
                        })
                    );

                    fileStats.sort((a, b) => b.mtime - a.mtime);

                    // Delete oldest models
                    const toDelete = fileStats.slice(5);
                    for (const { file } of toDelete) {
                        const filepath = path.join(this.modelsDirectory, file);
                        await fs.unlink(filepath);
                        console.log(`Deleted old model: ${file}`);
                    }
                }
            }

        } catch (error) {
            console.error('Error cleaning up old models:', error);
        }
    }

    /**
     * Generate unique model ID
     * @param {String} userId - User identifier
     * @returns {String} Model ID
     */
    generateModelId(userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `model_${userId}_${timestamp}_${random}`;
    }

    /**
     * Export model for download
     * @param {String} modelId - Model identifier
     * @returns {Object} Model data
     */
    async exportModel(modelId) {
        try {
            const filename = `${modelId}.json`;
            const filepath = path.join(this.modelsDirectory, filename);

            const data = await fs.readFile(filepath, 'utf8');
            return JSON.parse(data);

        } catch (error) {
            throw new Error(`Failed to export model: ${error.message}`);
        }
    }

    /**
     * Import model from upload
     * @param {String} userId - User identifier
     * @param {Object} modelData - Model data
     * @returns {String} Model ID
     */
    async importModel(userId, modelData) {
        try {
            // Validate model data
            if (!modelData.coefficientsX || !modelData.coefficientsY) {
                throw new Error('Invalid model data');
            }

            // Create model instance and import
            const model = new GazeModel();
            model.import(modelData);

            // Save as new model
            const modelId = await this.saveModel(userId, model);

            return modelId;

        } catch (error) {
            throw new Error(`Failed to import model: ${error.message}`);
        }
    }
}

module.exports = ModelManager;
