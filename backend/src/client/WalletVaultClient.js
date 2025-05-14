const WebSocket = require('ws');
const EventEmitter = require('events');

class WalletVaultClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            url: config.url || 'ws://localhost:3000',
            token: config.token,
            reconnectInterval: config.reconnectInterval || 5000,
            maxReconnectAttempts: config.maxReconnectAttempts || 5
        };
        this.ws = null;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.pingInterval = null;
        this.pongTimeout = null;
    }

    connect() {
        try {
            this.ws = new WebSocket(this.config.url);
            this.setupEventHandlers();
            this.authenticate();
        } catch (error) {
            this.emit('error', error);
            this.reconnect();
        }
    }

    setupEventHandlers() {
        this.ws.on('open', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
            this.setupHeartbeat();
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (error) {
                this.emit('error', new Error('Invalid message format'));
            }
        });

        this.ws.on('close', () => {
            this.isConnected = false;
            this.clearHeartbeat();
            this.emit('disconnected');
            this.reconnect();
        });

        this.ws.on('error', (error) => {
            this.emit('error', error);
        });

        this.ws.on('pong', () => {
            this.clearPongTimeout();
        });
    }

    authenticate() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'auth',
                token: this.config.token
            }));
        }
    }

    setupHeartbeat() {
        this.pingInterval = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
                this.setPongTimeout();
            }
        }, 30000); // Send ping every 30 seconds
    }

    setPongTimeout() {
        this.pongTimeout = setTimeout(() => {
            this.ws.terminate();
        }, 5000); // Wait 5 seconds for pong response
    }

    clearPongTimeout() {
        if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
        }
    }

    clearHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.clearPongTimeout();
    }

    reconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.emit('error', new Error('Max reconnection attempts reached'));
            return;
        }

        this.reconnectAttempts++;
        setTimeout(() => {
            this.emit('reconnecting', this.reconnectAttempts);
            this.connect();
        }, this.config.reconnectInterval);
    }

    handleMessage(message) {
        switch (message.type) {
            case 'auth_success':
                this.emit('authenticated');
                break;

            case 'auth_error':
                this.emit('error', new Error(message.message));
                break;

            case 'TOKEN_INJECTED':
                this.emit('tokenInjected', message.data);
                break;

            case 'PRICE_UPDATED':
                this.emit('priceUpdated', message.data);
                break;

            case 'TOKEN_BURNED':
                this.emit('tokenBurned', message.data);
                break;

            default:
                this.emit('message', message);
        }
    }

    disconnect() {
        if (this.ws) {
            this.clearHeartbeat();
            this.ws.close();
        }
    }
}

// Example usage:
/*
const client = new WalletVaultClient({
    url: 'ws://localhost:3000',
    token: 'your-jwt-token',
    reconnectInterval: 5000,
    maxReconnectAttempts: 5
});

client.on('connected', () => {
    console.log('Connected to WalletVault server');
});

client.on('authenticated', () => {
    console.log('Successfully authenticated');
});

client.on('tokenInjected', (data) => {
    console.log('New token injected:', data);
});

client.on('priceUpdated', (data) => {
    console.log('Token price updated:', data);
});

client.on('tokenBurned', (data) => {
    console.log('Token burned:', data);
});

client.on('error', (error) => {
    console.error('WalletVault error:', error);
});

client.connect();
*/

module.exports = WalletVaultClient;
