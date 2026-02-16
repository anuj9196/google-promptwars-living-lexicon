/**
 * Firestore Service — Server-side persistence for monster collections
 * Uses @google-cloud/firestore with service account authentication
 *
 * Data Model:
 *   sessions/{sessionId}                → Session metadata
 *   sessions/{sessionId}/monsters/{id}  → Individual monster documents
 *   analytics/globalStats               → Aggregate counters
 */

const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { cloudLogger } = require('./loggingService');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'living-lexicon-prod';

let _db = null;
function getDb() {
    if (!_db) _db = new Firestore({ projectId: PROJECT_ID });
    return _db;
}

const SESSIONS_COLLECTION = 'sessions';
const MONSTERS_SUBCOLLECTION = 'monsters';
const ANALYTICS_DOC = 'analytics/globalStats';

/**
 * Ensure a session document exists, creating one if needed
 * @param {string} sessionId - Browser session UUID
 * @returns {Promise<void>}
 */
async function ensureSession(sessionId) {
    try {
        const sessionRef = getDb().collection(SESSIONS_COLLECTION).doc(sessionId);
        const doc = await sessionRef.get();
        if (!doc.exists) {
            await sessionRef.set({
                createdAt: FieldValue.serverTimestamp(),
                lastActive: FieldValue.serverTimestamp(),
                monsterCount: 0,
                playerName: 'Anonymous',
            });
            cloudLogger.log('INFO', 'New session created in Firestore', { sessionId });
        } else {
            await sessionRef.update({ lastActive: FieldValue.serverTimestamp() });
        }
    } catch (err) {
        cloudLogger.log('ERROR', 'Firestore ensureSession failed', { error: err.message, code: err.code });
        // Re-throw if it's NOT_FOUND (5) - this means DB is missing
        throw err;
    }
}

/**
 * Save a monster document to a session's subcollection
 * @param {string} sessionId - Browser session UUID
 * @param {Object} monster - Full monster object
 * @returns {Promise<string>} Monster document ID
 */
async function saveMonster(sessionId, monster) {
    await ensureSession(sessionId);

    const monsterRef = getDb()
        .collection(SESSIONS_COLLECTION)
        .doc(sessionId)
        .collection(MONSTERS_SUBCOLLECTION)
        .doc(monster.id);

    await monsterRef.set({
        ...monster,
        capturedAt: FieldValue.serverTimestamp(),
    });

    // Update session monster count + global analytics atomically
    const sessionRef = getDb().collection(SESSIONS_COLLECTION).doc(sessionId);
    await sessionRef.update({ monsterCount: FieldValue.increment(1) });

    const statsRef = getDb().doc(ANALYTICS_DOC);
    await statsRef.set(
        {
            totalMonsters: FieldValue.increment(1),
            totalScans: FieldValue.increment(1),
            [`topObjects.${monster.originalObject}`]: FieldValue.increment(1),
        },
        { merge: true }
    );

    cloudLogger.log('INFO', 'Monster saved to Firestore', {
        sessionId,
        monsterId: monster.id,
        name: monster.name,
    });

    return monster.id;
}

/**
 * Get all monsters in a session's collection
 * @param {string} sessionId - Browser session UUID
 * @returns {Promise<Object[]>} Array of monster objects
 */
async function getCollection(sessionId) {
    const snapshot = await getDb()
        .collection(SESSIONS_COLLECTION)
        .doc(sessionId)
        .collection(MONSTERS_SUBCOLLECTION)
        .orderBy('capturedAt', 'desc')
        .get();

    const monsters = [];
    snapshot.forEach((doc) => {
        monsters.push({ id: doc.id, ...doc.data() });
    });

    cloudLogger.log('INFO', 'Collection retrieved from Firestore', {
        sessionId,
        count: monsters.length,
    });

    return monsters;
}

/**
 * Get a single monster document
 * @param {string} sessionId - Browser session UUID
 * @param {string} monsterId - Monster document ID
 * @returns {Promise<Object|null>} Monster object or null
 */
async function getMonster(sessionId, monsterId) {
    const doc = await getDb()
        .collection(SESSIONS_COLLECTION)
        .doc(sessionId)
        .collection(MONSTERS_SUBCOLLECTION)
        .doc(monsterId)
        .get();

    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

/**
 * Get global analytics stats
 * @returns {Promise<Object>} Analytics data
 */
async function getAnalytics() {
    const doc = await getDb().doc(ANALYTICS_DOC).get();
    return doc.exists ? doc.data() : { totalMonsters: 0, totalScans: 0, topObjects: {} };
}

/**
 * Set a player's display name
 * @param {string} sessionId - Browser session UUID
 * @param {string} name - Player display name
 * @returns {Promise<void>}
 */
async function setPlayerName(sessionId, name) {
    await ensureSession(sessionId);
    const sessionRef = getDb().collection(SESSIONS_COLLECTION).doc(sessionId);
    await sessionRef.update({ playerName: name });
    cloudLogger.log('INFO', 'Player name set', { sessionId, playerName: name });
}

/**
 * Get a player's profile
 * @param {string} sessionId - Browser session UUID
 * @returns {Promise<Object|null>}
 */
async function getPlayerProfile(sessionId) {
    const doc = await getDb().collection(SESSIONS_COLLECTION).doc(sessionId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return {
        sessionId: doc.id,
        playerName: data.playerName || 'Anonymous',
        monsterCount: data.monsterCount || 0,
        lastActive: data.lastActive,
        createdAt: data.createdAt,
    };
}

/**
 * Get the global leaderboard — top players by monster count
 * @param {number} limit - Max entries (default 10)
 * @returns {Promise<Object[]>} Ranked player list
 */
async function getLeaderboard(limit = 10) {
    const snapshot = await getDb()
        .collection(SESSIONS_COLLECTION)
        .where('monsterCount', '>', 0)
        .orderBy('monsterCount', 'desc')
        .limit(limit)
        .get();

    const leaderboard = [];
    let rank = 1;
    snapshot.forEach((doc) => {
        const data = doc.data();
        leaderboard.push({
            rank: rank++,
            sessionId: doc.id,
            playerName: data.playerName || 'Anonymous',
            monsterCount: data.monsterCount || 0,
            lastActive: data.lastActive,
        });
    });

    cloudLogger.log('INFO', 'Leaderboard queried', { entries: leaderboard.length });
    return leaderboard;
}

module.exports = {
    ensureSession,
    saveMonster,
    getCollection,
    getMonster,
    getAnalytics,
    setPlayerName,
    getPlayerProfile,
    getLeaderboard,
    // Exported for testing
    _internals: { getDb, SESSIONS_COLLECTION, MONSTERS_SUBCOLLECTION, ANALYTICS_DOC },
};
