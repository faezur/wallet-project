const jwt = require('jsonwebtoken');
const { logger } = require('../utils');
const config = require('../config');

class WebSocketService {
    constructor(wss, tokenService) {
        this.wss = wss;
        this.tokenService = tokenService;
        this.heartbeatInterval = config.websocket.heartbeatInterval || 30000;
        
        // Setup periodic cleanup of dead connections
        setInterval(() => {
            this.cleanup();
        }, this.heartbeatInterval);
    }

    /**
     * Handle new WebSocket connections
     */
    handleConnection(ws, req) {
        logger.info('New WebSocket connection');

        // Set initial connection state
        ws.isAlive = true;
        ws.subscribedWallets = new Set();

        // Setup ping-pong for connection health check
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Handle incoming messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                await this.handleMessage(ws, data);
            } catch (error) {
                logger.error('Error handling WebSocket message:', error);
                this.sendError(ws, error.message);
            }
        });

        // Handle connection close
        ws.on('close', () => {
            this.handleDisconnect(ws);
        });

        // Send initial connection success message
        this.send(ws, {
            type: 'CONNECTED',
            message: 'Successfully connected to WebSocket server'
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    async handleMessage(ws, data) {
        const { type, payload, token } = data;

        // Verify authentication token
        try {
            let isAuthenticated = false;

            // Check if it's the admin token
            if (token === config.admin.token) {
                isAuthenticated = true;
            } else {
                // Verify JWT token
                const decoded = jwt.verify(token, config.jwt.secret);
                if (decoded) {
                    isAuthenticated = true;
                }
            }

            if (!isAuthenticated) {
                throw new Error('Invalid authentication token');
            }
        } catch (error) {
            logger.error('WebSocket authentication error:', error);
            this.sendError(ws, 'Authentication failed');
            return;
        }

        switch (type) {
            case 'SUBSCRIBE_WALLET':
                await this.handleSubscribe(ws, payload);
                break;

            case 'UNSUBSCRIBE_WALLET':
                await this.handleUnsubscribe(ws, payload);
                break;

            case 'PING':
                this.send(ws, { type: 'PONG' });
                break;

            default:
                this.sendError(ws, 'Unknown message type');
        }
    }

    /**
     * Handle wallet subscription requests
     */
    async handleSubscribe(ws, payload) {
        const { walletId } = payload;

        if (!walletId) {
            this.sendError(ws, 'Wallet ID is required');
            return;
        }

        // Subscribe to wallet updates
        this.tokenService.subscribeToWallet(walletId, ws);
        ws.subscribedWallets.add(walletId);

        // Send current wallet state
        try {
            const tokens = await this.tokenService.getWalletTokens(walletId);
            this.send(ws, {
                type: 'WALLET_STATE',
                data: tokens
            });
            
            logger.info(`Subscribed to wallet: ${walletId}`);
        } catch (error) {
            logger.error('Error getting wallet state:', error);
            this.sendError(ws, 'Error getting wallet state');
        }
    }

    /**
     * Handle wallet unsubscription requests
     */
    async handleUnsubscribe(ws, payload) {
        const { walletId } = payload;

        if (!walletId) {
            this.sendError(ws, 'Wallet ID is required');
            return;
        }

        this.tokenService.unsubscribeFromWallet(walletId, ws);
        ws.subscribedWallets.delete(walletId);

        this.send(ws, {
            type: 'UNSUBSCRIBED',
            data: { walletId }
        });
        
        logger.info(`Unsubscribed from wallet: ${walletId}`);
    }

    /**
     * Handle WebSocket disconnection
     */
    handleDisconnect(ws) {
        // Unsubscribe from all wallets
        ws.subscribedWallets.forEach(walletId => {
            this.tokenService.unsubscribeFromWallet(walletId, ws);
        });

        ws.subscribedWallets.clear();
        logger.info('WebSocket connection closed');
    }

    /**
     * Send message to WebSocket client
     */
    send(ws, message) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Send error message to WebSocket client
     */
    sendError(ws, error) {
        this.send(ws, {
            type: 'ERROR',
            message: error
        });
    }

    /**
     * Cleanup dead connections
     */
    cleanup() {
        this.wss.clients.forEach(ws => {
            if (ws.isAlive === false) {
                this.handleDisconnect(ws);
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
        
        logger.info('WebSocket cleanup completed');
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcast(message) {
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
                this.send(client, message);
            }
        });
    }
}

module.exports = WebSocketService;
