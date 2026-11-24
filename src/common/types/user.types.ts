export interface UserProfile {
  id: string;
  nickname: string;
  avatar: string;
  isHost?: boolean;
  isReady?: boolean;
  isMuted?: boolean;
  isMutedByHost?: boolean;
  isSpeaking?: boolean;
  socketId?: string;
}

export interface UserStats {
  totalWins: number;
  gamesPlayed: number;
}
