
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Monster } from "../types";

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

export async function analyzeImage(base64Image: string): Promise<Partial<Monster>> {
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

  if (!response.text) throw new Error("Failed to analyze object.");
  return JSON.parse(response.text.trim());
}

export async function generateMonsterVisual(monster: Partial<Monster>): Promise<string> {
  const prompt = `A high-quality 3D creature design of a monster named '${monster.name}', evolved from a ${monster.originalObject}. Style: Futuristic, neon-lit, digital art, cinematic atmosphere.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Visual generation failed.");
}

// Helper for PCM Decoding
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

export async function getLoreAudio(text: string): Promise<AudioBuffer | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `System Announcement: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      return await decodeAudioData(decodeBase64(base64Audio), audioCtx);
    }
  } catch (err) {
    console.error("TTS Generation Error:", err);
  }
  return null;
}
