"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
let ChatService = class ChatService {
    constructor() {
        this.roomMessages = new Map();
        this.badWords = [
            'idiot',
            'stupid',
            'fool',
            'dumb',
            'hate',
            'ugly',
        ];
    }
    filterText(text) {
        let sanitized = text;
        for (const word of this.badWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            sanitized = sanitized.replace(regex, '***');
        }
        return sanitized;
    }
    createMessage(roomCode, sender, text, type = 'user', emoji) {
        const upperCode = roomCode.toUpperCase();
        const message = {
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
        const history = this.roomMessages.get(upperCode);
        history.push(message);
        if (history.length > 100) {
            history.shift();
        }
        return message;
    }
    createSystemMessage(roomCode, text) {
        return this.createMessage(roomCode, { id: 'system', nickname: 'System', avatar: '🤖' }, text, 'system');
    }
    getMessages(roomCode) {
        return this.roomMessages.get(roomCode.toUpperCase()) || [];
    }
    clearRoomMessages(roomCode) {
        this.roomMessages.delete(roomCode.toUpperCase());
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)()
], ChatService);
//# sourceMappingURL=chat.service.js.map