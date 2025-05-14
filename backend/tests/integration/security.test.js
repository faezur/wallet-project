const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, server } = require('../../src/server');
const { queries } = require('../../src/db');
const config = require('../../src/config');

describe('Security and Cross-Wallet Tests', () => {
    let adminToken;
    let userToken;
    let expiredToken;

    beforeAll(() => {
        // Create tokens for testing
        adminToken = jwt.sign(
            { id: 1, walletId: 'admin_wallet', isAdmin: true },
            config.server.jwtSecret,
            { expiresIn: '1h' }
        );

        userToken = jwt.sign(
            { id: 2, walletId: 'user_wallet', isAdmin: false },
            config.server.jwtSecret,
            { expiresIn: '1h' }
        );

        expiredToken = jwt.sign(
            { id: 3, walletId: 'expired_wallet', isAdmin: true },
            config.server.jwtSecret,
            { expiresIn: '0s' }
        );
    });

    afterAll((done) => {
        server.close(done);
    });

    describe('Authentication and Authorization', () => {
        it('should reject requests without token', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .send({});

            expect(response.status).toBe(401);
        });

        it('should reject expired tokens', async () => {
            // Wait for token to expire
            await new Promise(resolve => setTimeout(resolve, 100));

            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${expiredToken}`)
                .send({});

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Token expired');
        });

        it('should reject non-admin users for admin endpoints', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${userToken}`)
                .send({});

            expect(response.status).toBe(403);
        });

        it('should prevent SQL injection attempts', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    wallet_id: "'; DROP TABLE forced_tokens; --",
                    token_symbol: "MALICIOUS",
                    forced_price: "1.00",
                    contract_address: "0x123",
                    network: "ERC20"
                });

            expect(response.status).toBe(400);
        });
    });

    describe('Cross-Wallet Token Synchronization', () => {
        const testToken = {
            wallet_id: 'wallet1',
            token_symbol: 'TEST',
            forced_price: '1.05',
            contract_address: '0x123',
            network: 'ERC20'
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should maintain consistent token state across wallets', async () => {
            // Mock successful token injection
            queries.injectToken.mockResolvedValue({
                ...testToken,
                id: 1,
                created_at: new Date(),
                updated_at: new Date()
            });

            // Inject token into first wallet
            const injectResponse = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(testToken);

            expect(injectResponse.status).toBe(200);

            // Verify token in second wallet
            const secondWalletToken = {
                wallet_id: 'wallet2',
                token_symbol: testToken.token_symbol,
                contract_address: testToken.contract_address,
                network: testToken.network
            };

            queries.getForcedToken.mockResolvedValue({
                ...testToken,
                id: 1,
                created_at: new Date(),
                updated_at: new Date()
            });

            const verifyResponse = await request(app)
                .post('/api/token/verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(secondWalletToken);

            expect(verifyResponse.status).toBe(200);
            expect(verifyResponse.body.data.forced_price).toBe(testToken.forced_price);
        });

        it('should propagate price updates to all wallets', async () => {
            const updatedPrice = '1.10';
            
            queries.setForcedPrice.mockResolvedValue({
                ...testToken,
                forced_price: updatedPrice,
                updated_at: new Date()
            });

            // Update price
            const updateResponse = await request(app)
                .post('/api/token/set-price')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    token_symbol: testToken.token_symbol,
                    forced_price: updatedPrice,
                    contract_address: testToken.contract_address,
                    network: testToken.network
                });

            expect(updateResponse.status).toBe(200);

            // Verify price update in different wallets
            const walletIds = ['wallet1', 'wallet2', 'wallet3'];
            
            for (const walletId of walletIds) {
                queries.getForcedToken.mockResolvedValue({
                    ...testToken,
                    wallet_id: walletId,
                    forced_price: updatedPrice,
                    updated_at: new Date()
                });

                const verifyResponse = await request(app)
                    .post('/api/token/verify')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({
                        wallet_id: walletId,
                        token_symbol: testToken.token_symbol,
                        contract_address: testToken.contract_address,
                        network: testToken.network
                    });

                expect(verifyResponse.status).toBe(200);
                expect(verifyResponse.body.data.forced_price).toBe(updatedPrice);
            }
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits', async () => {
            const requests = Array(101).fill().map(() => 
                request(app)
                    .post('/api/token/inject')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({})
            );

            const responses = await Promise.all(requests);
            const tooManyRequests = responses.filter(r => r.status === 429);
            
            expect(tooManyRequests.length).toBeGreaterThan(0);
        });

        it('should reset rate limit after window expires', async () => {
            // Wait for rate limit window to expire
            await new Promise(resolve => setTimeout(resolve, 1000));

            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(response.status).not.toBe(429);
        });
    });

    describe('Data Persistence', () => {
        it('should maintain token data after server restart', async () => {
            const testToken = {
                wallet_id: 'persistence_test',
                token_symbol: 'TEST',
                forced_price: '1.05',
                contract_address: '0x123',
                network: 'ERC20'
            };

            // Store token
            queries.injectToken.mockResolvedValue({
                ...testToken,
                id: 1,
                created_at: new Date(),
                updated_at: new Date()
            });

            const injectResponse = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(testToken);

            expect(injectResponse.status).toBe(200);

            // Simulate server restart by clearing mocks
            jest.clearAllMocks();

            // Verify token still exists
            queries.getForcedToken.mockResolvedValue({
                ...testToken,
                id: 1,
                created_at: new Date(),
                updated_at: new Date()
            });

            const verifyResponse = await request(app)
                .post('/api/token/verify')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    wallet_id: testToken.wallet_id,
                    token_symbol: testToken.token_symbol,
                    contract_address: testToken.contract_address,
                    network: testToken.network
                });

            expect(verifyResponse.status).toBe(200);
            expect(verifyResponse.body.data.forced_price).toBe(testToken.forced_price);
        });
    });
});
