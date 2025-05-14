const WebSocket = require('ws');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, server } = require('../../src/server');
const config = require('../../src/config');
const { queries } = require('../../src/db');

describe('Load and Performance Tests', () => {
    let adminToken;
    const connectedClients = [];

    beforeAll(() => {
        adminToken = jwt.sign(
            { id: 1, walletId: 'admin_wallet', isAdmin: true },
            config.server.jwtSecret,
            { expiresIn: '1h' }
        );
    });

    afterAll(async () => {
        // Close all WebSocket connections
        connectedClients.forEach(client => client.close());
        await new Promise(resolve => setTimeout(resolve, 100));
        server.close();
    });

    describe('Concurrent API Requests', () => {
        it('should handle multiple concurrent token injections', async () => {
            const numRequests = 50;
            const requests = Array(numRequests).fill().map((_, i) => {
                return request(app)
                    .post('/api/token/inject')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        wallet_id: `wallet_${i}`,
                        token_symbol: 'TEST',
                        forced_price: '1.00',
                        contract_address: `0x${i}`,
                        network: 'ERC20'
                    });
            });

            const startTime = Date.now();
            const responses = await Promise.all(requests);
            const endTime = Date.now();

            // Calculate metrics
            const successfulRequests = responses.filter(r => r.status === 200).length;
            const totalTime = endTime - startTime;
            const averageTime = totalTime / numRequests;

            console.log(`
                Performance Metrics:
                - Total Requests: ${numRequests}
                - Successful Requests: ${successfulRequests}
                - Total Time: ${totalTime}ms
                - Average Time per Request: ${averageTime}ms
            `);

            expect(successfulRequests).toBe(numRequests);
            expect(averageTime).toBeLessThan(1000); // Each request should take less than 1 second
        });

        it('should handle concurrent price updates', async () => {
            const numUpdates = 30;
            const updates = Array(numUpdates).fill().map((_, i) => {
                return request(app)
                    .post('/api/token/set-price')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        token_symbol: 'TEST',
                        forced_price: (1 + i/100).toFixed(2),
                        contract_address: '0x123',
                        network: 'ERC20'
                    });
            });

            const startTime = Date.now();
            const responses = await Promise.all(updates);
            const endTime = Date.now();

            const successfulUpdates = responses.filter(r => r.status === 200).length;
            const totalTime = endTime - startTime;
            const averageTime = totalTime / numUpdates;

            expect(successfulUpdates).toBe(numUpdates);
            expect(averageTime).toBeLessThan(500); // Price updates should be faster
        });
    });

    describe('WebSocket Connection Load', () => {
        it('should handle multiple concurrent WebSocket connections', async () => {
            const numConnections = 100;
            const connectionPromises = Array(numConnections).fill().map((_, i) => {
                return new Promise((resolve) => {
                    const ws = new WebSocket(`ws://localhost:${config.server.port}`);
                    connectedClients.push(ws);

                    ws.on('open', () => {
                        const token = jwt.sign(
                            { id: i, walletId: `wallet_${i}`, isAdmin: false },
                            config.server.jwtSecret
                        );
                        ws.send(JSON.stringify({ type: 'auth', token }));
                    });

                    ws.on('message', (data) => {
                        const message = JSON.parse(data);
                        if (message.type === 'auth_success') {
                            resolve(true);
                        }
                    });

                    ws.on('error', () => resolve(false));
                });
            });

            const startTime = Date.now();
            const results = await Promise.all(connectionPromises);
            const endTime = Date.now();

            const successfulConnections = results.filter(Boolean).length;
            const totalTime = endTime - startTime;
            const averageTime = totalTime / numConnections;

            console.log(`
                WebSocket Connection Metrics:
                - Total Connections: ${numConnections}
                - Successful Connections: ${successfulConnections}
                - Total Time: ${totalTime}ms
                - Average Time per Connection: ${averageTime}ms
            `);

            expect(successfulConnections).toBe(numConnections);
            expect(averageTime).toBeLessThan(500);
        });

        it('should broadcast messages to multiple clients efficiently', async () => {
            const testMessage = {
                type: 'TOKEN_INJECTED',
                data: {
                    token_symbol: 'TEST',
                    forced_price: '1.00',
                    contract_address: '0x123',
                    network: 'ERC20'
                }
            };

            const messagePromises = connectedClients.map(client => {
                return new Promise((resolve) => {
                    client.once('message', () => resolve(true));
                    setTimeout(() => resolve(false), 5000); // 5 second timeout
                });
            });

            const startTime = Date.now();
            
            // Broadcast message to all clients
            connectedClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(testMessage));
                }
            });

            const results = await Promise.all(messagePromises);
            const endTime = Date.now();

            const successfulBroadcasts = results.filter(Boolean).length;
            const totalTime = endTime - startTime;
            const averageTime = totalTime / connectedClients.length;

            console.log(`
                Broadcast Metrics:
                - Total Recipients: ${connectedClients.length}
                - Successful Broadcasts: ${successfulBroadcasts}
                - Total Time: ${totalTime}ms
                - Average Time per Client: ${averageTime}ms
            `);

            expect(successfulBroadcasts).toBe(connectedClients.length);
            expect(averageTime).toBeLessThan(100); // Broadcasting should be very fast
        });
    });

    describe('Database Performance', () => {
        it('should handle multiple concurrent database operations', async () => {
            const numOperations = 50;
            const operations = Array(numOperations).fill().map((_, i) => {
                return Promise.all([
                    // Simulate multiple DB operations happening concurrently
                    queries.injectToken(`wallet_${i}`, 'TEST', '1.00', `0x${i}`, 'ERC20'),
                    queries.getForcedToken(`0x${i}`, 'ERC20'),
                    queries.setForcedPrice('TEST', '1.01', `0x${i}`, 'ERC20')
                ]);
            });

            const startTime = Date.now();
            await Promise.all(operations);
            const endTime = Date.now();

            const totalTime = endTime - startTime;
            const averageTime = totalTime / numOperations;

            console.log(`
                Database Performance Metrics:
                - Total Operations: ${numOperations * 3}
                - Total Time: ${totalTime}ms
                - Average Time per Operation Set: ${averageTime}ms
            `);

            expect(averageTime).toBeLessThan(1000);
        });
    });

    describe('Memory Usage', () => {
        it('should maintain stable memory usage under load', async () => {
            const initialMemory = process.memoryUsage();
            
            // Perform memory-intensive operations
            await Promise.all([
                // Concurrent API requests
                ...Array(50).fill().map(() => request(app)
                    .post('/api/token/inject')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        wallet_id: `wallet_${Date.now()}`,
                        token_symbol: 'TEST',
                        forced_price: '1.00',
                        contract_address: `0x${Date.now()}`,
                        network: 'ERC20'
                    })),
                
                // WebSocket operations
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);

            const finalMemory = process.memoryUsage();
            const memoryIncrease = {
                heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
                heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
                external: finalMemory.external - initialMemory.external
            };

            console.log(`
                Memory Usage Metrics:
                - Heap Used Increase: ${memoryIncrease.heapUsed / 1024 / 1024} MB
                - Heap Total Increase: ${memoryIncrease.heapTotal / 1024 / 1024} MB
                - External Memory Increase: ${memoryIncrease.external / 1024 / 1024} MB
            `);

            // Memory increase should be reasonable
            expect(memoryIncrease.heapUsed / 1024 / 1024).toBeLessThan(50); // Less than 50MB increase
        });
    });
});
