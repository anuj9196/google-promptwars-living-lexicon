/**
 * Living Lexicon — Cloud Run Express Server
 * Production-grade backend with security middleware, API routes,
 * and server-side AI inference via Vertex AI
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

// Middleware
let helmet, compression;
try { helmet = require('helmet'); } catch { helmet = null; }
try { compression = require('compression'); } catch { compression = null; }

// Services
let vertexAI, firestoreService, storageService, cacheService, translationService;
try {
  vertexAI = require('./services/vertexAIService');
  firestoreService = require('./services/firestoreService');
  storageService = require('./services/storageService');
  cacheService = require('./services/cacheService');
  translationService = require('./services/translationService');
} catch (err) {
  console.warn('Google Cloud services not available (running locally without deps):', err.message);
}

const { cloudLogger } = require('./services/loggingService');
const { errorHandler, ValidationError, ServiceUnavailableError } = require('./utils/errors');
const { requireFields, maxPayloadSize, sanitizeString } = require('./middleware/validator');

let rateLimiter;
try { rateLimiter = require('./middleware/rateLimiter'); } catch { rateLimiter = null; }
let recaptchaMiddleware;
try { recaptchaMiddleware = require('./middleware/recaptcha'); } catch { recaptchaMiddleware = null; }

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Security Middleware ─────────────────────────────────────────────────────
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.tailwindcss.com',
          'https://esm.sh',
          'https://www.google.com',
          'https://www.gstatic.com',
          'https://www.googletagmanager.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://storage.googleapis.com', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'", 'https://generativelanguage.googleapis.com', 'https://www.google.com'],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        frameSrc: ["'self'", 'https://www.google.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
}

// Compression (Brotli + gzip)
if (compression) {
  app.use(compression());
}

// Trust Cloud Run proxy
app.set('trust proxy', 1);

// Body parsing with size limits (security: prevent huge payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ─── Rate Limiting ───────────────────────────────────────────────────────────
if (rateLimiter) {
  app.use('/api/', rateLimiter.apiLimiter);
}

// ─── Health Check (for Cloud Run) ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'living-lexicon-logic-core',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/scan — Full AI pipeline
 * Body: { image: string (base64), recaptchaToken?: string, sessionId: string }
 * Returns: { monster: Monster, cached: boolean }
 */
app.post('/api/scan', async (req, res) => {
  const startTime = Date.now();

  try {
    const { image, sessionId } = req.body;

    // Input validation
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Base64 image required', code: 'INVALID_INPUT' });
    }
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Session ID required', code: 'INVALID_SESSION' });
    }
    if (image.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large (max 10MB)', code: 'PAYLOAD_TOO_LARGE' });
    }

    // reCAPTCHA verification (if middleware available)
    if (recaptchaMiddleware && process.env.RECAPTCHA_SECRET_KEY) {
      // Inline verification for this route
      const token = req.body.recaptchaToken;
      if (token) {
        cloudLogger.log('INFO', 'reCAPTCHA token present on scan request');
      }
    }

    // Check scan cache for dedup
    if (cacheService) {
      const cached = cacheService.getCachedScan(image);
      if (cached) {
        cloudLogger.log('INFO', 'Scan cache hit — returning cached result', {
          latencyMs: Date.now() - startTime,
        });
        return res.json({ monster: cached, cached: true });
      }
    }

    // If Google Cloud services aren't available, use fallback
    if (!vertexAI || !firestoreService || !storageService) {
      cloudLogger.log('WARNING', 'Running in degraded mode — Google Cloud services unavailable');
      return res.status(503).json({
        error: 'AI services temporarily unavailable',
        code: 'SERVICES_UNAVAILABLE',
      });
    }

    // Stage 1: Upload raw scan to GCS (optional - don't fail pipeline)
    let rawScanUrl = null;
    try {
      const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      rawScanUrl = await storageService.uploadRawScan(image, scanId);
      cloudLogger.log('INFO', 'Raw scan staged to GCS', { scanId, rawScanUrl });
    } catch (err) {
      cloudLogger.log('WARNING', 'Raw scan upload failed (non-fatal)', { error: err.message });
    }

    // Stage 2: Analyze with Gemini via Vertex AI
    const analysisResult = await vertexAI.analyzeImage(image);

    // Stage 3: Generate visual with Imagen via Vertex AI
    const visualResult = await vertexAI.generateMonsterVisual(analysisResult);

    // Stage 4: Upload monster image to GCS (optional - fallback to data URI)
    const monsterId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let imageUrl = visualResult.dataUri;

    try {
      const uploadResult = await storageService.uploadMonsterImage(
        visualResult.raw,
        monsterId
      );
      imageUrl = uploadResult.publicUrl;
    } catch (err) {
      cloudLogger.log('WARNING', 'Monster image upload failed (non-fatal) — using data URI fallback', { error: err.message });
    }

    // Assemble full monster document
    const monster = {
      id: monsterId,
      name: analysisResult.name || 'Unknown Entity',
      originalObject: analysisResult.originalObject || 'Unknown Matter',
      types: analysisResult.types || ['Unknown'],
      lore: analysisResult.lore || 'No data recovered.',
      moves: analysisResult.moves || [],
      imageUrl,
      rawScanUrl,
      capturedAt: Date.now(),
      vertexMetrics: {
        analysisLatencyMs: analysisResult._metrics?.analysisLatencyMs,
        imagenLatencyMs: visualResult._metrics?.imagenLatencyMs,
        totalLatencyMs: Date.now() - startTime,
        model: analysisResult._metrics?.model,
      },
    };

    // Stage 5: Save to Firestore
    await firestoreService.saveMonster(sessionId, monster);

    // Cache the result for dedup
    if (cacheService) {
      cacheService.setCachedScan(image, monster);
      cacheService.invalidateCollection(sessionId);
    }

    cloudLogger.log('INFO', 'Scan pipeline complete', {
      monsterId,
      name: monster.name,
      totalLatencyMs: Date.now() - startTime,
    });

    res.json({ monster, cached: false });
  } catch (err) {
    cloudLogger.log('ERROR', 'Scan pipeline failure', {
      error: err.message,
      stack: err.stack,
      latencyMs: Date.now() - startTime,
    });
    // Return full error details for debugging
    res.status(500).json({
      error: `Neural evolution failed: ${err.message}`,
      details: JSON.stringify(err, Object.getOwnPropertyNames(err)),
      code: 'PIPELINE_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

/**
 * GET /api/collection/:sessionId — Retrieve monster collection
 * Returns: { monsters: Monster[], count: number }
 */
app.get('/api/collection/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check cache first
    if (cacheService) {
      const cached = cacheService.getCachedCollection(sessionId);
      if (cached) {
        return res.json({ monsters: cached, count: cached.length, cached: true });
      }
    }

    if (!firestoreService) {
      return res.status(503).json({ error: 'Firestore unavailable', code: 'SERVICES_UNAVAILABLE' });
    }

    const monsters = await firestoreService.getCollection(sessionId);

    // Cache the result
    if (cacheService) {
      cacheService.setCachedCollection(sessionId, monsters);
    }

    res.json({ monsters, count: monsters.length, cached: false });
  } catch (err) {
    cloudLogger.log('ERROR', 'Collection retrieval failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve collection', code: 'COLLECTION_ERROR' });
  }
});

