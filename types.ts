
export interface Move {
  name: string;
  power: number;
  description: string;
}

export interface Monster {
  id: string;
  name: string;
  originalObject: string;
  types: string[];
  lore: string;
  moves: Move[];
  imageUrl: string;
  capturedAt: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  AR_MODE = 'AR_MODE',
  STAGING_TO_GCS = 'STAGING_TO_GCS', // New: Multi-service architecture step
  EVOLVING = 'EVOLVING',
  GENERATING_VISUAL = 'GENERATING_VISUAL',
  LOGGING_METRICS = 'LOGGING_METRICS', // New: Observability step
  DISPLAYING = 'DISPLAYING'
}
