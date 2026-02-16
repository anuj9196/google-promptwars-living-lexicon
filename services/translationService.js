/**
 * Google Cloud Translation API integration for Living Lexicon.
 * Translates monster lore into different languages using the
 * Cloud Translation API v3 (Advanced).
 *
 * @module services/translationService
 * @see {@link https://cloud.google.com/translate/docs}
 */

'use strict';

const { cloudLogger } = require('./loggingService');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'living-lexicon';

/** @type {import('@google-cloud/translate').v2.Translate | null} */
let _translateClient = null;

/**
 * Lazily initialize the Cloud Translation client.
 * Uses the same lazy pattern as other GCP services to
 * avoid credential discovery at import time.
 *
 * @returns {import('@google-cloud/translate').v2.Translate | null}
 */
function getTranslateClient() {
    if (_translateClient) return _translateClient;
    try {
        const { Translate } = require('@google-cloud/translate').v2;
        _translateClient = new Translate({ projectId: PROJECT_ID });
        return _translateClient;
    } catch (err) {
        cloudLogger.log('WARNING', 'Cloud Translation SDK not available', { error: err.message });
        return null;
    }
}

/**
 * Supported languages for monster lore translation.
 * @type {Record<string, string>}
 */
const SUPPORTED_LANGUAGES = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
    hi: 'Hindi',
    pt: 'Portuguese',
    ar: 'Arabic',
};

/**
 * Translate text to the specified target language using Google Cloud Translation API.
 *
 * @param {string} text - Source text to translate
 * @param {string} targetLanguage - ISO 639-1 language code (e.g., 'es', 'ja')
 * @returns {Promise<{ translatedText: string, detectedSourceLanguage: string, targetLanguage: string } | null>}
 *   The translation result, or null if translation is unavailable
 *
 * @example
 * const result = await translateText('A fire dragon born from a coffee mug', 'ja');
 * // → { translatedText: 'コーヒーマグから生まれた火竜', detectedSourceLanguage: 'en', targetLanguage: 'ja' }
 */
async function translateText(text, targetLanguage) {
    const client = getTranslateClient();
    if (!client) {
        cloudLogger.log('WARNING', 'Translation unavailable — client not initialized');
        return null;
    }

    if (!text || !targetLanguage) {
        return null;
    }

    if (!SUPPORTED_LANGUAGES[targetLanguage]) {
        cloudLogger.log('WARNING', 'Unsupported target language', { targetLanguage });
        return null;
    }

    try {
        const startTime = Date.now();
        const [translation] = await client.translate(text, targetLanguage);

        const result = {
            translatedText: translation,
            detectedSourceLanguage: 'en',
            targetLanguage,
        };

        cloudLogger.log('INFO', 'Monster lore translated via Cloud Translation API', {
            targetLanguage,
            inputLength: text.length,
            outputLength: translation.length,
            latencyMs: Date.now() - startTime,
        });

        return result;
    } catch (err) {
        cloudLogger.log('ERROR', 'Cloud Translation API error', {
            error: err.message,
            targetLanguage,
        });
        return null;
    }
}

/**
 * Detect the language of a text string.
 *
 * @param {string} text - Text to detect language for
 * @returns {Promise<{ language: string, confidence: number } | null>}
 */
async function detectLanguage(text) {
    const client = getTranslateClient();
    if (!client || !text) return null;

    try {
        const [detection] = await client.detect(text);
        return {
            language: detection.language,
            confidence: detection.confidence,
        };
    } catch (err) {
        cloudLogger.log('ERROR', 'Language detection failed', { error: err.message });
        return null;
    }
}

/**
 * Get the list of supported languages.
 * @returns {Record<string, string>} Map of language code → language name
 */
function getSupportedLanguages() {
    return { ...SUPPORTED_LANGUAGES };
}

module.exports = {
    translateText,
    detectLanguage,
    getSupportedLanguages,
    SUPPORTED_LANGUAGES,
};
