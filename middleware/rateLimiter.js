/**
 * Rate Limiting Middleware
 * Sliding-window rate limiter using express-rate-limit
 * Protects API endpoints from abuse and excessive AI inference costs
 */

const rateLimit = require('express-rate-limit');
const { cloudLogger } = require('../services/loggingService');

/**
 * API rate limiter — 10 requests per minute per IP
 * Returns 429 with Retry-After header when exceeded
 */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,    // 1 minute window
    max: 10,                 // Max 10 requests per window per IP
    standardHeaders: true,   // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,    // Disable X-RateLimit-* headers
    message: {
        error: 'Too many requests. Please wait before scanning again.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
    },
    handler: (req, res, next, options) => {
        cloudLogger.log('WARNING', 'Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
        });
        res.status(options.statusCode).json(options.message);
    },
    keyGenerator: (req) => {
        // Use X-Forwarded-For header from Cloud Run, fallback to req.ip
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    },
});

/**
 * Stricter rate limiter for scan endpoint — 5 scans per minute
 * AI inference is expensive; this prevents abuse
 */
const scanLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Scan rate limit exceeded. Neural cooling required.',
        code: 'SCAN_RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
    },
    handler: (req, res, next, options) => {
        cloudLogger.log('WARNING', 'Scan rate limit exceeded', {
            ip: req.ip,
        });
        res.status(options.statusCode).json(options.message);
    },
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    },
});

module.exports = { apiLimiter, scanLimiter };
