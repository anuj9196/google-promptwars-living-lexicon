import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/loggingService', () => ({
    cloudLogger: { log: vi.fn() },
}));

vi.mock('express-rate-limit', () => ({
    default: vi.fn((config) => {
        const middleware = vi.fn((req, res, next) => next());
        middleware._config = config;
        return middleware;
    }),
}));

describe('rateLimiter middleware', () => {
    it('exports apiLimiter and scanLimiter', async () => {
        const { apiLimiter, scanLimiter } = await import('./rateLimiter');
        expect(apiLimiter).toBeDefined();
        expect(scanLimiter).toBeDefined();
    });

    it('apiLimiter is a function middleware', async () => {
        const { apiLimiter } = await import('./rateLimiter');
        expect(typeof apiLimiter).toBe('function');
    });

    it('scanLimiter is a function middleware', async () => {
        const { scanLimiter } = await import('./rateLimiter');
        expect(typeof scanLimiter).toBe('function');
    });
});
