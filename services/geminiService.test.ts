
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeImage } from './geminiService';

// Fix: Use globalThis to access process in the test environment to resolve "Cannot find name 'global'"
(globalThis as any).process = { env: { API_KEY: 'test-key' } };

// Mock the @google/genai SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn()
      }
    })),
    Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', NUMBER: 'NUMBER' },
    Modality: { AUDIO: 'AUDIO' }
  };
});

import { GoogleGenAI } from '@google/genai';

describe('geminiService: analyzeImage', () => {
  const mockGenAI = new GoogleGenAI({ apiKey: 'test' });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully parses valid AI JSON response', async () => {
    const mockResponse = {
      text: JSON.stringify({
        name: 'CyberCat',
        originalObject: 'Laptop',
        types: ['Digital', 'Electric'],
        lore: 'A high-speed feline.',
        moves: []
      })
    };

    (mockGenAI.models.generateContent as any).mockResolvedValue(mockResponse);

    const result = await analyzeImage('base64data');
    expect(result.name).toBe('CyberCat');
    expect(result.originalObject).toBe('Laptop');
  });

  it('triggers retry logic on transient failures', async () => {
    const mockGenerateContent = mockGenAI.models.generateContent as any;
    
    // Fail once, then succeed
    mockGenerateContent
      .mockRejectedValueOnce(new Error('API Down'))
      .mockResolvedValueOnce({
        text: JSON.stringify({ name: 'ResilientBot', originalObject: 'Stone', types: ['Rock'], lore: 'Test', moves: [] })
      });

    const result = await analyzeImage('base64data');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.name).toBe('ResilientBot');
  });

  it('throws error after exhausting retries', async () => {
    const mockGenerateContent = mockGenAI.models.generateContent as any;
    mockGenerateContent.mockRejectedValue(new Error('Permanent Failure'));

    await expect(analyzeImage('base64data')).rejects.toThrow('Permanent Failure');
    expect(mockGenerateContent).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });
});