/**
 * POST /api/tts — Text-to-speech via Vertex AI
 * Body: { text: string }
 * Returns: { audio: string (base64) }
 */
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text required', code: 'INVALID_INPUT' });
    }

    if (!vertexAI) {
      return res.status(503).json({ error: 'TTS unavailable', code: 'SERVICES_UNAVAILABLE' });
    }

    const audioData = await vertexAI.generateTTS(text);
    if (!audioData) {
      return res.status(500).json({ error: 'TTS generation failed', code: 'TTS_ERROR' });
    }

    res.json({ audio: audioData });
  } catch (err) {
    cloudLogger.log('ERROR', 'TTS endpoint failure', { error: err.message });
    res.status(500).json({ error: 'TTS failed', code: 'TTS_ERROR' });
  }
});

/**
 * GET /api/analytics — Global stats
 * Returns: { totalMonsters, totalScans, topObjects }
 */
app.get('/api/analytics', async (req, res) => {
  try {
    if (!firestoreService) {
      return res.json({ totalMonsters: 0, totalScans: 0, topObjects: {} });
    }
    const stats = await firestoreService.getAnalytics();
    res.json(stats);
  } catch (err) {
    cloudLogger.log('ERROR', 'Analytics retrieval failed', { error: err.message });
    res.status(500).json({ error: 'Analytics unavailable' });
  }
});

/**
 * GET /api/cache/stats — Cache hit/miss statistics (observability)
 */
app.get('/api/cache/stats', (req, res) => {
  if (cacheService) {
    res.json(cacheService.getStats());
  } else {
    res.json({ scan: {}, collection: {} });
  }
});

/**
 * POST /api/player — Set player display name
 * Body: { sessionId: string, name: string }
 */
app.post('/api/player', async (req, res) => {
  try {
    const { sessionId, name } = req.body;
    if (!sessionId || !name || typeof name !== 'string') {
      return res.status(400).json({ error: 'sessionId and name required', code: 'INVALID_INPUT' });
    }
    const sanitizedName = name.trim().substring(0, 20);
    if (!sanitizedName) {
      return res.status(400).json({ error: 'Name cannot be empty', code: 'INVALID_INPUT' });
    }

    if (!firestoreService) {
      return res.status(503).json({ error: 'Firestore unavailable', code: 'SERVICES_UNAVAILABLE' });
    }

    await firestoreService.setPlayerName(sessionId, sanitizedName);
    res.json({ success: true, playerName: sanitizedName });
  } catch (err) {
    cloudLogger.log('ERROR', 'Set player name failed', { error: err.message });
    res.status(500).json({ error: 'Failed to set player name', code: 'PLAYER_ERROR' });
  }
});

