import {
  RpsGameState,
  ClientRpsGameState,
  RpsChoice,
  RpsRoundHistory,
} from '../../../common/types/game.types';

export class RpsGameEngine {
  private state: RpsGameState;
  private intervalTimer: NodeJS.Timeout | null = null;
  private readonly onStateChange: (state: RpsGameState) => void;

  constructor(
    player1Id: string,
    player2Id: string,
    targetScore: number,
    onStateChange: (state: RpsGameState) => void
  ) {
    this.onStateChange = onStateChange;
    this.state = {
      phase: 'idle',
      round: 1,
      targetScore: targetScore || 3,
      timerSeconds: 3,
      playerIds: [player1Id, player2Id],
      scores: {
        [player1Id]: 0,
        [player2Id]: 0,
      },
      choices: {
        [player1Id]: null,
        [player2Id]: null,
      },
      revealedChoices: null,
      lastRoundResult: null,
      matchWinnerId: null,
      history: [],
      rematchRequested: [],
    };
  }

  public getState(): RpsGameState {
    return this.state;
  }

  public getClientState(forUserId: string): ClientRpsGameState {
    const [p1, p2] = this.state.playerIds;
    return {
      phase: this.state.phase,
      round: this.state.round,
      targetScore: this.state.targetScore,
      timerSeconds: this.state.timerSeconds,
      playerIds: this.state.playerIds,
      scores: { ...this.state.scores },
      hasMadeChoice: {
        [p1]: this.state.choices[p1] !== null,
        [p2]: this.state.choices[p2] !== null,
      },
      myChoice: this.state.choices[forUserId] || null,
      revealedChoices: this.state.revealedChoices,
      lastRoundResult: this.state.lastRoundResult,
      matchWinnerId: this.state.matchWinnerId,
      history: this.state.history,
      rematchRequested: this.state.rematchRequested,
    };
  }

  public start(): void {
    this.startCountdown();
  }

  private clearTimer(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private startCountdown(): void {
    this.clearTimer();
    this.state.phase = 'countdown';
    this.state.timerSeconds = 3;
    this.state.revealedChoices = null;
    this.state.choices = {
      [this.state.playerIds[0]]: null,
      [this.state.playerIds[1]]: null,
    };
    this.onStateChange(this.state);

    this.intervalTimer = setInterval(() => {
      this.state.timerSeconds -= 1;
      if (this.state.timerSeconds <= 0) {
        this.clearTimer();
        this.startChoosing();
      } else {
        this.onStateChange(this.state);
      }
    }, 1000);
  }

  private startChoosing(): void {
    this.clearTimer();
    this.state.phase = 'choosing';
    this.state.timerSeconds = 10; // 10 seconds to choose
    this.onStateChange(this.state);

    this.intervalTimer = setInterval(() => {
      this.state.timerSeconds -= 1;
      if (this.state.timerSeconds <= 0) {
        this.clearTimer();
        this.resolveRound();
      } else {
        this.onStateChange(this.state);
      }
    }, 1000);
  }

  public makeChoice(userId: string, choice: RpsChoice): boolean {
    if (this.state.phase !== 'choosing') return false;
    if (!this.state.playerIds.includes(userId)) return false;
    if (this.state.choices[userId] !== null) return false; // already chose

    this.state.choices[userId] = choice;

    // Check if both players have made their choice
    const [p1, p2] = this.state.playerIds;
    if (this.state.choices[p1] !== null && this.state.choices[p2] !== null) {
      this.clearTimer();
      this.resolveRound();
    } else {
      this.onStateChange(this.state);
    }
    return true;
  }

  private resolveRound(): void {
    this.clearTimer();
    const [p1, p2] = this.state.playerIds;

    // Default choices if player timed out
    const validChoices: RpsChoice[] = ['rock', 'paper', 'scissors'];
    const p1Choice: RpsChoice =
      this.state.choices[p1] || validChoices[Math.floor(Math.random() * 3)];
    const p2Choice: RpsChoice =
      this.state.choices[p2] || validChoices[Math.floor(Math.random() * 3)];

    this.state.choices[p1] = p1Choice;
    this.state.choices[p2] = p2Choice;
    this.state.revealedChoices = {
      [p1]: p1Choice,
      [p2]: p2Choice,
    };

    let roundWinner: string | 'tie' = 'tie';
    let message = "It's a draw!";

    if (p1Choice === p2Choice) {
      roundWinner = 'tie';
      message = 'Both picked ' + p1Choice + '! Round tied!';
    } else if (
      (p1Choice === 'rock' && p2Choice === 'scissors') ||
      (p1Choice === 'paper' && p2Choice === 'rock') ||
      (p1Choice === 'scissors' && p2Choice === 'paper')
    ) {
      roundWinner = p1;
      this.state.scores[p1] += 1;
      message = `${p1Choice} beats ${p2Choice}!`;
    } else {
      roundWinner = p2;
      this.state.scores[p2] += 1;
      message = `${p2Choice} beats ${p1Choice}!`;
    }

    const roundEntry: RpsRoundHistory = {
      round: this.state.round,
      p1Choice,
      p2Choice,
      winnerId: roundWinner,
    };
    this.state.history.push(roundEntry);

    this.state.lastRoundResult = {
      round: this.state.round,
      winnerId: roundWinner,
      message,
    };

    // Check match win condition
    const p1Wins = this.state.scores[p1];
    const p2Wins = this.state.scores[p2];

    if (p1Wins >= this.state.targetScore) {
      this.state.matchWinnerId = p1;
    } else if (p2Wins >= this.state.targetScore) {
      this.state.matchWinnerId = p2;
    }

    this.state.phase = 'revealing';
    this.state.timerSeconds = 4;
    this.onStateChange(this.state);

    // After 4 seconds of reveal, transition to game over or next round
    this.intervalTimer = setTimeout(() => {
      if (this.state.matchWinnerId) {
        this.state.phase = 'game_over';
        this.onStateChange(this.state);
      } else {
        this.state.round += 1;
        this.startCountdown();
      }
    }, 4000);
  }

  public requestRematch(userId: string): boolean {
    if (this.state.phase !== 'game_over') return false;
    if (!this.state.playerIds.includes(userId)) return false;

    if (!this.state.rematchRequested.includes(userId)) {
      this.state.rematchRequested.push(userId);
    }

    // Both requested rematch?
    if (this.state.rematchRequested.length >= 2) {
      this.resetMatch();
      this.startCountdown();
      return true;
    }

    this.onStateChange(this.state);
    return false;
  }

  private resetMatch(): void {
    const [p1, p2] = this.state.playerIds;
    this.state.phase = 'idle';
    this.state.round = 1;
    this.state.timerSeconds = 3;
    this.state.scores = { [p1]: 0, [p2]: 0 };
    this.state.choices = { [p1]: null, [p2]: null };
    this.state.revealedChoices = null;
    this.state.lastRoundResult = null;
    this.state.matchWinnerId = null;
    this.state.history = [];
    this.state.rematchRequested = [];
  }

  public destroy(): void {
    this.clearTimer();
  }
}
