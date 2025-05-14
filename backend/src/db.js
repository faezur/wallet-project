const mongoose = require('mongoose');
const config = require('./config');
const { logger } = require('./utils');

class Database {
    constructor() {
        this.maxRetries = 5;
        this.retryInterval = 5000; // 5 seconds
        this.connected = false;
    }

    async connect() {
        let retries = 0;

        while (retries < this.maxRetries && !this.connected) {
            try {
                if (retries > 0) {
                    logger.info(`MongoDB connection attempt ${retries + 1} of ${this.maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, this.retryInterval));
                }

                await mongoose.connect(config.mongodb.uri);
                
                this.connected = true;
                logger.info('Successfully connected to MongoDB');

                // Create indexes
                await this.createIndexes();

                return true;
            } catch (error) {
                retries++;
                logger.error(`MongoDB connection attempt ${retries} failed:`, error);

                if (retries === this.maxRetries) {
                    logger.error('Failed to connect to MongoDB after maximum retries');
                    throw error;
                }
            }
        }
    }

    async createIndexes() {
        try {
            const models = mongoose.connection.models;
            for (const modelName in models) {
                const model = models[modelName];
                if (model.createIndexes) {
                    await model.createIndexes();
                    logger.info(`Created indexes for model: ${modelName}`);
                }
            }
        } catch (error) {
            logger.error('Error creating indexes:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await mongoose.disconnect();
            this.connected = false;
            logger.info('Disconnected from MongoDB');
        } catch (error) {
            logger.error('Error disconnecting from MongoDB:', error);
            throw error;
        }
    }

    async healthCheck() {
        try {
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.db.admin().ping();
                return true;
            }
            return false;
        } catch (error) {
            logger.error('MongoDB health check failed:', error);
            return false;
        }
    }
}

module.exports = new Database();
