const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const Token = require('../src/models/Token');

describe('Token API Tests', () => {
    let mongoServer;
    const testWalletId = '0x1234567890123456789012345678901234567890';
    const authToken = 'Bearer admin-token-123-test';

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await Token.deleteMany({});
    });

    describe('POST /api/token/inject', () => {
        const injectTokenData = {
            wallet_id: testWalletId,
            token_symbol: 'USDT',
            forced_price: 1.05,
            contract_address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            network: 'ERC20'
        };

        test('should inject token successfully with valid data', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', authToken)
                .send(injectTokenData);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('success');

            const token = await Token.findOne({ symbol: 'USDT' });
            expect(token).toBeTruthy();
            expect(token.forcedPrice).toBe(1.05);
        });

        test('should fail without authorization', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .send(injectTokenData);

            expect(response.status).toBe(401);
        });

        test('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/token/inject')
                .set('Authorization', authToken)
                .send({
                    wallet_id: testWalletId
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBeTruthy();
        });
    });

    describe('POST /api/token/set-price', () => {
        beforeEach(async () => {
            await Token.create({
                symbol: 'USDT',
                contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                network: 'ERC20',
                forcedPrice: 1.0,
                walletId: testWalletId
            });
        });

        test('should update token price successfully', async () => {
            const response = await request(app)
                .post('/api/token/set-price')
                .set('Authorization', authToken)
                .send({
                    token_symbol: 'USDT',
                    forced_price: 1.1,
                    contract_address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                    network: 'ERC20'
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('success');

            const token = await Token.findOne({ symbol: 'USDT' });
            expect(token.forcedPrice).toBe(1.1);
        });

        test('should reject negative prices', async () => {
            const response = await request(app)
                .post('/api/token/set-price')
                .set('Authorization', authToken)
                .send({
                    token_symbol: 'USDT',
                    forced_price: -1,
                    contract_address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                    network: 'ERC20'
                });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/token/burn', () => {
        beforeEach(async () => {
            await Token.create({
                symbol: 'USDT',
                contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                network: 'ERC20',
                forcedPrice: 1.0,
                quantity: 1000,
                walletId: testWalletId
            });
        });

        test('should burn tokens successfully', async () => {
            const response = await request(app)
                .post('/api/token/burn')
                .set('Authorization', authToken)
                .send({
                    token_symbol: 'USDT',
                    contract_address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                    network: 'ERC20',
                    amount: 500
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('success');

            const token = await Token.findOne({ symbol: 'USDT' });
            expect(token.quantity).toBe(500);
        });

        test('should reject burning more than available', async () => {
            const response = await request(app)
                .post('/api/token/burn')
                .set('Authorization', authToken)
                .send({
                    token_symbol: 'USDT',
                    contract_address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                    network: 'ERC20',
                    amount: 2000
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('insufficient');
        });
    });
});
