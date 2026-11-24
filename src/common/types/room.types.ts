import { UserProfile } from './user.types';

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type GameType = 'rock-paper-scissors';

export interface RoomSettings {
  name: string;
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  roundsToWin: number;
}

export interface Room {
  code: string;
  name: string;
  hostId: string;
  gameType: GameType;
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  status: RoomStatus;
  players: Record<string, UserProfile>;
  roundsToWin: number;
  createdAt: number;
}

export interface RoomSummary {
  code: string;
  name: string;
  hostName: string;
  gameType: GameType;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
  status: RoomStatus;
}
