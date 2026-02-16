/**
 * Cache Service — In-memory LRU caching for scan dedup and Firestore reads
 * Uses node-cache with configurable TTL and max keys
 *
 * Cache namespaces:
 *   scan:    — Dedup identical image scans (TTL: 5 min, max: 50)
 *   collection: — Firestore collection reads (TTL: 60s, max: 100)
 */

const NodeCache = require('node-cache');
const { cloudLogger } = require('./loggingService');

// Scan dedup cache — short TTL, smallish capacity
const scanCache = new NodeCache({
    stdTTL: 300,       // 5 minutes
    maxKeys: 50,
    checkperiod: 60,
    useClones: false,   // Performance: return references
});

// Collection cache — shorter TTL for data freshness
const collectionCache = new NodeCache({
    stdTTL: 60,        // 1 minute
    maxKeys: 100,
    checkperiod: 30,
    useClones: true,    // Safety: return copies for mutable data
});

/**
 * Generate a simple hash for scan deduplication
 * Uses first N characters of base64 as a perceptual fingerprint
 * (Production: replace with a real perceptual hash like pHash)
 * @param {string} base64Image
 * @returns {string} Hash key
 */
function generateScanKey(base64Image) {
    // Use a deterministic subset of the image data as key
    // Take samples from start, middle, and end for basic fingerprinting
    const len = base64Image.length;
    const sample = [
        base64Image.substring(0, 64),
        base64Image.substring(Math.floor(len / 4), Math.floor(len / 4) + 64),
        base64Image.substring(Math.floor(len / 2), Math.floor(len / 2) + 64),
        base64Image.substring(Math.floor((3 * len) / 4), Math.floor((3 * len) / 4) + 64),
    ].join('|');
    return `scan:${hashString(sample)}`;
}

/**
 * Simple string hash (DJB2 algorithm)
 * @param {string} str
 * @returns {string} Hex hash
 */
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(16);
}

/**
 * Get a cached scan result
 * @param {string} base64Image - Image to check
 * @returns {Object|undefined} Cached monster data or undefined
 */
function getCachedScan(base64Image) {
    const key = generateScanKey(base64Image);
    const result = scanCache.get(key);
    if (result) {
        cloudLogger.log('INFO', 'Scan cache HIT', { key });
    }
    return result;
}

/**
 * Cache a scan result
 * @param {string} base64Image - Image scanned
 * @param {Object} result - Monster data to cache
 */
function setCachedScan(base64Image, result) {
    const key = generateScanKey(base64Image);
    scanCache.set(key, result);
    cloudLogger.log('INFO', 'Scan result cached', { key });
}

/**
 * Get a cached collection
 * @param {string} sessionId
 * @returns {Object[]|undefined}
 */
function getCachedCollection(sessionId) {
    return collectionCache.get(`collection:${sessionId}`);
}

/**
 * Cache a collection
 * @param {string} sessionId
 * @param {Object[]} monsters
 */
function setCachedCollection(sessionId, monsters) {
    collectionCache.set(`collection:${sessionId}`, monsters);
}

/**
 * Invalidate collection cache for a session (e.g., after new monster added)
 * @param {string} sessionId
 */
function invalidateCollection(sessionId) {
    collectionCache.del(`collection:${sessionId}`);
}

/**
 * Get cache statistics for observability
 * @returns {Object} Cache hit/miss stats
 */
function getStats() {
    return {
        scan: scanCache.getStats(),
        collection: collectionCache.getStats(),
    };
}

/**
 * Flush all caches
 */
function flushAll() {
    scanCache.flushAll();
    collectionCache.flushAll();
}

module.exports = {
    getCachedScan,
    setCachedScan,
    getCachedCollection,
    setCachedCollection,
    invalidateCollection,
    getStats,
    flushAll,
    // Exported for testing
    _internals: { scanCache, collectionCache, generateScanKey, hashString },
};
