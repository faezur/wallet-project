const { tokenService } = require('../src/services/tokenService');
const { pool } = require('../src/db');

describe('Token Service', () => {
    const testWalletId = '0x1234567890123456789012345678901234567890';
    const testToken = {
        symbol: 'USDT',
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        network: 'ERC20',
        forcedPrice: 1.05,
        quantity: 1000
    };

    beforeAll(async () => {
        // Clear test data
        await pool.query('DELETE FROM tokens WHERE wallet_id = $1', [testWalletId]);
    });

    afterAll(async () => {
        await pool.end();
    });

    afterEach(async () => {
        // Clean up after each test
        await pool.query('DELETE FROM tokens WHERE wallet_id = $1', [testWalletId]);
    });

    describe('injectToken', () => {
        it('should inject a new token successfully', async () => {
            // When
            const result = await tokenService.injectToken(
                testWalletId,
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                testToken.forcedPrice
            );

            // Then
            expect(result.status).toBe('success');
            
            // Verify token was saved
            const { rows } = await pool.query(
                'SELECT * FROM tokens WHERE wallet_id = $1 AND symbol = $2',
                [testWalletId, testToken.symbol]
            );
            expect(rows.length).toBe(1);
            expect(rows[0].forced_price).toBe(testToken.forcedPrice);
        });

        it('should update existing token forced price', async () => {
            // Given
            await tokenService.injectToken(
                testWalletId,
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                testToken.forcedPrice
            );

            // When
            const newPrice = 1.10;
            const result = await tokenService.injectToken(
                testWalletId,
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                newPrice
            );

            // Then
            expect(result.status).toBe('success');
            
            const { rows } = await pool.query(
                'SELECT * FROM tokens WHERE wallet_id = $1 AND symbol = $2',
                [testWalletId, testToken.symbol]
            );
            expect(rows[0].forced_price).toBe(newPrice);
        });

        it('should reject invalid forced price', async () => {
            // When
            const promise = tokenService.injectToken(
                testWalletId,
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                -1
            );

            // Then
            await expect(promise).rejects.toThrow('Invalid forced price');
        });
    });

    describe('setForcedPrice', () => {
        it('should update token forced price', async () => {
            // Given
            await tokenService.injectToken(
                testWalletId,
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                testToken.forcedPrice
            );

            // When
            const newPrice = 1.15;
            const result = await tokenService.setForcedPrice(
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                newPrice
            );

            // Then
            expect(result.status).toBe('success');
            
            const { rows } = await pool.query(
                'SELECT * FROM tokens WHERE symbol = $1 AND contract_address = $2',
                [testToken.symbol, testToken.contractAddress]
            );
            expect(rows[0].forced_price).toBe(newPrice);
        });

        it('should reject if token does not exist', async () => {
            // When
            const promise = tokenService.setForcedPrice(
                'NONEXISTENT',
                testToken.contractAddress,
                testToken.network,
                1.0
            );

            // Then
            await expect(promise).rejects.toThrow('Token not found');
        });
    });

    describe('burnToken', () => {
        it('should burn specified amount of tokens', async () => {
            // Given
            await tokenService.injectToken(
                testWalletId,
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                testToken.forcedPrice
            );

            // When
            const burnAmount = 500;
            const result = await tokenService.burnToken(
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                burnAmount
            );

            // Then
            expect(result.status).toBe('success');
            
            const { rows } = await pool.query(
                'SELECT * FROM tokens WHERE symbol = $1 AND contract_address = $2',
                [testToken.symbol, testToken.contractAddress]
            );
            expect(rows[0].quantity).toBe(testToken.quantity - burnAmount);
        });

        it('should reject burning more than available balance', async () => {
            // Given
            await tokenService.injectToken(
                testWalletId,
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                testToken.forcedPrice
            );

            // When
            const promise = tokenService.burnToken(
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                testToken.quantity + 1
            );

            // Then
            await expect(promise).rejects.toThrow('Insufficient balance');
        });
    });

    describe('getWalletTokens', () => {
        it('should return all tokens for a wallet', async () => {
            // Given
            await tokenService.injectToken(
                testWalletId,
                testToken.symbol,
                testToken.contractAddress,
                testToken.network,
                testToken.forcedPrice
            );

            // When
            const tokens = await tokenService.getWalletTokens(testWalletId);

            // Then
            expect(tokens.length).toBe(1);
            expect(tokens[0].symbol).toBe(testToken.symbol);
            expect(tokens[0].forcedPrice).toBe(testToken.forcedPrice);
        });

        it('should return empty array for wallet with no tokens', async () => {
            // When
            const tokens = await tokenService.getWalletTokens('0xnonexistent');

            // Then
            expect(tokens).toEqual([]);
        });
    });
});
