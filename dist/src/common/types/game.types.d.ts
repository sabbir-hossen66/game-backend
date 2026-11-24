export type RpsChoice = 'rock' | 'paper' | 'scissors';
export interface RpsRoundHistory {
    round: number;
    p1Choice: RpsChoice;
    p2Choice: RpsChoice;
    winnerId: string | 'tie';
}
export type GamePhase = 'idle' | 'countdown' | 'choosing' | 'revealing' | 'game_over';
export interface RpsGameState {
    phase: GamePhase;
    round: number;
    targetScore: number;
    timerSeconds: number;
    playerIds: [string, string];
    scores: Record<string, number>;
    choices: Record<string, RpsChoice | null>;
    revealedChoices: Record<string, RpsChoice> | null;
    lastRoundResult: {
        round: number;
        winnerId: string | 'tie';
        message: string;
    } | null;
    matchWinnerId: string | null;
    history: RpsRoundHistory[];
    rematchRequested: string[];
}
export interface ClientRpsGameState {
    phase: GamePhase;
    round: number;
    targetScore: number;
    timerSeconds: number;
    playerIds: [string, string];
    scores: Record<string, number>;
    hasMadeChoice: Record<string, boolean>;
    myChoice: RpsChoice | null;
    revealedChoices: Record<string, RpsChoice> | null;
    lastRoundResult: {
        round: number;
        winnerId: string | 'tie';
        message: string;
    } | null;
    matchWinnerId: string | null;
    history: RpsRoundHistory[];
    rematchRequested: string[];
}
