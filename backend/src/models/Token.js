const mongoose = require('mongoose');
const { isValidEthereumAddress, isValidTronAddress } = require('../utils');

const tokenSchema = new mongoose.Schema({
    walletId: {
        type: String,
        required: [true, 'Wallet ID is required'],
        index: true
    },
    symbol: {
        type: String,
        required: [true, 'Token symbol is required'],
        uppercase: true,
        trim: true
    },
    contractAddress: {
        type: String,
        required: [true, 'Contract address is required'],
        validate: {
            validator: function(address) {
                if (this.network === 'ERC20') {
                    return isValidEthereumAddress(address);
                } else if (this.network === 'TRC20') {
                    return isValidTronAddress(address);
                }
                return false;
            },
            message: 'Invalid contract address for the specified network'
        }
    },
    network: {
        type: String,
        required: [true, 'Network is required'],
        enum: ['ERC20', 'TRC20'],
        uppercase: true
    },
    forcedPrice: {
        type: Number,
        required: [true, 'Forced price is required'],
        min: [0, 'Price cannot be negative']
    },
    quantity: {
        type: Number,
        default: 0,
        min: [0, 'Quantity cannot be negative']
    },
    totalValue: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for efficient queries
tokenSchema.index({ walletId: 1, contractAddress: 1, network: 1 }, { unique: true });
tokenSchema.index({ symbol: 1 });
tokenSchema.index({ network: 1 });
tokenSchema.index({ isActive: 1 });

// Pre-save middleware to calculate total value
tokenSchema.pre('save', function(next) {
    this.totalValue = this.quantity * this.forcedPrice;
    this.lastUpdated = new Date();
    next();
});

// Instance methods
tokenSchema.methods.updatePrice = function(newPrice) {
    this.forcedPrice = newPrice;
    this.totalValue = this.quantity * this.forcedPrice;
    this.lastUpdated = new Date();
    return this.save();
};

tokenSchema.methods.updateQuantity = function(newQuantity) {
    this.quantity = newQuantity;
    this.totalValue = this.quantity * this.forcedPrice;
    this.lastUpdated = new Date();
    return this.save();
};

tokenSchema.methods.burn = function(amount) {
    if (amount > this.quantity) {
        throw new Error('Insufficient token balance for burning');
    }
    this.quantity -= amount;
    this.totalValue = this.quantity * this.forcedPrice;
    this.lastUpdated = new Date();
    return this.save();
};

// Static methods
tokenSchema.statics.findByWallet = function(walletId) {
    return this.find({ walletId, isActive: true });
};

tokenSchema.statics.findBySymbol = function(symbol) {
    return this.find({ symbol: symbol.toUpperCase(), isActive: true });
};

tokenSchema.statics.findByNetwork = function(network) {
    return this.find({ network: network.toUpperCase(), isActive: true });
};

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
