export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    text: string;
    timestamp: number;
    type: 'user' | 'system' | 'reaction';
    emoji?: string;
}
