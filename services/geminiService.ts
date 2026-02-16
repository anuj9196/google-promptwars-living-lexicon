
import { Monster } from "../types";

/**
 * API Client — All AI calls now routed through server-side endpoints
 * No direct Gemini SDK usage; no API keys exposed client-side
 */

const API_BASE = '';

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
      service: "living-lexicon-client",
      ...payload,
    };
    console.log(JSON.stringify(logEntry));

    // Send to server for Cloud Logging ingestion
    fetch(`${API_BASE}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    }).catch(() => { });
  }
};

/**
 * Cloud Storage staging — now routed through server
 */
export const storageService = {
  uploadToStaging: async (base64: string, objectName: string): Promise<string> => {
    cloudLogger.log('INFO', 'Staging photonic data via server API', { objectName });
    // Storage upload now happens server-side in the scan pipeline
    return `gs://lexicon-raw-ingest/${objectName}.jpg`;
  }
};

/**
 * Get reCAPTCHA v3 token for scan requests
 */
async function getRecaptchaToken(): Promise<string> {
  try {
    if (typeof (window as any).grecaptcha !== 'undefined') {
      const token = await (window as any).grecaptcha.execute(
        (window as any).__RECAPTCHA_SITE_KEY__ || '',
        { action: 'scan' }
      );
      return token;
    }
  } catch (err) {
    cloudLogger.log('WARNING', 'reCAPTCHA token acquisition failed', { error: (err as Error).message });
  }
  return '';
}

/**
 * Get or create a persistent session ID
 */
function getSessionId(): string {
  let sessionId = localStorage.getItem('lexicon_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('lexicon_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Full scan pipeline — sends image to server for Vertex AI processing
 * Server handles: GCS upload → Gemini analysis → Imagen generation → Firestore save
 */
export async function analyzeImage(base64Image: string): Promise<Partial<Monster>> {
  const startTime = Date.now();
  const recaptchaToken = await getRecaptchaToken();
  const sessionId = getSessionId();

  const response = await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Image,
      recaptchaToken,
      sessionId,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Scan failed' }));
    throw new Error(err.error || `Scan failed with status ${response.status}`);
  }

  const data = await response.json();
  cloudLogger.log('INFO', 'Scan pipeline complete via server', {
    latencyMs: Date.now() - startTime,
    cached: data.cached,
    name: data.monster?.name,
  });

  return data.monster;
}

/**
 * Generate monster visual — now handled server-side in scan pipeline
 * This function returns the imageUrl from the scan result
 */
export async function generateMonsterVisual(monster: Partial<Monster>): Promise<string> {
  // Visual generation now happens server-side as part of the scan pipeline
  // The scan endpoint returns the complete monster with imageUrl
  return monster.imageUrl || '';
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

/**
 * TTS via server-side Vertex AI
 */
export async function getLoreAudio(text: string, audioCtx: AudioContext): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(`${API_BASE}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.audio) {
      return await decodeAudioData(decode(data.audio), audioCtx, 24000, 1);
    }
  } catch (err) {
    cloudLogger.log('ERROR', 'TTS request failed', { error: err });
  }
  return null;
}

/**
 * Fetch collection from Firestore via server
 */
export async function fetchCollection(): Promise<Monster[]> {
  try {
    const sessionId = getSessionId();
    const response = await fetch(`${API_BASE}/api/collection/${sessionId}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.monsters || [];
  } catch {
    return [];
  }
}

/**
 * Track analytics events via Firebase Analytics (gtag)
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  try {
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', eventName, {
        ...params,
        app_name: 'living-lexicon',
        app_version: '2.0.0',
      });
    }
  } catch {
    // Silent fail for analytics
  }
}

/**
 * Set player display name
 */
export async function setPlayerName(name: string): Promise<string> {
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE}/api/player`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, name }),
  });
  if (!response.ok) throw new Error('Failed to set player name');
  const data = await response.json();
  return data.playerName;
}

/**
 * Get player profile
 */
export async function getPlayerProfile(): Promise<{ playerName: string; monsterCount: number }> {
  try {
    const sessionId = getSessionId();
    const response = await fetch(`${API_BASE}/api/player/${sessionId}`);
    if (!response.ok) return { playerName: 'Anonymous', monsterCount: 0 };
    return await response.json();
  } catch {
    return { playerName: 'Anonymous', monsterCount: 0 };
  }
}

/**
 * Fetch global leaderboard
 */
export interface LeaderboardEntry {
  rank: number;
  sessionId: string;
  playerName: string;
  monsterCount: number;
}

export async function fetchLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard?limit=${limit}`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.leaderboard || [];
  } catch {
    return [];
  }
}

export { getSessionId };
