/**
 * Vertex AI Service — Server-side Gemini + Imagen integration
 * Uses @google-cloud/vertexai with service account authentication
 * All AI inference runs server-side; no API keys exposed to clients
 */

const { VertexAI } = require('@google-cloud/vertexai');
const { GoogleGenAI, Modality } = require('@google/genai');
const { cloudLogger } = require('./loggingService');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'living-lexicon-prod';
const LOCATION = process.env.GCP_REGION || 'us-central1';

// Vertex AI client — authenticated via service account (GOOGLE_APPLICATION_CREDENTIALS)
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });

// GenAI client for Imagen (uses API key or ADC)
const genAI = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

const GEMINI_MODEL = 'gemini-2.0-flash';
const IMAGEN_MODEL = 'imagen-3.0-generate-001';

const MONSTER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'Creative monster name based on the object.' },
    originalObject: { type: 'STRING', description: 'The object identified in the image.' },
    types: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Exactly two elemental or thematic types.',
    },
    lore: { type: 'STRING', description: 'A creative Pokedex-style lore entry (2-3 sentences).' },
    moves: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          power: { type: 'NUMBER' },
          description: { type: 'STRING' },
        },
        required: ['name', 'power', 'description'],
      },
    },
  },
  required: ['name', 'originalObject', 'types', 'lore', 'moves'],
};

/**
 * Exponential backoff retry wrapper
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Max retry attempts
 * @param {number} delay - Initial delay in ms
 */
async function retry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    cloudLogger.log('WARNING', 'Vertex AI call retrying', {
      error: err.message,
      retriesLeft: retries,
    });
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

/**
 * Analyze an image using Gemini via Vertex AI
 * @param {string} base64Image - Base64-encoded JPEG image
 * @returns {Promise<Object>} Parsed monster data
 */
async function analyzeImage(base64Image) {
  return retry(async () => {
    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
    const startTime = Date.now();

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            {
              text: 'Identify the object in this image and evolve it into a futuristic digital creature. Return structured JSON with name, originalObject, types (exactly 2), lore (2-3 sentences, Pokedex-style), and moves (3-4 moves with name, power 1-100, description).',
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: MONSTER_SCHEMA,
      },
    });

    const latencyMs = Date.now() - startTime;
    cloudLogger.log('INFO', 'Gemini analysis complete', {
      latencyMs,
      model: GEMINI_MODEL,
      project: PROJECT_ID,
    });

    const text =
      response.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned empty analysis.');
    return { ...JSON.parse(text.trim()), _metrics: { analysisLatencyMs: latencyMs, model: GEMINI_MODEL } };
  });
}

/**
 * Generate a monster visual using Imagen via Vertex AI
 * @param {Object} monsterData - Partial monster data with name and originalObject
 * @returns {Promise<string>} Base64-encoded JPEG image data URI
 */
async function generateMonsterVisual(monsterData) {
  return retry(async () => {
    const startTime = Date.now();
    const prompt = `Hyper-realistic 3D character render of ${monsterData.name}, a futuristic monster evolved from a ${monsterData.originalObject}. Style: Unreal Engine 5, cinematic lighting, neon cyan and magenta details, dark background, 4k quality.`;

    cloudLogger.log('INFO', 'Generating visual with Imagen via Vertex AI', {
      model: IMAGEN_MODEL,
    });

    const response = await genAI.models.generateImages({
      model: IMAGEN_MODEL,
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    const latencyMs = Date.now() - startTime;
    const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64Data) throw new Error('Imagen generation returned no image data.');

    cloudLogger.log('INFO', 'Imagen visual generated', {
      latencyMs,
      model: IMAGEN_MODEL,
    });

    return {
      dataUri: `data:image/jpeg;base64,${base64Data}`,
      raw: base64Data,
      _metrics: { imagenLatencyMs: latencyMs, model: IMAGEN_MODEL },
    };
  });
}

/**
 * Generate TTS audio for monster lore via Gemini TTS
 * @param {string} text - Text to synthesize
 * @returns {Promise<string|null>} Base64-encoded audio data or null on failure
 */
async function generateTTS(text) {
  try {
    const startTime = Date.now();

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: `Neural Scan Report: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });

    const latencyMs = Date.now() - startTime;
    const audioData =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (audioData) {
      cloudLogger.log('INFO', 'TTS synthesis complete', { latencyMs });
      return audioData;
    }
    return null;
  } catch (err) {
    cloudLogger.log('ERROR', 'TTS synthesis failure', { error: err.message });
    return null;
  }
}

module.exports = {
  analyzeImage,
  generateMonsterVisual,
  generateTTS,
  retry,
  // Exported for testing
  _internals: {
    PROJECT_ID,
    LOCATION,
    GEMINI_MODEL,
    IMAGEN_MODEL,
    MONSTER_SCHEMA,
  },
};
