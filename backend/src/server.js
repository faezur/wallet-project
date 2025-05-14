const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { logger, formatResponse, asyncHandler } = require('./utils');
const config = require('./config');
const TokenService = require('./services/tokenService');
const WebSocketService = require('./services/websocketService');
const { authMiddleware, adminOnly } = require('./middleware/auth');
const { 
    validateTokenInjection, 
    validatePriceUpdate, 
    validateTokenBurn,
    validateTokenTransfer 
} = require('./middleware/validation');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize services
const tokenService = new TokenService();
const webSocketService = new WebSocketService(wss, tokenService);

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(config.mongodb.uri, config.mongodb.options)
    .then(() => {
        logger.info('Connected to MongoDB successfully');
    })
    .catch((error) => {
        logger.error('MongoDB connection error:', error);
        process.exit(1);
    });

// Health check endpoint
app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
    
    res.json(formatResponse(true, {
        status: 'ok',
        mongodb: dbStatus,
        uptime: process.uptime()
    }));
});

// Token injection endpoint
app.post('/api/token/inject',
    authMiddleware,
    adminOnly,
    validateTokenInjection,
    asyncHandler(async (req, res) => {
        const result = await tokenService.injectToken(req.body);
        res.json(formatResponse(true, result));
    })
);

// Set forced price endpoint
app.post('/api/token/set-price',
    authMiddleware,
    adminOnly,
    validatePriceUpdate,
    asyncHandler(async (req, res) => {
        const result = await tokenService.setTokenPrice(req.body);
        res.json(formatResponse(true, result));
    })
);

// Burn token endpoint
app.post('/api/token/burn',
    authMiddleware,
    adminOnly,
    validateTokenBurn,
    asyncHandler(async (req, res) => {
        const result = await tokenService.burnToken(req.body);
        res.json(formatResponse(true, result));
    })
);

// Transfer token endpoint
app.post('/api/token/transfer',
    authMiddleware,
    validateTokenTransfer,
    asyncHandler(async (req, res) => {
        const result = await tokenService.transferToken(req.body);
        res.json(formatResponse(true, result));
    })
);

// Get wallet tokens endpoint
app.get('/api/wallet/:walletId/tokens',
    authMiddleware,
    asyncHandler(async (req, res) => {
        const tokens = await tokenService.getWalletTokens(req.params.walletId);
        res.json(formatResponse(true, tokens));
    })
);

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    logger.info('New WebSocket connection established');
    webSocketService.handleConnection(ws, req);
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Error:', err);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    
    res.status(statusCode).json(formatResponse(false, null, message));
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server
const PORT = config.port || 3000;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
