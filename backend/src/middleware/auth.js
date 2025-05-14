const jwt = require('jsonwebtoken');
const { logger } = require('../utils');
const config = require('../config');

/**
 * Middleware to verify JWT token or admin token
 */
const authMiddleware = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            logger.error('No authorization token provided');
            return res.status(401).json({ 
                status: 'error',
                message: 'No authorization token provided' 
            });
        }

        // Check token format
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            logger.error('Invalid token format');
            return res.status(401).json({ 
                status: 'error',
                message: 'Invalid token format' 
            });
        }

        const token = parts[1];

        // First check if it's the admin token
        if (token === config.admin.token) {
            logger.info('Admin access granted via config token');
            req.user = { id: 'admin', isAdmin: true };
            return next();
        }

        // If not admin token, try to verify as JWT
        try {
            const decoded = jwt.verify(token, config.jwt.secret);
            req.user = decoded;
            logger.info('Authentication successful for user:', decoded.id);
            next();
        } catch (error) {
            logger.error('JWT verification failed:', error.message);
            return res.status(401).json({ 
                status: 'error',
                message: 'Invalid token' 
            });
        }
    } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(401).json({ 
            status: 'error',
            message: 'Authentication failed' 
        });
    }
};

/**
 * Middleware to check admin privileges
 */
const adminOnly = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        logger.error('Admin privileges required');
        return res.status(403).json({ 
            status: 'error',
            message: 'Admin privileges required' 
        });
    }
    logger.info('Admin access verified');
    next();
};

module.exports = {
    authMiddleware,
    adminOnly
};
