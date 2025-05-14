const WebSocket = require('ws');
const WalletVaultClient = require('../../src/client/WalletVaultClient');

// Mock WebSocket
jest.mock('ws');

describe('WalletVaultClient', () => {
    let client;
    let mockWs;
    const mockConfig = {
        url: 'ws://localhost:3000',
        token: 'test-token',
        reconnectInterval: 100,
        maxReconnectAttempts: 3
    };

    beforeEach(() => {
        // Reset WebSocket mock
        WebSocket.mockClear();
        
        // Create mock WebSocket instance
        mockWs = {
            on: jest.fn(),
            send: jest.fn(),
            ping: jest.fn(),
            close: jest.fn(),
            terminate: jest.fn(),
            readyState: WebSocket.OPEN
        };
        
        WebSocket.mockImplementation(() => mockWs);
        
        // Create new client instance
        client = new WalletVaultClient(mockConfig);
    });

    afterEach(() => {
        client.disconnect();
        jest.clearAllMocks();
    });

    describe('Connection', () => {
        it('should establish connection and setup event handlers', () => {
            client.connect();

            expect(WebSocket).toHaveBeenCalledWith(mockConfig.url);
            expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
        });

        it('should attempt to authenticate after connection', () => {
            client.connect();
            
            // Get the 'open' event handler and call it
            const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')[1];
            openHandler();

            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'auth',
                    token: mockConfig.token
                })
            );
        });

        it('should handle connection errors', () => {
            const errorListener = jest.fn();
            client.on('error', errorListener);

            client.connect();

            // Get the 'error' event handler and call it with an error
            const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')[1];
            const testError = new Error('Connection failed');
            errorHandler(testError);

            expect(errorListener).toHaveBeenCalledWith(testError);
        });
    });

    describe('Message Handling', () => {
        beforeEach(() => {
            client.connect();
        });

        it('should handle authentication success message', () => {
            const authListener = jest.fn();
            client.on('authenticated', authListener);

            // Get the 'message' event handler
            const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
            
            // Simulate auth success message
            messageHandler(JSON.stringify({
                type: 'auth_success',
                message: 'Successfully authenticated'
            }));

            expect(authListener).toHaveBeenCalled();
        });

        it('should handle token injection message', () => {
            const tokenListener = jest.fn();
            client.on('tokenInjected', tokenListener);

            const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
            
            const testData = {
                type: 'TOKEN_INJECTED',
                data: {
                    walletId: '0x123',
                    token: {
                        symbol: 'USDT',
                        contractAddress: '0x456',
                        network: 'ERC20',
                        forcedPrice: '1.05'
                    }
                }
            };

            messageHandler(JSON.stringify(testData));

            expect(tokenListener).toHaveBeenCalledWith(testData.data);
        });

        it('should handle price update message', () => {
            const priceListener = jest.fn();
            client.on('priceUpdated', priceListener);

            const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
            
            const testData = {
                type: 'PRICE_UPDATED',
                data: {
                    token: {
                        symbol: 'USDT',
                        contractAddress: '0x456',
                        network: 'ERC20',
                        forcedPrice: '1.06'
                    }
                }
            };

            messageHandler(JSON.stringify(testData));

            expect(priceListener).toHaveBeenCalledWith(testData.data);
        });

        it('should handle invalid message format', () => {
            const errorListener = jest.fn();
            client.on('error', errorListener);

            const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
            
            // Send invalid JSON
            messageHandler('invalid json');

            expect(errorListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Invalid message format'
                })
            );
        });
    });

    describe('Reconnection', () => {
        it('should attempt to reconnect on connection close', () => {
            jest.useFakeTimers();
            
            client.connect();
            
            // Get the 'close' event handler and trigger it
            const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
            closeHandler();

            // Fast-forward time
            jest.advanceTimersByTime(mockConfig.reconnectInterval);

            expect(WebSocket).toHaveBeenCalledTimes(2);
            
            jest.useRealTimers();
        });

        it('should stop reconnecting after max attempts', () => {
            jest.useFakeTimers();
            
            const errorListener = jest.fn();
            client.on('error', errorListener);

            client.connect();

            // Simulate max reconnection attempts
            for (let i = 0; i <= mockConfig.maxReconnectAttempts; i++) {
                const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
                closeHandler();
                jest.advanceTimersByTime(mockConfig.reconnectInterval);
            }

            expect(errorListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Max reconnection attempts reached'
                })
            );
            
            jest.useRealTimers();
        });
    });

    describe('Heartbeat', () => {
        it('should setup heartbeat on connection', () => {
            jest.useFakeTimers();
            
            client.connect();
            
            // Trigger connection open
            const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')[1];
            openHandler();

            // Fast-forward time
            jest.advanceTimersByTime(30000);

            expect(mockWs.ping).toHaveBeenCalled();
            
            jest.useRealTimers();
        });

        it('should terminate connection if pong not received', () => {
            jest.useFakeTimers();
            
            client.connect();
            
            // Trigger connection open
            const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')[1];
            openHandler();

            // Fast-forward time past ping interval and pong timeout
            jest.advanceTimersByTime(35000);

            expect(mockWs.terminate).toHaveBeenCalled();
            
            jest.useRealTimers();
        });
    });
});
