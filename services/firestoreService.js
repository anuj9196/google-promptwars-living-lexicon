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

const db = new Firestore({ projectId: PROJECT_ID });

const SESSIONS_COLLECTION = 'sessions';
const MONSTERS_SUBCOLLECTION = 'monsters';
const ANALYTICS_DOC = 'analytics/globalStats';

/**
 * Ensure a session document exists, creating one if needed
 * @param {string} sessionId - Browser session UUID
 * @returns {Promise<void>}
 */
async function ensureSession(sessionId) {
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
    const doc = await sessionRef.get();
    if (!doc.exists) {
        await sessionRef.set({
            createdAt: FieldValue.serverTimestamp(),
            lastActive: FieldValue.serverTimestamp(),
        });
        cloudLogger.log('INFO', 'New session created in Firestore', { sessionId });
    } else {
        await sessionRef.update({ lastActive: FieldValue.serverTimestamp() });
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

    const monsterRef = db
        .collection(SESSIONS_COLLECTION)
        .doc(sessionId)
        .collection(MONSTERS_SUBCOLLECTION)
        .doc(monster.id);

    await monsterRef.set({
        ...monster,
        capturedAt: FieldValue.serverTimestamp(),
    });

    // Update global analytics atomically
    const statsRef = db.doc(ANALYTICS_DOC);
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
    const snapshot = await db
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
    const doc = await db
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
    const doc = await db.doc(ANALYTICS_DOC).get();
    return doc.exists ? doc.data() : { totalMonsters: 0, totalScans: 0, topObjects: {} };
}

module.exports = {
    ensureSession,
    saveMonster,
    getCollection,
    getMonster,
    getAnalytics,
    // Exported for testing
    _internals: { db, SESSIONS_COLLECTION, MONSTERS_SUBCOLLECTION, ANALYTICS_DOC },
};
