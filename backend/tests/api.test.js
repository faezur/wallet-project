const request = require('supertest');
const { app } = require('../src/server');
const { pool } = require('../src/db');
const WebSocket = require('ws');

describe('API Endpoints', () => {
    let authToken;
    let testWalletId;
    let testToken;

    beforeAll(async () => {
        // Setup test database and get auth token
        authToken = 'Bearer admin-token-123-test'; // Test token
        testWalletId = '0x1234567890123456789012345678901234567890';
        testToken = {
            symbol: 'USDT',
            contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            network: 'ERC20',
            forcedPrice: 1.05,
            quantity: 1000
        };
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('Token Injection', () => {
        it('should inject a token with forced price', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', authToken)
                .send({
                    wallet_id: testWalletId,
                    token_symbol: testToken.symbol,
                    forced_price: testToken.forcedPrice,
                    contract_address: testToken.contractAddress,
                    network: testToken.network
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('success');
            expect(response.body.message).toContain('Token USDT injected');
        });

        it('should reject injection without auth token', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .send({
                    wallet_id: testWalletId,
                    token_symbol: testToken.symbol,
                    forced_price: testToken.forcedPrice,
                    contract_address: testToken.contractAddress,
                    network: testToken.network
                });

            expect(response.status).toBe(401);
        });
    });

    describe('Price Setting', () => {
        it('should set forced price for existing token', async () => {
            const newPrice = 1.10;
            const response = await request(app)
                .post('/api/token/set-price')
                .set('Authorization', authToken)
                .send({
                    token_symbol: testToken.symbol,
                    forced_price: newPrice,
                    contract_address: testToken.contractAddress,
                    network: testToken.network
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('success');
        });

        it('should reject invalid price values', async () => {
            const response = await request(app)
                .post('/api/token/set-price')
                .set('Authorization', authToken)
                .send({
                    token_symbol: testToken.symbol,
                    forced_price: -1,
                    contract_address: testToken.contractAddress,
                    network: testToken.network
                });

            expect(response.status).toBe(400);
        });
    });

    describe('Token Burning', () => {
        it('should burn specified amount of tokens', async () => {
            const response = await request(app)
                .post('/api/token/burn')
                .set('Authorization', authToken)
                .send({
                    token_symbol: testToken.symbol,
                    contract_address: testToken.contractAddress,
                    amount: 100,
                    network: testToken.network
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('success');
        });

        it('should reject burning more than available balance', async () => {
            const response = await request(app)
                .post('/api/token/burn')
                .set('Authorization', authToken)
                .send({
                    token_symbol: testToken.symbol,
                    contract_address: testToken.contractAddress,
                    amount: 1000000,
                    network: testToken.network
                });

            expect(response.status).toBe(400);
        });
    });

    describe('WebSocket Connection', () => {
        let ws;

        beforeEach((done) => {
            const wsUrl = 'ws://localhost:' + (process.env.PORT || 3000);
            ws = new WebSocket(wsUrl);
            ws.on('open', () => done());
        });

        afterEach(() => {
            ws.close();
        });

        it('should receive token updates through WebSocket', (done) => {
            ws.on('message', (data) => {
                const message = JSON.parse(data);
                expect(message.type).toBe('TOKEN_UPDATED');
                expect(message.data).toBeDefined();
                done();
            });

            // Trigger a token update
            request(app)
                .post('/api/token/set-price')
                .set('Authorization', authToken)
                .send({
                    token_symbol: testToken.symbol,
                    forced_price: 1.15,
                    contract_address: testToken.contractAddress,
                    network: testToken.network
                })
                .end();
        });

        it('should handle WebSocket disconnection gracefully', (done) => {
            ws.on('close', () => {
                expect(true).toBe(true);
                done();
            });
            ws.close();
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors', async () => {
            // Simulate database error
            jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('DB Error'));

            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', authToken)
                .send({
                    wallet_id: testWalletId,
                    token_symbol: testToken.symbol,
                    forced_price: testToken.forcedPrice,
                    contract_address: testToken.contractAddress,
                    network: testToken.network
                });

            expect(response.status).toBe(500);
            expect(response.body.error).toBeDefined();
        });

        it('should handle invalid JSON input', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', authToken)
                .set('Content-Type', 'application/json')
                .send('{"invalid json"');

            expect(response.status).toBe(400);
        });
    });
});
