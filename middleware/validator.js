/**
 * Input validation middleware for API request bodies.
 * Provides reusable validators for common input patterns
 * used across Living Lexicon API endpoints.
 *
 * @module middleware/validator
 */

'use strict';

const { ValidationError } = require('../utils/errors');

/**
 * Validates that a request body contains required string fields.
 *
 * @param {string[]} requiredFields - List of required field names
 * @returns {import('express').RequestHandler} Express middleware
 *
 * @example
 * app.post('/api/scan', requireFields(['image', 'sessionId']), handler);
 */
function requireFields(requiredFields) {
    return (req, res, next) => {
        for (const field of requiredFields) {
            if (!req.body[field] || typeof req.body[field] !== 'string') {
                return next(new ValidationError(`${field} is required and must be a string`, `MISSING_${field.toUpperCase()}`));
            }
        }
        next();
    };
}

/**
 * Validates that a string field does not exceed a maximum byte length.
 *
 * @param {string} field - The request body field to check
 * @param {number} maxBytes - Maximum allowed byte length
 * @returns {import('express').RequestHandler} Express middleware
 */
function maxPayloadSize(field, maxBytes) {
    return (req, res, next) => {
        if (req.body[field] && req.body[field].length > maxBytes) {
            return next(new ValidationError(
                `${field} exceeds maximum size of ${(maxBytes / (1024 * 1024)).toFixed(0)}MB`,
                'PAYLOAD_TOO_LARGE'
            ));
        }
        next();
    };
}

/**
 * Sanitizes a string field by trimming whitespace and limiting length.
 *
 * @param {string} field - The request body field to sanitize
 * @param {number} maxLength - Maximum character length
 * @returns {import('express').RequestHandler} Express middleware
 */
function sanitizeString(field, maxLength = 100) {
    return (req, res, next) => {
        if (req.body[field] && typeof req.body[field] === 'string') {
            req.body[field] = req.body[field].trim().substring(0, maxLength);
        }
        next();
    };
}

module.exports = {
    requireFields,
    maxPayloadSize,
    sanitizeString,
};
