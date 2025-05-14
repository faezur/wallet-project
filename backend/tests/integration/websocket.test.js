const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { server } = require('../../src/server');
const config = require('../../src/config');
const WebSocketService = require('../../src/services/websocketService');

describe('WebSocket Integration Tests', () => {
    let wsServer;
    let clients = [];
    const testTokens = [];

    beforeAll(() => {
        wsServer = WebSocketService.initialize(server);
    });

    afterAll((done) => {
        clients.forEach(client => client.close());
        server.close(done);
    });

    beforeEach(() => {
        clients = [];
        testTokens.length = 0;
    });

    const createTestClient = (isAdmin = false) => {
        const token = jwt.sign(
            { id: Math.random(), walletId: `wallet_${Date.now()}`, isAdmin },
            config.server.jwtSecret
        );
        
        const ws = new WebSocket(`ws://localhost:${config.server.port}`);
        clients.push(ws);
        
        return new Promise((resolve) => {
            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'auth', token }));
                resolve(ws);
            });
        });
    };

    describe('Connection and Authentication', () => {
        it('should authenticate admin client successfully', async () => {
            const messages = [];
            const client = await createTestClient(true);
            
            await new Promise((resolve) => {
                client.on('message', (data) => {
                    const message = JSON.parse(data);
                    messages.push(message);
                    if (message.type === 'auth_success') {
                        resolve();
                    }
                });
            });

            expect(messages.some(m => m.type === 'auth_success')).toBe(true);
        });

        it('should reject invalid authentication', async () => {
            const ws = new WebSocket(`ws://localhost:${config.server.port}`);
            clients.push(ws);
            
            const messages = [];
            await new Promise((resolve) => {
                ws.on('open', () => {
                    ws.send(JSON.stringify({ type: 'auth', token: 'invalid-token' }));
                });
                
                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    messages.push(message);
                    if (message.type === 'auth_error') {
                        resolve();
                    }
                });
            });

            expect(messages.some(m => m.type === 'auth_error')).toBe(true);
        });
    });

    describe('Real-time Updates', () => {
        it('should broadcast token injection to all connected clients', async () => {
            const [admin, client1, client2] = await Promise.all([
                createTestClient(true),
                createTestClient(),
                createTestClient()
            ]);

            const messages = {
                client1: [],
                client2: []
            };

            client1.on('message', (data) => messages.client1.push(JSON.parse(data)));
            client2.on('message', (data) => messages.client2.push(JSON.parse(data)));

            const testToken = {
                walletId: 'test_wallet',
                token: {
                    symbol: 'TEST',
                    contractAddress: '0x123',
                    network: 'ERC20',
                    forcedPrice: '1.00'
                }
            };

            WebSocketService.getInstance().notifyTokenInjection(testToken);

            // Wait for message propagation
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(messages.client1.some(m => 
                m.type === 'TOKEN_INJECTED' && 
                m.data.token.symbol === testToken.token.symbol
            )).toBe(true);

            expect(messages.client2.some(m => 
                m.type === 'TOKEN_INJECTED' && 
                m.data.token.symbol === testToken.token.symbol
            )).toBe(true);
        });

        it('should handle multiple rapid updates without message loss', async () => {
            const client = await createTestClient();
            const messages = [];

            client.on('message', (data) => messages.push(JSON.parse(data)));

            const updates = Array(50).fill().map((_, i) => ({
                token: {
                    symbol: `TEST${i}`,
                    contractAddress: `0x${i}`,
                    network: 'ERC20',
                    forcedPrice: '1.00'
                }
            }));

            // Send updates rapidly
            updates.forEach(update => {
                WebSocketService.getInstance().notifyPriceUpdate(update);
            });

            // Wait for message propagation
            await new Promise(resolve => setTimeout(resolve, 500));

            const priceUpdates = messages.filter(m => m.type === 'PRICE_UPDATED');
            expect(priceUpdates.length).toBe(updates.length);
        });
    });

    describe('Connection Stability', () => {
        it('should maintain connection with proper heartbeat', async () => {
            const client = await createTestClient();
            let isAlive = true;

            client.on('close', () => {
                isAlive = false;
            });

            // Wait for multiple heartbeat cycles
            await new Promise(resolve => setTimeout(resolve, 3000));

            expect(isAlive).toBe(true);
        });

        it('should reconnect after connection loss', async () => {
            const client = await createTestClient();
            let reconnected = false;

            // Force connection close
            client.close();

            // Attempt reconnection
            const newClient = await createTestClient();
            newClient.on('message', (data) => {
                const message = JSON.parse(data);
                if (message.type === 'auth_success') {
                    reconnected = true;
                }
            });

            await new Promise(resolve => setTimeout(resolve, 100));
            expect(reconnected).toBe(true);
        });
    });
});
