require('dotenv').config();

const config = {
    // Server Configuration
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // MongoDB Configuration
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/wallet-vault',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
    },

    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-123',
        expiresIn: process.env.JWT_EXPIRY || '24h'
    },

    // Admin Configuration
    admin: {
        token: 'admin-token-123-test' // Hardcoded for development
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    },

    // WebSocket Configuration
    websocket: {
        heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000
    },

    // Token Configuration
    tokens: {
        officialAddresses: {
            USDT: {
                ERC20: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                TRC20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
            }
        }
    }
};

module.exports = config;
