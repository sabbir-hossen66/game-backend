import { Injectable, Logger } from '@nestjs/common';
import { RpsGameEngine } from './engine/rps-game.engine';
import { RpsChoice, ClientRpsGameState } from '../../common/types/game.types';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);
  private games: Map<string, RpsGameEngine> = new Map(); // roomCode -> engine

  startGame(
    roomCode: string,
    playerIds: [string, string],
    targetScore: number,
    broadcastState: (roomCode: string, getStateForUser: (userId: string) => ClientRpsGameState) => void,
    onGameOver?: (winnerId: string | null) => void
  ): RpsGameEngine {
    const upperCode = roomCode.toUpperCase();
    this.endGame(upperCode); // clean up any existing game

    const engine = new RpsGameEngine(
      playerIds[0],
      playerIds[1],
      targetScore,
      (state) => {
        broadcastState(upperCode, (uid) => engine.getClientState(uid));
        if (state.phase === 'game_over' && onGameOver) {
          onGameOver(state.matchWinnerId);
        }
      }
    );

    this.games.set(upperCode, engine);
    engine.start();
    this.logger.log(`Game started in room ${upperCode} between ${playerIds[0]} and ${playerIds[1]}`);
    return engine;
  }

  getGame(roomCode: string): RpsGameEngine | undefined {
    return this.games.get(roomCode.toUpperCase());
  }

  makeChoice(roomCode: string, userId: string, choice: RpsChoice): boolean {
    const game = this.games.get(roomCode.toUpperCase());
    if (!game) return false;
    return game.makeChoice(userId, choice);
  }

  requestRematch(roomCode: string, userId: string): boolean {
    const game = this.games.get(roomCode.toUpperCase());
    if (!game) return false;
    return game.requestRematch(userId);
  }

  endGame(roomCode: string): void {
    const upperCode = roomCode.toUpperCase();
    const game = this.games.get(upperCode);
    if (game) {
      game.destroy();
      this.games.delete(upperCode);
      this.logger.log(`Game destroyed for room ${upperCode}`);
    }
  }
}
