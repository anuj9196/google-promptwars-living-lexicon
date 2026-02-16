
import { GoogleGenAI, Type } from "@google/genai";
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
        { text: "Analyze this real-world object and 'evolve' it into a futuristic fictional monster (like a Pokemon from 2026). Be creative, funny, and cinematic." }
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
  const prompt = `A high-quality 3D creature design of a monster named '${monster.name}', which is a ${monster.types?.join('/')} type creature evolved from a ${monster.originalObject}. Lore: ${monster.lore}. Style: Futuristic, neon-lit, digital art, high-detail creature photography, 8k resolution, cinematic atmosphere.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Failed to generate monster visual.");
}
