const WebSocket = require('ws');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { app } = require('../src/server');
const { setupWebSocketServer } = require('../src/services/websocketService');
const Token = require('../src/models/Token');

describe('WebSocket Integration Tests', () => {
    let mongoServer;
    let httpServer;
    let wsServer;
    let wsClient;
    const PORT = 3001;
    const WS_URL = `ws://localhost:${PORT}`;
    const testWalletId = '0x1234567890123456789012345678901234567890';
    const authToken = 'Bearer admin-token-123-test';

    beforeAll(async () => {
        // Setup MongoDB
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());

        // Setup HTTP and WebSocket servers
        httpServer = createServer(app);
        wsServer = setupWebSocketServer(httpServer);
        httpServer.listen(PORT);
    });

    afterAll(async () => {
        // Cleanup
        if (wsClient) wsClient.close();
        if (wsServer) wsServer.close();
        if (httpServer) httpServer.close();
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await Token.deleteMany({});
        if (wsClient) wsClient.close();
    });

    describe('WebSocket Connection', () => {
        test('should establish connection successfully', (done) => {
            wsClient = new WebSocket(WS_URL);
            
            wsClient.on('open', () => {
                wsClient.send(JSON.stringify({
                    type: 'SUBSCRIBE',
                    walletId: testWalletId,
                    authToken
                }));
            });

            wsClient.on('message', (data) => {
                const message = JSON.parse(data.toString());
                expect(message.type).toBe('CONNECTED');
                done();
            });
        });

        test('should reject unauthorized connection', (done) => {
            wsClient = new WebSocket(WS_URL);
            
            wsClient.on('open', () => {
                wsClient.send(JSON.stringify({
                    type: 'SUBSCRIBE',
                    walletId: testWalletId,
                    authToken: 'invalid-token'
                }));
            });

            wsClient.on('message', (data) => {
                const message = JSON.parse(data.toString());
                expect(message.type).toBe('ERROR');
                expect(message.message).toContain('Unauthorized');
                done();
            });
        });
    });

    describe('Token Updates', () => {
        test('should receive token update notifications', (done) => {
            wsClient = new WebSocket(WS_URL);
            let connected = false;

            wsClient.on('open', () => {
                wsClient.send(JSON.stringify({
                    type: 'SUBSCRIBE',
                    walletId: testWalletId,
                    authToken
                }));
            });

            wsClient.on('message', async (data) => {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'CONNECTED' && !connected) {
                    connected = true;
                    // Create a token to trigger update
                    await Token.create({
                        symbol: 'USDT',
                        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                        network: 'ERC20',
                        forcedPrice: 1.0,
                        quantity: 1000,
                        walletId: testWalletId
                    });
                }

                if (message.type === 'TOKEN_UPDATED') {
                    expect(message.data).toBeDefined();
                    expect(message.data.symbol).toBe('USDT');
                    done();
                }
            });
        });

        test('should handle multiple wallet subscriptions', (done) => {
            const wallet2 = '0x9876543210987654321098765432109876543210';
            let client1Messages = 0;
            let client2Messages = 0;

            const wsClient1 = new WebSocket(WS_URL);
            const wsClient2 = new WebSocket(WS_URL);

            wsClient1.on('open', () => {
                wsClient1.send(JSON.stringify({
                    type: 'SUBSCRIBE',
                    walletId: testWalletId,
                    authToken
                }));
            });

            wsClient2.on('open', () => {
                wsClient2.send(JSON.stringify({
                    type: 'SUBSCRIBE',
                    walletId: wallet2,
                    authToken
                }));
            });

            wsClient1.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'TOKEN_UPDATED') {
                    client1Messages++;
                }
            });

            wsClient2.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'TOKEN_UPDATED') {
                    client2Messages++;
                }
            });

            // Wait for both clients to connect
            setTimeout(async () => {
                // Create tokens for both wallets
                await Token.create({
                    symbol: 'USDT',
                    contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                    network: 'ERC20',
                    forcedPrice: 1.0,
                    quantity: 1000,
                    walletId: testWalletId
                });

                await Token.create({
                    symbol: 'USDC',
                    contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    network: 'ERC20',
                    forcedPrice: 1.0,
                    quantity: 500,
                    walletId: wallet2
                });

                // Check results after updates
                setTimeout(() => {
                    expect(client1Messages).toBe(1);
                    expect(client2Messages).toBe(1);
                    wsClient1.close();
                    wsClient2.close();
                    done();
                }, 100);
            }, 100);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid message format', (done) => {
            wsClient = new WebSocket(WS_URL);
            
            wsClient.on('open', () => {
                wsClient.send('invalid json');
            });

            wsClient.on('message', (data) => {
                const message = JSON.parse(data.toString());
                expect(message.type).toBe('ERROR');
                expect(message.message).toContain('Invalid message format');
                done();
            });
        });

        test('should handle missing required fields', (done) => {
            wsClient = new WebSocket(WS_URL);
            
            wsClient.on('open', () => {
                wsClient.send(JSON.stringify({
                    type: 'SUBSCRIBE'
                    // Missing walletId and authToken
                }));
            });

            wsClient.on('message', (data) => {
                const message = JSON.parse(data.toString());
                expect(message.type).toBe('ERROR');
                expect(message.message).toContain('Missing required fields');
                done();
            });
        });
    });
});
