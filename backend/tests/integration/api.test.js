const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/server');
const Token = require('../../src/models/Token');
const config = require('../../src/config');

let mongoServer;

beforeAll(async () => {
    // Setup in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Token.deleteMany({});
});

describe('Token API Endpoints', () => {
    const testToken = {
        walletId: 'test-wallet-1',
        token_symbol: 'USDT',
        forced_price: 1.05,
        contract_address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        network: 'ERC20'
    };

    describe('POST /api/token/inject', () => {
        it('should inject a new token successfully', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send(testToken);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('success');
            expect(response.body.data).toMatchObject({
                walletId: testToken.walletId,
                symbol: testToken.token_symbol,
                forcedPrice: testToken.forced_price,
                contractAddress: testToken.contract_address,
                network: testToken.network
            });
        });

        it('should update existing token when injecting with same contract address', async () => {
            // First injection
            await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send(testToken);

            // Second injection with different price
            const updatedToken = { ...testToken, forced_price: 1.10 };
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send(updatedToken);

            expect(response.status).toBe(200);
            expect(response.body.data.forcedPrice).toBe(1.10);
        });

        it('should reject invalid token data', async () => {
            const invalidToken = { ...testToken, contract_address: 'invalid-address' };
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send(invalidToken);

            expect(response.status).toBe(400);
            expect(response.body.status).toBe('error');
        });

        it('should require admin authentication', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .send(testToken);

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/token/set-price', () => {
        it('should update token price successfully', async () => {
            // First inject the token
            await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send(testToken);

            // Then update its price
            const response = await request(app)
                .post('/api/token/set-price')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send({
                    token_symbol: testToken.token_symbol,
                    forced_price: 1.15,
                    contract_address: testToken.contract_address,
                    network: testToken.network
                });

            expect(response.status).toBe(200);
            expect(response.body.data[0].forcedPrice).toBe(1.15);
        });
    });

    describe('POST /api/token/burn', () => {
        it('should burn token amount successfully', async () => {
            // First inject the token with initial quantity
            const tokenWithQuantity = { ...testToken, quantity: 1000 };
            await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send(tokenWithQuantity);

            // Then burn some tokens
            const response = await request(app)
                .post('/api/token/burn')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send({
                    token_symbol: testToken.token_symbol,
                    contract_address: testToken.contract_address,
                    amount: 500,
                    network: testToken.network
                });

            expect(response.status).toBe(200);
            expect(response.body.data[0].quantity).toBe(500);
        });
    });

    describe('GET /api/wallet/:walletId/tokens', () => {
        it('should return wallet tokens successfully', async () => {
            // First inject some tokens
            await request(app)
                .post('/api/token/inject')
                .set('Authorization', `Bearer ${config.admin.token}`)
                .send(testToken);

            const response = await request(app)
                .get(`/api/wallet/${testToken.walletId}/tokens`)
                .set('Authorization', `Bearer ${config.admin.token}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].walletId).toBe(testToken.walletId);
        });
    });
});
