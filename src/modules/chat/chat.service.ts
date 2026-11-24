import { Injectable } from '@nestjs/common';
import { ChatMessage } from '../../common/types/chat.types';
import { UserProfile } from '../../common/types/user.types';

@Injectable()
export class ChatService {
  private roomMessages: Map<string, ChatMessage[]> = new Map();

  // Basic profanity / toxic word filter
  private readonly badWords = [
    'idiot',
    'stupid',
    'fool',
    'dumb',
    'hate',
    'ugly',
  ];

  private filterText(text: string): string {
    let sanitized = text;
    for (const word of this.badWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '***');
    }
    return sanitized;
  }

  createMessage(
    roomCode: string,
    sender: UserProfile,
    text: string,
    type: 'user' | 'system' | 'reaction' = 'user',
    emoji?: string
  ): ChatMessage {
    const upperCode = roomCode.toUpperCase();
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: sender.id,
      senderName: sender.nickname,
      senderAvatar: sender.avatar,
      text: this.filterText(text),
      timestamp: Date.now(),
      type,
      emoji,
    };

    if (!this.roomMessages.has(upperCode)) {
      this.roomMessages.set(upperCode, []);
    }
    const history = this.roomMessages.get(upperCode)!;
    history.push(message);
    if (history.length > 100) {
      history.shift(); // keep last 100
    }

    return message;
  }

  createSystemMessage(roomCode: string, text: string): ChatMessage {
    return this.createMessage(
      roomCode,
      { id: 'system', nickname: 'System', avatar: '🤖' },
      text,
      'system'
    );
  }

  getMessages(roomCode: string): ChatMessage[] {
    return this.roomMessages.get(roomCode.toUpperCase()) || [];
  }

  clearRoomMessages(roomCode: string): void {
    this.roomMessages.delete(roomCode.toUpperCase());
  }
}
