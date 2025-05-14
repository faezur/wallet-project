const winston = require('winston');
const Web3 = require('web3');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Custom error class
class AppError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.status = 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

// Address validation functions
const isValidEthereumAddress = (address) => {
    try {
        return Web3.utils.isAddress(address);
    } catch (error) {
        return false;
    }
};

const isValidTronAddress = (address) => {
    // Basic TRON address validation (starts with T and is 34 characters)
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
};

// Value validation functions
const isValidPrice = (price) => {
    return !isNaN(price) && parseFloat(price) >= 0;
};

const isValidAmount = (amount) => {
    return !isNaN(amount) && parseFloat(amount) >= 0;
};

// Response formatter
const formatResponse = (success, data = null, message = null) => {
    return {
        status: success ? 'success' : 'error',
        ...(data && { data }),
        ...(message && { message })
    };
};

// Async handler wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    logger,
    AppError,
    isValidEthereumAddress,
    isValidTronAddress,
    isValidPrice,
    isValidAmount,
    formatResponse,
    asyncHandler
};
