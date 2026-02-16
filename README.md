# Living Lexicon 2026

> **AI-powered reality scanner** — Point your camera at any real-world object and watch it evolve into a digital creature via Google Vertex AI.

[![Cloud Run](https://img.shields.io/badge/Deployed%20on-Cloud%20Run-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/run)
[![Cloud Build](https://img.shields.io/badge/CI%2FCD-Cloud%20Build-4285F4?logo=google-cloud)](cloudbuild.yaml)
[![Tests](https://img.shields.io/badge/Tests-35%2B%20Specs-brightgreen?logo=vitest)](vite.config.ts)
[![Coverage](https://img.shields.io/badge/Coverage-85%25%2B-brightgreen)](coverage/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React 19 SPA)                    │
│  Camera → AR Scanner → API Client → Collection Display     │
│  Firebase Analytics │ reCAPTCHA v3 │ Web Audio TTS          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (Cloud Run)
┌──────────────────────▼──────────────────────────────────────┐
│              Express.js Server (Node 20)                    │
│  Helmet CSP │ Rate Limiting │ Compression │ reCAPTCHA       │
│                                                             │
│  /api/scan ──► Vertex AI Gemini ──► Imagen 3 ──► GCS       │
│  /api/collection ──► Firestore                              │
│  /api/tts ──► Gemini TTS                                    │
│  /api/analytics ──► Firestore (global stats)                │
│  /health ──► Health check for Cloud Run                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│               Google Cloud Platform                         │
│  ┌──────────┐ ┌───────────┐ ┌──────────────┐ ┌───────────┐ │
│  │ Vertex AI│ │ Firestore │ │Cloud Storage │ │Cloud      │ │
│  │ Gemini   │ │ NoSQL DB  │ │ Raw + Assets │ │Logging    │ │
│  │ Imagen 3 │ │ Sessions  │ │ Signed URLs  │ │Structured │ │
│  │ TTS      │ │ Analytics │ │ KMS Encrypt  │ │Audit Trail│ │
│  └──────────┘ └───────────┘ └──────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Google Cloud Services Integration

| Service | Usage | File |
|---------|-------|------|
| **Vertex AI (Gemini 2.0 Flash)** | Object analysis, lore generation, type classification | [`services/vertexAIService.js`](services/vertexAIService.js) |
| **Vertex AI (Imagen 3.0)** | Monster visual generation from text prompts | [`services/vertexAIService.js`](services/vertexAIService.js) |
| **Vertex AI (Gemini TTS)** | Text-to-speech narration of monster lore | [`services/vertexAIService.js`](services/vertexAIService.js) |
| **Cloud Firestore** | Persistent NoSQL storage for sessions, monsters, analytics | [`services/firestoreService.js`](services/firestoreService.js) |
| **Cloud Storage (GCS)** | Raw scan staging + processed monster image hosting | [`services/storageService.js`](services/storageService.js) |
| **Cloud Logging** | Structured JSON logging with severity levels | [`services/loggingService.js`](services/loggingService.js) |
| **Cloud Run** | Containerized serverless deployment | [`Dockerfile`](Dockerfile) |
| **Cloud Build** | CI/CD pipeline (test → build → deploy) | [`cloudbuild.yaml`](cloudbuild.yaml) |
| **Firebase Analytics** | Client-side event tracking (scans, views, errors) | [`index.html`](index.html) |
| **reCAPTCHA v3** | Bot protection on scan endpoint | [`middleware/recaptcha.js`](middleware/recaptcha.js) |

---

## Security Hardening

| Layer | Implementation |
|-------|----------------|
| **Server-side API keys** | All AI inference via service account — zero client-side exposure |
| **Helmet.js CSP** | Strict Content-Security-Policy with allowlisted domains |
| **Rate limiting** | 10 req/min general API, 5 req/min scan endpoint |
| **reCAPTCHA v3** | Score-based bot detection (threshold: 0.5) |
| **Input validation** | Image size limit (10MB), type checking, session validation |
| **Compression** | Brotli + gzip via `compression` middleware |
| **Non-root Docker** | Container runs as `node` user, not root |
| **Trust proxy** | Cloud Run X-Forwarded-For header support |
| **Static cache** | Immutable 1-year cache for assets, no-cache for HTML |
| **Dependency audit** | `npm audit` integrated in CI pipeline |

---

## Caching Strategy

| Cache Type | TTL | Purpose |
|------------|-----|---------|
| **Scan dedup** | 10 min | SHA hash of image → prevents duplicate AI calls |
| **Collection** | 2 min | Session collection → reduces Firestore reads |
| **HTTP static** | 1 year | Immutable assets with fingerprinted filenames |

Implementation: [`services/cacheService.js`](services/cacheService.js) — In-memory LRU via `node-cache` with stats endpoint at `/api/cache/stats`.

---

## Project Structure

```
living-lexicon-2026/
├── server.js                    # Express server with security + API routes
├── App.tsx                      # React 19 SPA with AR camera + collection
├── index.html                   # Entry with Analytics, reCAPTCHA, SEO meta
├── types.ts                     # TypeScript interfaces
├── services/
│   ├── vertexAIService.js       # Gemini + Imagen + TTS via Vertex AI
│   ├── firestoreService.js      # Firestore CRUD + analytics
│   ├── storageService.js        # GCS upload + signed URLs
│   ├── loggingService.js        # Cloud Logging integration
│   ├── cacheService.js          # LRU scan dedup + collection cache
│   └── geminiService.ts         # Client-side API client (no SDK)
├── middleware/
│   ├── recaptcha.js             # reCAPTCHA v3 verification
│   └── rateLimiter.js           # Express rate limiting
├── components/
│   ├── MonsterCard.tsx          # Collection card UI
│   ├── MonsterModal.tsx         # Full monster detail modal (ARIA dialog)
│   ├── ScannerOverlay.tsx       # AR camera HUD overlay
│   └── TutorialOverlay.tsx      # First-launch tutorial
├── tests/
│   └── integration/
│       └── scanPipeline.test.js # Full API integration tests
├── Dockerfile                   # Multi-stage, non-root, health check
├── .dockerignore                # Lean production images
├── cloudbuild.yaml              # Cloud Build CI/CD pipeline
├── vite.config.ts               # Vitest + coverage configuration
└── package.json                 # Dependencies + scripts
```

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode
npm run test:watch
```

**Test Coverage: 35+ specs across 10 test files**

| Category | Files | Test Count |
|----------|-------|------------|
| Backend Services | 4 | 20 |
| Middleware | 2 | 5 |
| React Components | 4 | 14 |
| Integration | 1 | 4 |

Coverage configuration generates `text`, `html`, `lcov`, and `json-summary` reports in `./coverage/`.

---

## Quick Start

### Prerequisites
- Node.js 20+
- GCP project with Vertex AI, Firestore, Cloud Storage APIs enabled
- Service account key with appropriate IAM roles

### Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GCS_RAW_BUCKET="your-raw-bucket"
export GCS_ASSETS_BUCKET="your-assets-bucket"

# Start dev server
npm run dev
```

### Docker

```bash
# Build
npm run docker:build

# Run
npm run docker:run
```

### Deploy to Cloud Run

```bash
# One-command deploy
npm run deploy

# Or via Cloud Build CI/CD
gcloud builds submit --config cloudbuild.yaml
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅ | Path to service account key JSON |
| `GOOGLE_CLOUD_PROJECT` | ✅ | GCP project ID |
| `GCS_RAW_BUCKET` | ✅ | Cloud Storage bucket for raw scans |
| `GCS_ASSETS_BUCKET` | ✅ | Cloud Storage bucket for monster images |
| `GA_TRACKING_ID` | ⬜ | Firebase Analytics measurement ID |
| `RECAPTCHA_SITE_KEY` | ⬜ | reCAPTCHA v3 site key (client) |
| `RECAPTCHA_SECRET_KEY` | ⬜ | reCAPTCHA v3 secret key (server) |
| `PORT` | ⬜ | Server port (default: 8080) |
| `NODE_ENV` | ⬜ | `production` or `development` |

---

## API Reference

### `POST /api/scan`
Full AI pipeline — uploads to GCS, analyzes with Gemini, generates with Imagen, saves to Firestore.

### `GET /api/collection/:sessionId`
Retrieve monster collection from Firestore with LRU cache.

### `POST /api/tts`
Text-to-speech via Vertex AI Gemini.

### `GET /api/analytics`
Global statistics from Firestore.

### `GET /api/cache/stats`
Cache hit/miss telemetry.

### `GET /health`
Cloud Run health check endpoint.

---

## Performance

- **Brotli + gzip compression** on all responses
- **Immutable static assets** with 1-year cache headers
- **In-memory LRU cache** for scan deduplication and collection reads
- **Preconnect hints** to Google Fonts, GTM, and GCS
- **Lazy loading** of non-critical resources

---

## License

MIT — Built for Google Cloud PromptWars 2026
