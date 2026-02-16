/**
 * AppError — Structured error class for the Living Lexicon application.
 * Provides consistent error handling with HTTP status codes, error codes,
 * and structured logging integration across all API routes.
 *
 * @module utils/errors
 */

'use strict';

/**
 * Custom application error with HTTP status code and machine-readable error code.
 * @extends Error
 */
class AppError extends Error {
    /**
     * @param {string} message - Human-readable error message
     * @param {number} statusCode - HTTP status code (default: 500)
     * @param {string} code - Machine-readable error code (default: 'INTERNAL_ERROR')
     */
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Serialize to JSON for API responses
     * @returns {{ error: string, code: string }}
     */
    toJSON() {
        return { error: this.message, code: this.code };
    }
}

/**
 * Validation error — 400 Bad Request
 */
class ValidationError extends AppError {
    constructor(message, code = 'VALIDATION_ERROR') {
        super(message, 400, code);
        this.name = 'ValidationError';
    }
}

/**
 * Authentication error — 401 Unauthorized
 */
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required', code = 'AUTH_ERROR') {
        super(message, 401, code);
        this.name = 'AuthenticationError';
    }
}

/**
 * Service unavailable error — 503
 */
class ServiceUnavailableError extends AppError {
    constructor(serviceName, code = 'SERVICE_UNAVAILABLE') {
        super(`${serviceName} is temporarily unavailable`, 503, code);
        this.name = 'ServiceUnavailableError';
    }
}

/**
 * Express error handler middleware.
 * Catches AppError instances and returns structured JSON responses.
 * Falls back to 500 for unknown errors.
 *
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
function errorHandler(err, req, res, _next) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json(err.toJSON());
    }

    // Unknown error — don't leak internals
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    ServiceUnavailableError,
    errorHandler,
};
