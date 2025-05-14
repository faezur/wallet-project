const Token = require('../models/Token');
const { logger, AppError } = require('../utils');

class TokenService {
    constructor() {
        this.subscribers = new Map(); // walletId -> Set of WebSocket connections
        
        // Bind methods to ensure 'this' context
        this.transferToken = this.transferToken.bind(this);
        this.injectToken = this.injectToken.bind(this);
        this.setTokenPrice = this.setTokenPrice.bind(this);
        this.burnToken = this.burnToken.bind(this);
        this.getWalletTokens = this.getWalletTokens.bind(this);
        this.notifyWalletSubscribers = this.notifyWalletSubscribers.bind(this);
        this.subscribeToWallet = this.subscribeToWallet.bind(this);
        this.unsubscribeFromWallet = this.unsubscribeFromWallet.bind(this);
    }

    /**
     * Transfer tokens between wallets
     */
    async transferToken(transferData) {
        try {
            logger.info('Transferring token:', transferData);

            const { from_wallet, to_wallet, token_symbol, contract_address, network, amount } = transferData;

            // Validate amount
            if (!amount || amount <= 0) {
                throw new AppError('Invalid transfer amount', 400);
            }

            // Find source token
            const sourceToken = await Token.findOne({
                walletId: from_wallet,
                contractAddress: contract_address,
                network,
                isActive: true
            });

            if (!sourceToken) {
                throw new AppError('Source token not found', 404);
            }

            // Check sufficient balance
            if (sourceToken.quantity < amount) {
                throw new AppError('Insufficient token balance', 400);
            }

            // Find or create destination token
            let destToken = await Token.findOne({
                walletId: to_wallet,
                contractAddress: contract_address,
                network,
                isActive: true
            });

            if (!destToken) {
                // Create new token in destination wallet
                destToken = await Token.create({
                    walletId: to_wallet,
                    symbol: token_symbol,
                    contractAddress: contract_address,
                    network,
                    forcedPrice: sourceToken.forcedPrice,
                    quantity: 0,
                    isActive: true
                });
            }

            // Perform transfer
            sourceToken.quantity -= amount;
            sourceToken.totalValue = sourceToken.quantity * sourceToken.forcedPrice;
            await sourceToken.save();

            destToken.quantity += amount;
            destToken.forcedPrice = sourceToken.forcedPrice; // Ensure same forced price
            destToken.totalValue = destToken.quantity * destToken.forcedPrice;
            await destToken.save();

            // Notify subscribers
            this.notifyWalletSubscribers(from_wallet, {
                type: 'TOKEN_TRANSFERRED',
                data: {
                    type: 'sent',
                    token: sourceToken,
                    amount,
                    to: to_wallet
                }
            });

            this.notifyWalletSubscribers(to_wallet, {
                type: 'TOKEN_TRANSFERRED',
                data: {
                    type: 'received',
                    token: destToken,
                    amount,
                    from: from_wallet
                }
            });

            return {
                source: sourceToken,
                destination: destToken,
                amount,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Error transferring token:', error);
            throw error;
        }
    }

    /**
     * Inject a new token or update existing one
     */
    async injectToken(tokenData) {
        try {
            logger.info('Injecting token:', tokenData);

            const { walletId, token_symbol, forced_price, contract_address, network, quantity } = tokenData;

            // Find existing token or create new one
            let token = await Token.findOne({
                walletId,
                contractAddress: contract_address,
                network
            });

            if (token) {
                // Update existing token
                token.forcedPrice = forced_price;
                token.symbol = token_symbol;
                token.isActive = true;
                if (typeof quantity === 'number' && quantity >= 0) {
                    token.quantity = quantity;
                }
                token.totalValue = token.quantity * token.forcedPrice;
                await token.save();
                
                logger.info('Token updated:', token);
            } else {
                // Create new token
                token = await Token.create({
                    walletId,
                    symbol: token_symbol,
                    contractAddress: contract_address,
                    network,
                    forcedPrice: forced_price,
                    quantity: typeof quantity === 'number' && quantity >= 0 ? quantity : 0,
                    totalValue: (typeof quantity === 'number' && quantity >= 0 ? quantity : 0) * forced_price
                });
                
                logger.info('New token created:', token);
            }

            // Notify subscribers
            this.notifyWalletSubscribers(walletId, {
                type: 'TOKEN_UPDATED',
                data: token
            });

            return token;
        } catch (error) {
            logger.error('Error injecting token:', error);
            if (error.name === 'ValidationError') {
                throw new AppError(error.message, 400);
            }
            throw error;
        }
    }

    /**
     * Set forced price for a token
     */
    async setTokenPrice(priceData) {
        try {
            logger.info('Setting token price:', priceData);

            const { token_symbol, forced_price, contract_address, network } = priceData;

            // Find all matching tokens across wallets
            const tokens = await Token.find({
                symbol: token_symbol,
                contractAddress: contract_address,
                network,
                isActive: true
            });

            if (!tokens.length) {
                throw new AppError('Token not found', 404);
            }

            // Update price for all matching tokens
            const updatedTokens = await Promise.all(
                tokens.map(async (token) => {
                    await token.updatePrice(forced_price);

                    // Notify subscribers for each affected wallet
                    this.notifyWalletSubscribers(token.walletId, {
                        type: 'PRICE_UPDATED',
                        data: token
                    });

                    return token;
                })
            );

            logger.info('Token prices updated:', updatedTokens);
            return updatedTokens;
        } catch (error) {
            logger.error('Error setting token price:', error);
            throw error;
        }
    }

    /**
     * Burn tokens from a wallet
     */
    async burnToken(burnData) {
        try {
            logger.info('Burning token:', burnData);

            const { token_symbol, contract_address, amount, network } = burnData;

            // Find all matching tokens
            const tokens = await Token.find({
                symbol: token_symbol,
                contractAddress: contract_address,
                network,
                isActive: true
            });

            if (!tokens.length) {
                throw new AppError('Token not found', 404);
            }

            // Burn tokens
            const burnedTokens = await Promise.all(
                tokens.map(async (token) => {
                    try {
                        await token.burn(amount);

                        // Notify subscribers
                        this.notifyWalletSubscribers(token.walletId, {
                            type: 'TOKEN_BURNED',
                            data: token
                        });

                        return token;
                    } catch (error) {
                        logger.error(`Error burning token for wallet ${token.walletId}:`, error);
                        throw new AppError(`Insufficient balance for wallet ${token.walletId}`, 400);
                    }
                })
            );

            logger.info('Tokens burned:', burnedTokens);
            return burnedTokens;
        } catch (error) {
            logger.error('Error burning token:', error);
            throw error;
        }
    }

    /**
     * Get all tokens for a wallet
     */
    async getWalletTokens(walletId) {
        try {
            logger.info('Getting tokens for wallet:', walletId);

            const tokens = await Token.findByWallet(walletId);
            return tokens;
        } catch (error) {
            logger.error('Error getting wallet tokens:', error);
            throw error;
        }
    }

    /**
     * Subscribe a WebSocket connection to wallet updates
     */
    subscribeToWallet(walletId, ws) {
        if (!this.subscribers.has(walletId)) {
            this.subscribers.set(walletId, new Set());
        }
        this.subscribers.get(walletId).add(ws);
        
        logger.info(`WebSocket subscribed to wallet: ${walletId}`);
    }

    /**
     * Unsubscribe a WebSocket connection from wallet updates
     */
    unsubscribeFromWallet(walletId, ws) {
        if (this.subscribers.has(walletId)) {
            this.subscribers.get(walletId).delete(ws);
            if (this.subscribers.get(walletId).size === 0) {
                this.subscribers.delete(walletId);
            }
        }
        
        logger.info(`WebSocket unsubscribed from wallet: ${walletId}`);
    }

    /**
     * Notify all subscribers of a wallet about updates
     */
    notifyWalletSubscribers(walletId, message) {
        if (this.subscribers.has(walletId)) {
            const subscribers = this.subscribers.get(walletId);
            subscribers.forEach(ws => {
                if (ws.readyState === 1) { // WebSocket.OPEN
                    ws.send(JSON.stringify(message));
                }
            });
            
            logger.info(`Notified ${subscribers.size} subscribers for wallet: ${walletId}`);
        }
    }
}

module.exports = TokenService;
