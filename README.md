# Living Lexicon 2026

> **AI-powered reality scanner** — Point your camera at any real-world object and watch it evolve into a digital creature via Google Vertex AI.

[![Cloud Run](https://img.shields.io/badge/Deployed%20on-Cloud%20Run-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/run)
[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](.github/workflows/deploy.yml)
[![Tests](https://img.shields.io/badge/Tests-60%20Specs-brightgreen?logo=vitest)](vite.config.ts)
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
│  ┌──────────┐ ┌───────────┐ ┌──────────────┐ ┌───────────┐ │
│  │Cloud Run │ │ Artifact  │ │   Secret     │ │ Firebase  │ │
│  │Serverless│ │ Registry  │ │  Manager     │ │ Analytics │ │
│  │Container │ │ Docker    │ │  Secrets     │ │ Events    │ │
│  └──────────┘ └───────────┘ └──────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Google Cloud Services Integration (14 Services)

| # | Service | Usage | File |
|---|---------|-------|------|
| 1 | **Vertex AI (Gemini 1.0 Pro)** | Object analysis, lore generation, structured JSON output with schema enforcement | [`services/vertexAIService.js`](services/vertexAIService.js) |
| 2 | **Vertex AI (Imagen 2)** | Monster visual generation — hyper-realistic 3D renders from text prompts | [`services/vertexAIService.js`](services/vertexAIService.js) |
| 3 | **Vertex AI (Gemini 2.5 Flash TTS)** | Text-to-speech narration of monster lore with Kore voice | [`services/vertexAIService.js`](services/vertexAIService.js) |
| 4 | **Cloud Firestore** | Persistent NoSQL storage — sessions, monster collections, global analytics counters | [`services/firestoreService.js`](services/firestoreService.js) |
| 5 | **Cloud Storage (GCS)** | Dual-bucket architecture — raw scan staging + processed monster image hosting with signed URLs | [`services/storageService.js`](services/storageService.js) |
| 6 | **Cloud Logging** | Structured JSON logging with severity levels, auto-ingested by Cloud Run | [`services/loggingService.js`](services/loggingService.js) |
| 7 | **Cloud Translation API** | Multi-language monster lore translation (10 languages supported) | [`services/translationService.js`](services/translationService.js) |
| 8 | **Cloud Run** | Containerized serverless deployment with auto-scaling (0–10 instances), health checks | [`Dockerfile`](Dockerfile) |
| 9 | **Artifact Registry** | Docker container image storage for Cloud Run deployments | [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) |
| 10 | **Secret Manager** | Secure storage for sensitive credentials (reCAPTCHA secret key) | [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) |
| 11 | **IAM & Service Accounts** | Fine-grained access control — dedicated service account with least-privilege roles | [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) |
| 12 | **Firebase Analytics (GA4)** | Client-side event tracking — scan events, collection views, error rates | [`index.html`](index.html) |
| 13 | **reCAPTCHA Enterprise (v3)** | Invisible bot protection with score-based filtering on scan endpoint | [`middleware/recaptcha.js`](middleware/recaptcha.js) |
| 14 | **Cloud Build** | Alternative CI/CD pipeline (test → build → deploy) | [`cloudbuild.yaml`](cloudbuild.yaml) |

---

## Security Hardening (10-Point Checklist)

| # | Layer | Implementation |
|---|-------|----------------|
| 1 | **Server-side API keys** | All AI inference via service account — zero client-side exposure |
| 2 | **Helmet.js CSP** | Strict Content-Security-Policy with allowlisted domains |
| 3 | **Rate limiting** | 10 req/min general API, 5 req/min scan endpoint |
| 4 | **reCAPTCHA v3** | Score-based bot detection (threshold: 0.5) |
| 5 | **Input validation** | Image size limit (10MB), type checking, session validation |
| 6 | **Compression** | Brotli + gzip via `compression` middleware |
| 7 | **Non-root Docker** | Container runs as `node` user, not root |
| 8 | **Trust proxy** | Cloud Run X-Forwarded-For header support |
| 9 | **Static cache** | Immutable 1-year cache for assets, no-cache for HTML |
| 10 | **Secret Manager** | Sensitive keys stored in GCP Secret Manager, not env vars |

---

## Caching Strategy

| Cache Type | TTL | Purpose |
|------------|-----|---------|
| **Scan dedup** | 5 min | DJB2 hash of image samples → prevents duplicate AI calls |
| **Collection** | 60s | Session collection → reduces Firestore reads |
| **HTTP static** | 1 year | Immutable assets with fingerprinted filenames |

Implementation: [`services/cacheService.js`](services/cacheService.js) — In-memory LRU via `node-cache` with stats endpoint at `/api/cache/stats`.

---

## Testing

```bash
npm test              # Run all 60 tests
npm run test:coverage # Generate coverage report
npm run test:watch    # Watch mode
```

**Test Coverage: 60 specs across 12 test files**

| Category | Files | Tests |
|----------|-------|-------|
| Backend Services | 5 | 31 |
| Middleware | 2 | 6 |
| React Components | 4 | 18 |
| Integration | 1 | 5 |

Coverage: `v8` provider with `lcov`, `html`, and `json-summary` reporters. Thresholds: 70% lines/functions/branches.

---

## Quick Start

### Prerequisites
- Node.js 20+
- GCP project with Vertex AI, Firestore, Cloud Storage APIs enabled
- Service account key with appropriate IAM roles

### Local Development

```bash
npm install

# Create .env (see .env.example)
cp .env.example .env

npm run dev
```

### Deploy to Cloud Run

**Via GitHub Actions (recommended):**
Push to `main` → automatic test → build → deploy pipeline.

**Via Cloud Build:**
```bash
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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scan` | POST | Full AI pipeline — GCS upload → Gemini analysis → Imagen visual → Firestore save |
| `/api/collection/:sessionId` | GET | Monster collection from Firestore with LRU cache |
| `/api/tts` | POST | Text-to-speech via Gemini 2.5 Flash TTS |
| `/api/analytics` | GET | Global statistics from Firestore |
| `/api/cache/stats` | GET | Cache hit/miss telemetry |
| `/health` | GET | Cloud Run health check |

---

## Performance

- **Brotli + gzip compression** on all responses
- **Lazy SDK initialization** — Cloud clients created on first use, not at import (faster cold starts)
- **Immutable static assets** with 1-year cache headers
- **In-memory LRU cache** for scan deduplication and collection reads
- **Preconnect hints** to Google Fonts, GTM, and GCS
- **Lazy loading** of non-critical resources

---

## License

MIT — Built for Google Cloud PromptWars 2026
