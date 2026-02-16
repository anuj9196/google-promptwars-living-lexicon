/**
 * reCAPTCHA v3 Verification Middleware
 * Verifies client-side reCAPTCHA tokens server-side via Google reCAPTCHA API
 * Rejects requests with score < 0.5 (likely bots)
 */

const { cloudLogger } = require('../services/loggingService');

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || '';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = 0.5;

/**
 * Express middleware to verify reCAPTCHA v3 tokens
 * Expects token in request body as `recaptchaToken`
 * In development mode (no secret configured), passes through with a warning
 */
async function verifyRecaptcha(req, res, next) {
    // Skip in development if no secret configured
    if (!RECAPTCHA_SECRET) {
        cloudLogger.log('WARNING', 'reCAPTCHA secret not configured — skipping verification');
        return next();
    }

    const token = req.body?.recaptchaToken;

    if (!token) {
        cloudLogger.log('WARNING', 'reCAPTCHA token missing', { ip: req.ip });
        return res.status(400).json({
            error: 'reCAPTCHA token required',
            code: 'RECAPTCHA_MISSING',
        });
    }

    try {
        const params = new URLSearchParams({
            secret: RECAPTCHA_SECRET,
            response: token,
            remoteip: req.ip,
        });

        const response = await fetch(`${RECAPTCHA_VERIFY_URL}?${params.toString()}`, {
            method: 'POST',
        });

        const result = await response.json();

        if (!result.success) {
            cloudLogger.log('WARNING', 'reCAPTCHA verification failed', {
                errorCodes: result['error-codes'],
                ip: req.ip,
            });
            return res.status(403).json({
                error: 'reCAPTCHA verification failed',
                code: 'RECAPTCHA_FAILED',
            });
        }

        if (result.score < MIN_SCORE) {
            cloudLogger.log('WARNING', 'reCAPTCHA score too low', {
                score: result.score,
                ip: req.ip,
            });
            return res.status(403).json({
                error: 'Request blocked by anti-abuse system',
                code: 'RECAPTCHA_LOW_SCORE',
            });
        }

        cloudLogger.log('INFO', 'reCAPTCHA verification passed', {
            score: result.score,
            action: result.action,
        });

        // Attach score to request for downstream logging
        req.recaptchaScore = result.score;
        next();
    } catch (err) {
        cloudLogger.log('ERROR', 'reCAPTCHA verification error', { error: err.message });
        // Fail open in case of reCAPTCHA service outage
        next();
    }
}

module.exports = { verifyRecaptcha, _internals: { MIN_SCORE, RECAPTCHA_VERIFY_URL } };
