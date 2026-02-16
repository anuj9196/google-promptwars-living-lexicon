
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
  SCANNING = 'SCANNING',
  EVOLVING = 'EVOLVING',
  GENERATING_VISUAL = 'GENERATING_VISUAL',
  DISPLAYING = 'DISPLAYING'
}
