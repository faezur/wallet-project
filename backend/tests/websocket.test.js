const WebSocket = require('ws');
const { setupWebSocketServer } = require('../src/services/websocketService');
const { app } = require('../src/server');
const { pool } = require('../src/db');

describe('WebSocket Service', () => {
    let wsServer;
    let wsClient;
    let server;
    const PORT = 3001;
    const WS_URL = `ws://localhost:${PORT}`;
    const testWalletId = '0x1234567890123456789012345678901234567890';

    beforeAll((done) => {
        server = app.listen(PORT, () => {
            wsServer = setupWebSocketServer(server);
            done();
        });
    });

    afterAll((done) => {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.close();
        }
        wsServer.close(() => {
            server.close(() => {
                pool.end().then(() => done());
            });
        });
    });

    beforeEach((done) => {
        wsClient = new WebSocket(WS_URL);
        wsClient.on('open', () => done());
    });

    afterEach(() => {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.close();
        }
    });

    test('should establish connection successfully', (done) => {
        wsClient.on('message', (data) => {
            const message = JSON.parse(data);
            expect(message.type).toBe('CONNECTED');
            done();
        });

        wsClient.send(JSON.stringify({
            type: 'SUBSCRIBE',
            walletId: testWalletId,
            authToken: 'Bearer admin-token-123-test'
        }));
    });

    test('should handle token updates', (done) => {
        wsClient.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'TOKEN_UPDATED') {
                expect(message.data).toBeDefined();
                expect(message.data.symbol).toBe('USDT');
                done();
            }
        });

        wsClient.send(JSON.stringify({
            type: 'SUBSCRIBE',
            walletId: testWalletId,
            authToken: 'Bearer admin-token-123-test'
        }));

        // Simulate token update
        setTimeout(() => {
            wsServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'TOKEN_UPDATED',
                        data: {
                            symbol: 'USDT',
                            forcedPrice: 1.05,
                            quantity: 1000
                        }
                    }));
                }
            });
        }, 100);
    });

    test('should handle invalid messages', (done) => {
        wsClient.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'ERROR') {
                expect(message.message).toBe('Invalid message format');
                done();
            }
        });

        wsClient.send('invalid json');
    });

    test('should handle unauthorized access', (done) => {
        wsClient.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'ERROR') {
                expect(message.message).toBe('Unauthorized');
                done();
            }
        });

        wsClient.send(JSON.stringify({
            type: 'SUBSCRIBE',
            walletId: testWalletId,
            authToken: 'invalid-token'
        }));
    });

    test('should handle client disconnection', (done) => {
        let disconnected = false;

        wsClient.on('close', () => {
            disconnected = true;
        });

        wsClient.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'CONNECTED') {
                wsClient.close();
                setTimeout(() => {
                    expect(disconnected).toBe(true);
                    done();
                }, 100);
            }
        });

        wsClient.send(JSON.stringify({
            type: 'SUBSCRIBE',
            walletId: testWalletId,
            authToken: 'Bearer admin-token-123-test'
        }));
    });

    test('should broadcast to specific wallet subscribers', (done) => {
        const wallet1 = testWalletId;
        const wallet2 = '0x9876543210987654321098765432109876543210';
        let client1Messages = 0;
        let client2Messages = 0;

        // Create second client
        const wsClient2 = new WebSocket(WS_URL);

        wsClient.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'TOKEN_UPDATED' && message.walletId === wallet1) {
                client1Messages++;
            }
        });

        wsClient2.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'TOKEN_UPDATED' && message.walletId === wallet2) {
                client2Messages++;
            }
        });

        // Subscribe both clients
        wsClient.send(JSON.stringify({
            type: 'SUBSCRIBE',
            walletId: wallet1,
            authToken: 'Bearer admin-token-123-test'
        }));

        wsClient2.send(JSON.stringify({
            type: 'SUBSCRIBE',
            walletId: wallet2,
            authToken: 'Bearer admin-token-123-test'
        }));

        // Simulate updates for both wallets
        setTimeout(() => {
            wsServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'TOKEN_UPDATED',
                        walletId: wallet1,
                        data: { symbol: 'USDT' }
                    }));
                    client.send(JSON.stringify({
                        type: 'TOKEN_UPDATED',
                        walletId: wallet2,
                        data: { symbol: 'USDC' }
                    }));
                }
            });

            setTimeout(() => {
                expect(client1Messages).toBe(1);
                expect(client2Messages).toBe(1);
                wsClient2.close();
                done();
            }, 100);
        }, 100);
    });
});
