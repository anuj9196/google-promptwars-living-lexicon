import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @google-cloud/storage
vi.mock('@google-cloud/storage', () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockGetSignedUrl = vi.fn().mockResolvedValue(['https://storage.googleapis.com/signed-url']);
    const mockFile = vi.fn().mockReturnValue({ save: mockSave, getSignedUrl: mockGetSignedUrl });
    const mockBucket = vi.fn().mockReturnValue({ file: mockFile });

    return {
        Storage: vi.fn().mockImplementation(() => ({
            bucket: mockBucket,
        })),
        __mocks__: { mockSave, mockGetSignedUrl, mockFile, mockBucket },
    };
});

vi.mock('./loggingService', () => ({
    cloudLogger: { log: vi.fn() },
}));

describe('storageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exports expected functions', async () => {
        const mod = await import('./storageService');
        expect(mod.uploadRawScan).toBeDefined();
        expect(mod.uploadMonsterImage).toBeDefined();
        expect(mod.getSignedUrl).toBeDefined();
        expect(typeof mod.uploadRawScan).toBe('function');
        expect(typeof mod.uploadMonsterImage).toBe('function');
    });

    it('uploadRawScan returns a promise', async () => {
        const mod = await import('./storageService');
        const result = mod.uploadRawScan('base64imagedata', 'scan_001');
        expect(result).toBeInstanceOf(Promise);
    });

    it('uploadMonsterImage returns a promise', async () => {
        const mod = await import('./storageService');
        const result = mod.uploadMonsterImage('monsterimagebase64', 'monster_001');
        expect(result).toBeInstanceOf(Promise);
    });
});
