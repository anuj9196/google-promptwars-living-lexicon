import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Google Cloud services
vi.mock('@google-cloud/vertexai', () => ({
    VertexAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn(),
        }),
    })),
}));

vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
            generateImages: vi.fn(),
            generateContent: vi.fn(),
        },
    })),
    Modality: { AUDIO: 'AUDIO' },
}));

vi.mock('./loggingService', () => ({
    cloudLogger: { log: vi.fn() },
}));

describe('vertexAIService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('retry', () => {
        it('succeeds on first attempt', async () => {
            const { retry } = await import('./vertexAIService');
            const fn = vi.fn().mockResolvedValue('ok');
            const result = await retry(fn, 3, 10);
            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('retries on transient failure then succeeds', async () => {
            const { retry } = await import('./vertexAIService');
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('timeout'))
                .mockResolvedValueOnce('recovered');
            const result = await retry(fn, 3, 10);
            expect(result).toBe('recovered');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('exhausts retries and throws', async () => {
            const { retry } = await import('./vertexAIService');
            const fn = vi.fn().mockRejectedValue(new Error('permanent'));
            await expect(retry(fn, 2, 10)).rejects.toThrow('permanent');
            expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
        });
    });

    describe('generateTTS', () => {
        it('returns null on error', async () => {
            vi.resetModules();
            vi.mock('@google-cloud/vertexai', () => ({
                VertexAI: vi.fn(() => ({ getGenerativeModel: vi.fn() })),
            }));
            vi.mock('@google/genai', () => ({
                GoogleGenAI: vi.fn(() => ({
                    models: {
                        generateImages: vi.fn(),
                        generateContent: vi.fn().mockRejectedValue(new Error('TTS down')),
                    },
                })),
                Modality: { AUDIO: 'AUDIO' },
            }));
            vi.mock('./loggingService', () => ({
                cloudLogger: { log: vi.fn() },
            }));

            const mod = await import('./vertexAIService');
            const result = await mod.generateTTS('test text');
            expect(result).toBeNull();
        });
    });

    describe('_internals', () => {
        it('exports expected constants', async () => {
            const { _internals } = await import('./vertexAIService');
            expect(_internals.GEMINI_MODEL).toBe('gemini-2.0-flash');
            expect(_internals.IMAGEN_MODEL).toBe('imagen-3.0-generate-001');
            expect(_internals.MONSTER_SCHEMA).toBeDefined();
            expect(_internals.MONSTER_SCHEMA.required).toContain('name');
        });
    });
});
