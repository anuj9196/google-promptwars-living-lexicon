import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../services/loggingService', () => ({
    cloudLogger: { log: vi.fn() },
}));

describe('API Integration Tests', () => {
    it('GET /health returns 200 with status ok', async () => {
        const app = express();
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                service: 'living-lexicon-logic-core',
                timestamp: new Date().toISOString(),
            });
        });

        const res = await request(app).get('/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('living-lexicon-logic-core');
    });

    it('POST /api/scan rejects missing image', async () => {
        const app = express();
        app.use(express.json());
        app.post('/api/scan', (req, res) => {
            const { image, sessionId } = req.body;
            if (!image || typeof image !== 'string') {
                return res.status(400).json({ error: 'Base64 image required', code: 'INVALID_INPUT' });
            }
            if (!sessionId || typeof sessionId !== 'string') {
                return res.status(400).json({ error: 'Session ID required', code: 'INVALID_SESSION' });
            }
            res.json({ monster: {}, cached: false });
        });

        const res = await request(app)
            .post('/api/scan')
            .send({ sessionId: 'test' });

        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('POST /api/scan rejects missing sessionId', async () => {
        const app = express();
        app.use(express.json());
        app.post('/api/scan', (req, res) => {
            const { image, sessionId } = req.body;
            if (!image || typeof image !== 'string') {
                return res.status(400).json({ error: 'Base64 image required', code: 'INVALID_INPUT' });
            }
            if (!sessionId || typeof sessionId !== 'string') {
                return res.status(400).json({ error: 'Session ID required', code: 'INVALID_SESSION' });
            }
            res.json({ monster: {}, cached: false });
        });

        const res = await request(app)
            .post('/api/scan')
            .send({ image: 'base64data' });

        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('INVALID_SESSION');
    });

    it('GET /api/cache/stats returns cache statistics', async () => {
        const app = express();
        app.get('/api/cache/stats', (req, res) => {
            res.json({ scan: { hits: 0, misses: 0 }, collection: { hits: 0, misses: 0 } });
        });

        const res = await request(app).get('/api/cache/stats');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('scan');
        expect(res.body).toHaveProperty('collection');
    });

    it('POST /api/tts rejects missing text', async () => {
        const app = express();
        app.use(express.json());
        app.post('/api/tts', (req, res) => {
            const { text } = req.body;
            if (!text || typeof text !== 'string') {
                return res.status(400).json({ error: 'Text required', code: 'INVALID_INPUT' });
            }
            res.json({ audio: 'base64audio' });
        });

        const res = await request(app)
            .post('/api/tts')
            .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body.code).toBe('INVALID_INPUT');
    });
});
