import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally — default to returning ok for background log calls
const mockFetch = vi.fn().mockImplementation(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
);
globalThis.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockLocalStorage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete mockLocalStorage[key]; }),
  },
  writable: true,
});

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-1234'),
  },
  writable: true,
});

import { analyzeImage, fetchCollection, trackEvent, getSessionId, cloudLogger } from './geminiService';

describe('geminiService (API Client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  });

  describe('analyzeImage', () => {
    it('calls /api/scan and returns monster data', async () => {
      const mockMonster = {
        id: 'monster-1',
        name: 'CyberCat',
        originalObject: 'Laptop',
        types: ['Digital', 'Electric'],
        lore: 'A high-speed feline.',
        moves: [],
        imageUrl: 'https://example.com/cat.jpg',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ monster: mockMonster, cached: false }),
      });

      const result = await analyzeImage('base64data');
      expect(result.name).toBe('CyberCat');
      expect(result.originalObject).toBe('Laptop');
      expect(result.imageUrl).toBe('https://example.com/cat.jpg');

      // Verify /api/scan was called  
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/scan',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      await expect(analyzeImage('base64data')).rejects.toThrow('Server error');
    });

    it('includes sessionId in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ monster: { name: 'Test' }, cached: false }),
      });

      await analyzeImage('base64data');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.sessionId).toBeDefined();
      expect(body.image).toBe('base64data');
    });
  });

  describe('fetchCollection', () => {
    it('fetches collection from server', async () => {
      const monsters = [{ id: '1', name: 'TestA' }, { id: '2', name: 'TestB' }];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ monsters, count: 2 }),
      });

      const result = await fetchCollection();
      expect(result).toEqual(monsters);
    });

    it('returns empty array on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchCollection();
      expect(result).toEqual([]);
    });
  });

  describe('getSessionId', () => {
    it('generates a new UUID if no session exists', () => {
      const sessionId = getSessionId();
      expect(sessionId).toBe('test-uuid-1234');
    });

    it('returns existing session from localStorage', () => {
      mockLocalStorage['lexicon_session_id'] = 'existing-session';
      const sessionId = getSessionId();
      expect(sessionId).toBe('existing-session');
    });
  });

  describe('cloudLogger', () => {
    it('logs structured JSON to console', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      // Reset fetch mock for the log call
      mockFetch.mockResolvedValueOnce({ ok: true });

      cloudLogger.log('INFO', 'Test message', { foo: 'bar' });

      expect(consoleSpy).toHaveBeenCalledOnce();
      const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logOutput.severity).toBe('INFO');
      expect(logOutput.message).toBe('Test message');
      expect(logOutput.foo).toBe('bar');
      expect(logOutput.service).toBe('living-lexicon-client');

      consoleSpy.mockRestore();
    });
  });

  describe('trackEvent', () => {
    it('calls gtag when available', () => {
      const mockGtag = vi.fn();
      (globalThis as any).gtag = mockGtag;

      trackEvent('test_event', { key: 'value' });

      expect(mockGtag).toHaveBeenCalledWith('event', 'test_event', expect.objectContaining({
        key: 'value',
        app_name: 'living-lexicon',
      }));

      delete (globalThis as any).gtag;
    });

    it('does not throw when gtag is unavailable', () => {
      expect(() => trackEvent('test_event')).not.toThrow();
    });
  });
});
