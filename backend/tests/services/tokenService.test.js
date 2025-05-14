const TokenService = require('../../src/services/tokenService');
const { queries } = require('../../src/db');
const { ValidationError } = require('../../src/utils');

// Mock the database queries
jest.mock('../../src/db', () => ({
    queries: {
        injectToken: jest.fn(),
        setForcedPrice: jest.fn(),
        getForcedToken: jest.fn(),
        recordTransfer: jest.fn()
    }
}));

// Mock Web3 and TronWeb
jest.mock('web3');
jest.mock('tronweb');

describe('TokenService', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    describe('injectToken', () => {
        const validParams = {
            walletId: '0x123',
            tokenSymbol: 'USDT',
            forcedPrice: '1.05',
            contractAddress: '0x456',
            network: 'ERC20'
        };

        it('should successfully inject a token', async () => {
            const mockToken = {
                token_symbol: 'USDT',
                contract_address: '0x456',
                network: 'ERC20',
                forced_price: '1.05'
            };

            queries.injectToken.mockResolvedValue(mockToken);

            const result = await TokenService.injectToken(
                validParams.walletId,
                validParams.tokenSymbol,
                validParams.forcedPrice,
                validParams.contractAddress,
                validParams.network
            );

            expect(result).toEqual(mockToken);
            expect(queries.injectToken).toHaveBeenCalledWith(
                validParams.walletId,
                validParams.tokenSymbol,
                validParams.forcedPrice,
                validParams.contractAddress,
                validParams.network
            );
        });

        it('should throw error for invalid contract address', async () => {
            const invalidParams = { ...validParams, contractAddress: 'invalid' };

            await expect(TokenService.injectToken(
                invalidParams.walletId,
                invalidParams.tokenSymbol,
                invalidParams.forcedPrice,
                invalidParams.contractAddress,
                invalidParams.network
            )).rejects.toThrow('Invalid contract address');
        });

        it('should throw error for invalid price', async () => {
            const invalidParams = { ...validParams, forcedPrice: -1 };

            await expect(TokenService.injectToken(
                invalidParams.walletId,
                invalidParams.tokenSymbol,
                invalidParams.forcedPrice,
                invalidParams.contractAddress,
                invalidParams.network
            )).rejects.toThrow('Invalid price format');
        });
    });

    describe('setForcedPrice', () => {
        const validParams = {
            tokenSymbol: 'USDT',
            forcedPrice: '1.05',
            contractAddress: '0x456',
            network: 'ERC20'
        };

        it('should successfully update token price', async () => {
            const mockToken = {
                token_symbol: 'USDT',
                contract_address: '0x456',
                network: 'ERC20',
                forced_price: '1.05'
            };

            queries.setForcedPrice.mockResolvedValue(mockToken);

            const result = await TokenService.setForcedPrice(
                validParams.tokenSymbol,
                validParams.forcedPrice,
                validParams.contractAddress,
                validParams.network
            );

            expect(result).toEqual(mockToken);
            expect(queries.setForcedPrice).toHaveBeenCalledWith(
                validParams.tokenSymbol,
                validParams.forcedPrice,
                validParams.contractAddress,
                validParams.network
            );
        });

        it('should throw error for non-existent token', async () => {
            queries.setForcedPrice.mockResolvedValue(null);

            await expect(TokenService.setForcedPrice(
                validParams.tokenSymbol,
                validParams.forcedPrice,
                validParams.contractAddress,
                validParams.network
            )).rejects.toThrow('Token not found');
        });
    });

    describe('burnTokens', () => {
        const validParams = {
            tokenSymbol: 'USDT',
            contractAddress: '0x456',
            amount: '1000',
            network: 'ERC20'
        };

        it('should successfully burn tokens', async () => {
            const mockToken = {
                token_symbol: 'USDT',
                contract_address: '0x456',
                network: 'ERC20',
                forced_price: '1.05'
            };

            queries.getForcedToken.mockResolvedValue(mockToken);
            queries.recordTransfer.mockResolvedValue({});

            const result = await TokenService.burnTokens(
                validParams.tokenSymbol,
                validParams.contractAddress,
                validParams.amount,
                validParams.network
            );

            expect(result).toBe(true);
            expect(queries.getForcedToken).toHaveBeenCalledWith(
                validParams.contractAddress,
                validParams.network
            );
            expect(queries.recordTransfer).toHaveBeenCalled();
        });

        it('should throw error for non-existent token', async () => {
            queries.getForcedToken.mockResolvedValue(null);

            await expect(TokenService.burnTokens(
                validParams.tokenSymbol,
                validParams.contractAddress,
                validParams.amount,
                validParams.network
            )).rejects.toThrow('Token not found');
        });

        it('should throw error for invalid amount', async () => {
            const invalidParams = { ...validParams, amount: -1000 };

            await expect(TokenService.burnTokens(
                invalidParams.tokenSymbol,
                invalidParams.contractAddress,
                invalidParams.amount,
                invalidParams.network
            )).rejects.toThrow('Invalid amount');
        });
    });

    describe('validateContractAddress', () => {
        it('should validate ERC20 address correctly', () => {
            const result = TokenService.validateContractAddress('0x123', 'ERC20');
            expect(result).toBe(true);
        });

        it('should validate TRC20 address correctly', () => {
            const result = TokenService.validateContractAddress('T123', 'TRC20');
            expect(result).toBe(true);
        });

        it('should return false for invalid network', () => {
            const result = TokenService.validateContractAddress('0x123', 'INVALID');
            expect(result).toBe(false);
        });
    });
});
