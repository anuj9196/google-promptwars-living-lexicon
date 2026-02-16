
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Monster, Move } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    lore: { type: Type.STRING, description: "A hilarious and creative Pokedex-style lore entry." },
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
      },
      description: "Three signature moves."
    }
  },
  required: ["name", "originalObject", "types", "lore", "moves"],
  propertyOrdering: ["name", "originalObject", "types", "lore", "moves"]
};

/**
 * Exponential backoff utility for robust API calls
 */
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

export async function analyzeImage(base64Image: string): Promise<Partial<Monster>> {
  return retry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          { text: "Analyze this real-world object and 'evolve' it into a futuristic fictional monster (like a Pokemon from 2026). Be creative and return JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: MONSTER_SCHEMA,
      }
    });

    if (!response.text) throw new Error("AI returned empty analysis.");
    return JSON.parse(response.text.trim());
  });
}

export async function generateMonsterVisual(monster: Partial<Monster>): Promise<string> {
  return retry(async () => {
    const prompt = `A high-quality 3D creature design of a monster named '${monster.name}', evolved from a ${monster.originalObject}. Style: Futuristic, neon-lit, digital art, cinematic atmosphere, 8k resolution.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    throw new Error("Visual generation failed - no image data returned.");
  });
}

/**
 * Manually implement base64 decoding as per SDK guidelines
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data (16-bit, mono, 24kHz) returned by Gemini TTS
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Neural Scan Report: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName: 'Kore' } 
          } 
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
    }
  } catch (err) {
    console.error("TTS Protocol Error:", err);
  }
  return null;
}
