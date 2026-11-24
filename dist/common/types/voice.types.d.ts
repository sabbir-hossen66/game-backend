export interface WebRtcSignalPayload {
    targetId: string;
    senderId: string;
    data: unknown;
}
export interface VoiceStateUpdate {
    userId: string;
    isMuted: boolean;
    isSpeaking: boolean;
}
