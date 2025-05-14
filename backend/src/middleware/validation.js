const { isValidEthereumAddress, isValidTronAddress } = require('../utils');
const { AppError } = require('../utils');

const validateTokenInjection = (req, res, next) => {
    const { walletId, token_symbol, forced_price, contract_address, network, quantity } = req.body;

    if (!walletId || !token_symbol || !forced_price || !contract_address || !network) {
        throw new AppError('Missing required fields', 400);
    }

    if (typeof forced_price !== 'number' || forced_price <= 0) {
        throw new AppError('Invalid forced price', 400);
    }

    if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 0)) {
        throw new AppError('Invalid quantity', 400);
    }

    validateAddress(contract_address, network);
    next();
};

const validatePriceUpdate = (req, res, next) => {
    const { token_symbol, forced_price, contract_address, network } = req.body;

    if (!token_symbol || !forced_price || !contract_address || !network) {
        throw new AppError('Missing required fields', 400);
    }

    if (typeof forced_price !== 'number' || forced_price <= 0) {
        throw new AppError('Invalid forced price', 400);
    }

    validateAddress(contract_address, network);
    next();
};

const validateTokenBurn = (req, res, next) => {
    const { token_symbol, contract_address, amount, network } = req.body;

    if (!token_symbol || !contract_address || !amount || !network) {
        throw new AppError('Missing required fields', 400);
    }

    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Invalid amount', 400);
    }

    validateAddress(contract_address, network);
    next();
};

const validateTokenTransfer = (req, res, next) => {
    const { from_wallet, to_wallet, token_symbol, contract_address, network, amount } = req.body;

    if (!from_wallet || !to_wallet || !token_symbol || !contract_address || !network || !amount) {
        throw new AppError('Missing required fields', 400);
    }

    if (typeof amount !== 'number' || amount <= 0) {
        throw new AppError('Invalid amount', 400);
    }

    if (from_wallet === to_wallet) {
        throw new AppError('Cannot transfer to the same wallet', 400);
    }

    validateAddress(from_wallet, network);
    validateAddress(to_wallet, network);
    validateAddress(contract_address, network);
    
    next();
};

const validateAddress = (address, network) => {
    if (network === 'ERC20' && !isValidEthereumAddress(address)) {
        throw new AppError('Invalid Ethereum address', 400);
    } else if (network === 'TRC20' && !isValidTronAddress(address)) {
        throw new AppError('Invalid Tron address', 400);
    }
};

module.exports = {
    validateTokenInjection,
    validatePriceUpdate,
    validateTokenBurn,
    validateTokenTransfer
};
