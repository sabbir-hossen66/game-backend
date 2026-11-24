import { ChatMessage } from '../../common/types/chat.types';
import { UserProfile } from '../../common/types/user.types';
export declare class ChatService {
    private roomMessages;
    private readonly badWords;
    private filterText;
    createMessage(roomCode: string, sender: UserProfile, text: string, type?: 'user' | 'system' | 'reaction', emoji?: string): ChatMessage;
    createSystemMessage(roomCode: string, text: string): ChatMessage;
    getMessages(roomCode: string): ChatMessage[];
    clearRoomMessages(roomCode: string): void;
}