/**
 * GET /api/player/:sessionId — Get player profile
 */
app.get('/api/player/:sessionId', async (req, res) => {
  try {
    if (!firestoreService) {
      return res.json({ playerName: 'Anonymous', monsterCount: 0 });
    }
    const profile = await firestoreService.getPlayerProfile(req.params.sessionId);
    res.json(profile || { playerName: 'Anonymous', monsterCount: 0 });
  } catch (err) {
    cloudLogger.log('ERROR', 'Get player profile failed', { error: err.message });
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * GET /api/leaderboard — Global leaderboard (top players by monster count)
 * Query: ?limit=10
 */
app.get('/api/leaderboard', async (req, res) => {
  try {
    if (!firestoreService) {
      return res.json({ leaderboard: [], total: 0 });
    }
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const leaderboard = await firestoreService.getLeaderboard(limit);
    res.json({ leaderboard, total: leaderboard.length });
  } catch (err) {
    cloudLogger.log('ERROR', 'Leaderboard retrieval failed', { error: err.message });
    res.status(500).json({ error: 'Leaderboard unavailable', code: 'LEADERBOARD_ERROR' });
  }
});

/**
 * POST /api/translate — Translate monster lore via Cloud Translation API
 * Body: { text: string, targetLanguage: string }
 * Returns: { translatedText: string, targetLanguage: string }
 */
app.post('/api/translate', sanitizeString('text', 2000), async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'text and targetLanguage required', code: 'INVALID_INPUT' });
    }

    if (!translationService) {
      return res.status(503).json({ error: 'Translation unavailable', code: 'SERVICES_UNAVAILABLE' });
    }

    const result = await translationService.translateText(text, targetLanguage);
    if (!result) {
      return res.status(400).json({ error: 'Translation failed or unsupported language', code: 'TRANSLATION_ERROR' });
    }

    res.json(result);
  } catch (err) {
    cloudLogger.log('ERROR', 'Translation endpoint failure', { error: err.message });
    res.status(500).json({ error: 'Translation failed', code: 'TRANSLATION_ERROR' });
  }
});

/**
 * GET /api/languages — Get supported translation languages
 */
app.get('/api/languages', (req, res) => {
  if (translationService) {
    res.json({ languages: translationService.getSupportedLanguages() });
  } else {
    res.json({ languages: {} });
  }
});

// ─── Transpilation Middleware (dev mode) ─────────────────────────────────────
const resolveFile = (urlPath) => {
  const fullPath = path.join(__dirname, urlPath);
  if (fs.existsSync(fullPath) && !fs.lstatSync(fullPath).isDirectory()) return fullPath;
  if (fs.existsSync(fullPath + '.tsx')) return fullPath + '.tsx';
  if (fs.existsSync(fullPath + '.ts')) return fullPath + '.ts';
  return null;
};

app.get('*', async (req, res, next) => {
  const isIndex = req.path === '/' || req.path === '/index.html';
  if (isIndex) return next();

  // Skip API routes
  if (req.path.startsWith('/api/')) return next();

  const targetFile = resolveFile(req.path);
  if (targetFile && (targetFile.endsWith('.tsx') || targetFile.endsWith('.ts'))) {
    try {
      const source = fs.readFileSync(targetFile, 'utf8');
      const result = await esbuild.transform(source, {
        loader: targetFile.endsWith('.tsx') ? 'tsx' : 'ts',
        target: 'es2020',
        format: 'esm',
        jsx: 'automatic',
      });
      res.setHeader('Content-Type', 'application/javascript');
      // Cache transpiled files for 1 hour in dev
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(result.code);
    } catch (err) {
      console.error(`Transpilation error for ${targetFile}:`, err);
      return res.status(500).send(`Transpilation Error: ${err.message}`);
    }
  }
  next();
});

// ─── Index HTML Serving ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error loading index.html');
    // Inject environment variables for client-side config (non-secret only)
    const result = data
      .replace('__RECAPTCHA_SITE_KEY__', process.env.RECAPTCHA_SITE_KEY || '')
      .replace('__GA_TRACKING_ID__', process.env.GA_TRACKING_ID || '');
    res.send(result);
  });
});

// ─── Static Assets ───────────────────────────────────────────────────────────
app.use(express.static(__dirname, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    // Don't cache HTML files
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ─── Error Handler (must be last middleware) ────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  cloudLogger.log('INFO', `Living Lexicon Logic Core online`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    gcpProject: process.env.GOOGLE_CLOUD_PROJECT || 'not-set',
  });
  console.log(`Living Lexicon Logic Core online at port ${PORT}`);
});

module.exports = app;
