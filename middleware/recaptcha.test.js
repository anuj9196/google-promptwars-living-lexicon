import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/loggingService', () => ({
    cloudLogger: { log: vi.fn() },
}));

describe('recaptcha middleware', () => {
    let req, res, next;

    beforeEach(() => {
        vi.clearAllMocks();
        req = { body: {}, ip: '127.0.0.1' };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };
        next = vi.fn();
    });

    it('skips verification when no secret is configured', async () => {
        const { verifyRecaptcha } = await import('./recaptcha');
        await verifyRecaptcha(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('calls next (passthrough) when no secret', async () => {
        const { verifyRecaptcha } = await import('./recaptcha');
        req.body.recaptchaToken = 'valid-token';
        await verifyRecaptcha(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('exports verifyRecaptcha function', async () => {
        const mod = await import('./recaptcha');
        expect(mod.verifyRecaptcha).toBeDefined();
        expect(typeof mod.verifyRecaptcha).toBe('function');
    });
});
