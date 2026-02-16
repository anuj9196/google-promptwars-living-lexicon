import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore
vi.mock('@google-cloud/firestore', () => {
    const mockGet = vi.fn().mockResolvedValue({ exists: false });
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet, update: mockUpdate });
    const mockOrderBy = vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ forEach: vi.fn() }) });
    const mockCollectionFn = vi.fn().mockReturnValue({
        doc: mockDoc,
        orderBy: mockOrderBy,
    });

    return {
        Firestore: vi.fn().mockImplementation(() => ({
            collection: mockCollectionFn,
            doc: mockDoc,
        })),
        FieldValue: {
            serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
            increment: vi.fn((n) => `INCREMENT_${n}`),
        },
        __mocks__: { mockGet, mockSet, mockUpdate, mockDoc, mockCollectionFn },
    };
});

vi.mock('./loggingService', () => ({
    cloudLogger: { log: vi.fn() },
}));

describe('firestoreService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exports expected functions', async () => {
        const mod = await import('./firestoreService');
        expect(mod.saveMonster).toBeDefined();
        expect(mod.getCollection).toBeDefined();
        expect(mod.ensureSession).toBeDefined();
        expect(mod.getAnalytics).toBeDefined();
        expect(typeof mod.saveMonster).toBe('function');
        expect(typeof mod.getCollection).toBe('function');
    });

    it('saveMonster is an async function', async () => {
        const mod = await import('./firestoreService');
        const result = mod.saveMonster('session-1', { id: 'test', name: 'Test' });
        // Should return a promise
        expect(result).toBeInstanceOf(Promise);
    });

    it('getCollection is an async function', async () => {
        const mod = await import('./firestoreService');
        const result = mod.getCollection('session-1');
        expect(result).toBeInstanceOf(Promise);
    });
});
