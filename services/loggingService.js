/**
 * Cloud Logging Service — Structured observability via @google-cloud/logging
 * Falls back to console.log JSON when running outside GCP (local dev)
 *
 * Log entries follow Google Cloud Logging structured format for
 * automatic ingestion by Cloud Logging / Stackdriver.
 */

let Logging;
try {
    ({ Logging } = require('@google-cloud/logging'));
} catch {
    Logging = null;
}

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'living-lexicon-prod';
const LOG_NAME = 'living-lexicon-app';

let logger = null;
let log = null;

// Initialize Cloud Logging if available
if (Logging) {
    try {
        logger = new Logging({ projectId: PROJECT_ID });
        log = logger.log(LOG_NAME);
    } catch {
        // Fallback to console if Cloud Logging init fails
        logger = null;
        log = null;
    }
}

/**
 * Enterprise structured logging utility
 * Writes to Cloud Logging when running on GCP, falls back to console.log JSON locally
 */
const cloudLogger = {
    /**
     * Write a structured log entry
     * @param {'INFO'|'WARNING'|'ERROR'|'DEBUG'} severity - Log severity level
     * @param {string} message - Human-readable log message
     * @param {Object} payload - Additional structured data
     */
    log: (severity, message, payload = {}) => {
        const logEntry = {
            severity,
            message,
            timestamp: new Date().toISOString(),
            service: 'living-lexicon-logic-core',
            'logging.googleapis.com/labels': {
                app: 'living-lexicon',
                version: process.env.APP_VERSION || '1.0.0',
            },
            ...payload,
        };

        if (log) {
            // Write to Cloud Logging
            const metadata = {
                severity,
                resource: { type: 'cloud_run_revision' },
            };
            const entry = log.entry(metadata, logEntry);
            log.write(entry).catch((err) => {
                console.error('Cloud Logging write failed:', err.message);
                console.log(JSON.stringify(logEntry));
            });
        } else {
            // Fallback: structured JSON to stdout (Cloud Run ingests this automatically)
            console.log(JSON.stringify(logEntry));
        }
    },

    /**
     * Log an info message
     * @param {string} message
     * @param {Object} payload
     */
    info: (message, payload = {}) => cloudLogger.log('INFO', message, payload),

    /**
     * Log a warning message
     * @param {string} message
     * @param {Object} payload
     */
    warn: (message, payload = {}) => cloudLogger.log('WARNING', message, payload),

    /**
     * Log an error message
     * @param {string} message
     * @param {Object} payload
     */
    error: (message, payload = {}) => cloudLogger.log('ERROR', message, payload),
};

module.exports = { cloudLogger };
