import { RpsGameEngine } from './engine/rps-game.engine';
import { RpsChoice, ClientRpsGameState } from '../../common/types/game.types';
export declare class GamesService {
    private readonly logger;
    private games;
    startGame(roomCode: string, playerIds: [string, string], targetScore: number, broadcastState: (roomCode: string, getStateForUser: (userId: string) => ClientRpsGameState) => void, onGameOver?: (winnerId: string | null) => void): RpsGameEngine;
    getGame(roomCode: string): RpsGameEngine | undefined;
    makeChoice(roomCode: string, userId: string, choice: RpsChoice): boolean;
    requestRematch(roomCode: string, userId: string): boolean;
    endGame(roomCode: string): void;
}
