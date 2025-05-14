// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.DB_USER = 'test_user';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test_db';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_PORT = '5432';
process.env.ETH_NODE_URL = 'http://localhost:8545';
process.env.TRON_NODE_URL = 'http://localhost:9090';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

// Global test timeout
jest.setTimeout(10000);

// Mock WebSocket for all tests
jest.mock('ws', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        terminate: jest.fn(),
        ping: jest.fn(),
        readyState: 1, // WebSocket.OPEN
        OPEN: 1
    }));
});

// Mock database queries
jest.mock('../src/db', () => ({
    queries: {
        injectToken: jest.fn(),
        setForcedPrice: jest.fn(),
        getForcedToken: jest.fn(),
        recordTransfer: jest.fn()
    },
    initDatabase: jest.fn().mockResolvedValue(true),
    pool: {
        query: jest.fn(),
        connect: jest.fn().mockImplementation(() => ({
            query: jest.fn(),
            release: jest.fn()
        }))
    }
}));

// Mock Web3 and TronWeb
jest.mock('web3', () => {
    return jest.fn().mockImplementation(() => ({
        eth: {
            Contract: jest.fn().mockImplementation(() => ({
                methods: {
                    balanceOf: jest.fn().mockImplementation(() => ({
                        call: jest.fn().mockResolvedValue('1000000000000000000')
                    }))
                }
            }))
        },
        utils: {
            isAddress: jest.fn().mockReturnValue(true)
        }
    }));
});

jest.mock('tronweb', () => {
    return {
        isAddress: jest.fn().mockReturnValue(true),
        contract: jest.fn().mockImplementation(() => ({
            at: jest.fn().mockResolvedValue({
                balanceOf: jest.fn().mockResolvedValue('1000000000')
            })
        }))
    };
});

// Global beforeAll hook
beforeAll(() => {
    // Any global setup needed before running tests
});

// Global afterAll hook
afterAll(() => {
    // Clean up after all tests
});

// Global beforeEach hook
beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
});

// Helper function to create test JWT tokens
global.createTestToken = (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        {
            id: 1,
            walletId: 'test_wallet',
            isAdmin: true,
            ...payload
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
};

// Helper function to create test WebSocket messages
global.createWebSocketMessage = (type, data = {}) => {
    return JSON.stringify({
        type,
        data
    });
};

// Helper function for async error testing
global.expectAsyncError = async (promise, errorType, errorMessage) => {
    try {
        await promise;
        throw new Error('Expected promise to reject');
    } catch (error) {
        expect(error).toBeInstanceOf(errorType);
        if (errorMessage) {
            expect(error.message).toBe(errorMessage);
        }
    }
};

// Console error and warning suppression for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
    console.error = (...args) => {
        if (args[0]?.includes('Warning:')) return;
        originalError.call(console, ...args);
    };
    console.warn = (...args) => {
        if (args[0]?.includes('Warning:')) return;
        originalWarn.call(console, ...args);
    };
});

afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
});
