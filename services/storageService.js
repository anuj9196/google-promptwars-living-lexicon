/**
 * Cloud Storage Service — Raw scan staging and monster asset persistence
 * Uses @google-cloud/storage with service account authentication
 *
 * Buckets:
 *   lexicon-raw-ingest  → Raw camera captures for audit/training
 *   lexicon-assets      → Generated monster images for serving
 */

const { Storage } = require('@google-cloud/storage');
const { cloudLogger } = require('./loggingService');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'living-lexicon-prod';
const RAW_BUCKET = process.env.GCS_RAW_BUCKET || `${PROJECT_ID}-lexicon-raw-ingest`;
const ASSETS_BUCKET = process.env.GCS_ASSETS_BUCKET || `${PROJECT_ID}-lexicon-assets`;

let _storage = null;
function getStorage() {
    if (!_storage) _storage = new Storage({ projectId: PROJECT_ID });
    return _storage;
}

/**
 * Upload a base64-encoded image to a GCS bucket
 * @param {string} bucketName - Target bucket
 * @param {string} objectName - Object path/name in bucket
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} GCS URI (gs://bucket/object)
 */
async function uploadBase64(bucketName, objectName, base64Data, contentType = 'image/jpeg') {
    const buffer = Buffer.from(base64Data, 'base64');
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(buffer, {
        metadata: {
            contentType,
            cacheControl: 'public, max-age=31536000',
        },
    });

    const gcsUri = `gs://${bucketName}/${objectName}`;
    cloudLogger.log('INFO', 'File uploaded to GCS', {
        bucket: bucketName,
        object: objectName,
        sizeBytes: buffer.length,
    });

    return gcsUri;
}

/**
 * Upload raw camera scan for audit/training pipeline
 * @param {string} base64Image - Base64-encoded JPEG scan
 * @param {string} scanId - Unique scan identifier
 * @returns {Promise<string>} GCS URI
 */
async function uploadRawScan(base64Image, scanId) {
    const objectName = `scans/${new Date().toISOString().split('T')[0]}/${scanId}.jpg`;
    return uploadBase64(RAW_BUCKET, objectName, base64Image);
}

/**
 * Upload generated monster image for client serving
 * @param {string} base64Image - Base64-encoded monster image
 * @param {string} monsterId - Monster document ID
 * @returns {Promise<{gcsUri: string, publicUrl: string}>}
 */
async function uploadMonsterImage(base64Image, monsterId) {
    const objectName = `monsters/${monsterId}.jpg`;
    const gcsUri = await uploadBase64(ASSETS_BUCKET, objectName, base64Image);

    // Generate signed URL valid for 7 days
    const [signedUrl] = await getStorage()
        .bucket(ASSETS_BUCKET)
        .file(objectName)
        .getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });

    cloudLogger.log('INFO', 'Monster image uploaded with signed URL', {
        monsterId,
        bucket: ASSETS_BUCKET,
    });

    return { gcsUri, publicUrl: signedUrl };
}

/**
 * Generate a signed URL for an existing GCS object
 * @param {string} bucketName - Bucket name
 * @param {string} objectName - Object path
 * @param {number} expiresInMs - Expiration in milliseconds (default 7 days)
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrl(bucketName, objectName, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
    const [url] = await getStorage()
        .bucket(bucketName)
        .file(objectName)
        .getSignedUrl({
            action: 'read',
            expires: Date.now() + expiresInMs,
        });
    return url;
}

module.exports = {
    uploadRawScan,
    uploadMonsterImage,
    getSignedUrl,
    // Exported for testing
    _internals: { getStorage, RAW_BUCKET, ASSETS_BUCKET, uploadBase64 },
};
