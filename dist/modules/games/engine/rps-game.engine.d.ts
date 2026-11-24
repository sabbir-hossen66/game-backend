import { RpsGameState, ClientRpsGameState, RpsChoice } from '../../../common/types/game.types';
export declare class RpsGameEngine {
    private state;
    private intervalTimer;
    private readonly onStateChange;
    constructor(player1Id: string, player2Id: string, targetScore: number, onStateChange: (state: RpsGameState) => void);
    getState(): RpsGameState;
    getClientState(forUserId: string): ClientRpsGameState;
    start(): void;
    private clearTimer;
    private startCountdown;
    private startChoosing;
    makeChoice(userId: string, choice: RpsChoice): boolean;
    private resolveRound;
    requestRematch(userId: string): boolean;
    private resetMatch;
    destroy(): void;
}
