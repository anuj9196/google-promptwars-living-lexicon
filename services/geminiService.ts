
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Monster } from "../types";

/**
 * Enterprise Structured Logging Utility
 * Formats logs for Google Cloud Logging (Stackdriver)
 */
export const cloudLogger = {
  log: (severity: 'INFO' | 'WARNING' | 'ERROR', message: string, payload: object = {}) => {
    const logEntry = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      service: "living-lexicon-logic-core",
      ...payload,
    };
    console.log(JSON.stringify(logEntry)); // Direct output for Cloud Logging ingestion
  }
};

/**
 * Simulated Google Cloud Storage (GCS) Service
 * Demonstrates intermediate data persistence for audit and training
 */
export const storageService = {
  uploadToStaging: async (base64: string, objectName: string): Promise<string> => {
    cloudLogger.log('INFO', 'Staging photonic data to GCS bucket', { bucket: 'lexicon-raw-ingest', objectName });
    // Simulate network latency for enterprise upload
    await new Promise(resolve => setTimeout(resolve, 800)); 
    return `gs://lexicon-raw-ingest/${objectName}.jpg`;
  }
};

const MONSTER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Creative monster name based on the object." },
    originalObject: { type: Type.STRING, description: "The object identified in the image." },
    types: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Exactly two elemental or thematic types." 
    },
    lore: { type: Type.STRING, description: "A creative Pokedex-style lore entry." },
    moves: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          power: { type: Type.NUMBER },
          description: { type: Type.STRING }
        },
        required: ["name", "power", "description"]
      }
    }
  },
  required: ["name", "originalObject", "types", "lore", "moves"]
};

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    cloudLogger.log('WARNING', 'API Call Retrying...', { error: err.message, retriesLeft: retries });
    if (err.message?.includes("Requested entity was not found.")) {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
      }
    }
    if (retries <= 0) throw err;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

export async function analyzeImage(base64Image: string): Promise<Partial<Monster>> {
  return retry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const startTime = Date.now();
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: "Identify the object and evolve it into a futuristic creature. Return JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: MONSTER_SCHEMA,
      }
    });

    cloudLogger.log('INFO', 'Inference Complete', { 
      latencyMs: Date.now() - startTime,
      model: 'gemini-3-flash-preview'
    });

    if (!response.text) throw new Error("AI returned empty analysis.");
    return JSON.parse(response.text.trim());
  });
}

/**
 * Imagen 4.0 Integration via generateImages
 * Used for high-fidelity 'Evolution' assets as requested.
 */
export async function generateMonsterVisual(monster: Partial<Monster>): Promise<string> {
  return retry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Hyper-realistic 3D character render of ${monster.name}, a futuristic monster evolved from a ${monster.originalObject}. Style: Unreal Engine 5, cinematic lighting, neon details, 4k.`;
    
    cloudLogger.log('INFO', 'Generating high-fidelity visual with Imagen 4.0');
    
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    const base64Data = response.generatedImages[0].image.imageBytes;
    if (base64Data) return `data:image/jpeg;base64,${base64Data}`;
    throw new Error("Imagen 4.0 generation failed.");
  });
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function getLoreAudio(text: string, audioCtx: AudioContext): Promise<AudioBuffer | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Neural Scan Report: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
    }
  } catch (err) {
    cloudLogger.log('ERROR', 'TTS Synthesis Failure', { error: err });
  }
  return null;
}
