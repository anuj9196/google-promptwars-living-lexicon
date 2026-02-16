import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./loggingService', () => ({
    cloudLogger: { log: vi.fn() },
}));

describe('cacheService', () => {
    beforeEach(async () => {
        vi.resetModules();
    });

    it('returns undefined for uncached scan', async () => {
        const mod = await import('./cacheService');
        mod.flushAll();
        const result = mod.getCachedScan('some-new-image-base64');
        expect(result).toBeUndefined();
    });

    it('caches and retrieves a scan result', async () => {
        const mod = await import('./cacheService');
        mod.flushAll();
        const monster = { name: 'TestMonster', id: '123' };
        mod.setCachedScan('my-image-data', monster);

        const result = mod.getCachedScan('my-image-data');
        expect(result).toEqual(monster);
    });

    it('generates deterministic keys for same image', async () => {
        const mod = await import('./cacheService');
        const key1 = mod._internals.generateScanKey('identical-image');
        const key2 = mod._internals.generateScanKey('identical-image');
        expect(key1).toBe(key2);
    });

    it('returns undefined for uncached collection', async () => {
        const mod = await import('./cacheService');
        mod.flushAll();
        const result = mod.getCachedCollection('session-xyz');
        expect(result).toBeUndefined();
    });

    it('caches and retrieves a collection', async () => {
        const mod = await import('./cacheService');
        mod.flushAll();
        const monsters = [{ name: 'A' }, { name: 'B' }];
        mod.setCachedCollection('session-1', monsters);

        const result = mod.getCachedCollection('session-1');
        expect(result).toEqual(monsters);
    });

    it('invalidates a collection cache', async () => {
        const mod = await import('./cacheService');
        mod.flushAll();
        mod.setCachedCollection('session-2', [{ name: 'C' }]);
        mod.invalidateCollection('session-2');

        expect(mod.getCachedCollection('session-2')).toBeUndefined();
    });

    it('returns stats with hit/miss counts', async () => {
        const mod = await import('./cacheService');
        const stats = mod.getStats();
        expect(stats).toHaveProperty('scan');
        expect(stats).toHaveProperty('collection');
    });

    it('flushAll clears both caches', async () => {
        const mod = await import('./cacheService');
        mod.setCachedScan('img', { name: 'X' });
        mod.setCachedCollection('sess', [{ name: 'Y' }]);

        mod.flushAll();

        expect(mod.getCachedScan('img')).toBeUndefined();
        expect(mod.getCachedCollection('sess')).toBeUndefined();
    });

    it('produces consistent hashes', async () => {
        const mod = await import('./cacheService');
        const h1 = mod._internals.hashString('hello');
        const h2 = mod._internals.hashString('hello');
        expect(h1).toBe(h2);
    });

    it('produces different hashes for different inputs', async () => {
        const mod = await import('./cacheService');
        const h1 = mod._internals.hashString('hello');
        const h2 = mod._internals.hashString('world');
        expect(h1).not.toBe(h2);
    });
});
