"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AppGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const rooms_service_1 = require("./rooms/rooms.service");
const games_service_1 = require("./games/games.service");
const chat_service_1 = require("./chat/chat.service");
const auth_service_1 = require("./auth/auth.service");
let AppGateway = AppGateway_1 = class AppGateway {
    constructor(roomsService, gamesService, chatService, authService) {
        this.roomsService = roomsService;
        this.gamesService = gamesService;
        this.chatService = chatService;
        this.authService = authService;
        this.logger = new common_1.Logger(AppGateway_1.name);
    }
    handleConnection(client) {
        this.logger.log(`Socket connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Socket disconnected: ${client.id}`);
        const userId = this.roomsService.removeSocket(client.id);
        if (!userId)
            return;
        const room = this.roomsService.getRoomByUserId(userId);
        if (!room)
            return;
        this.roomsService.scheduleDisconnectGrace(userId, (roomCode, uid) => {
            const leaveResult = this.roomsService.leaveRoom(roomCode, uid);
            if (leaveResult.room) {
                this.server.to(roomCode).emit('room:updated', leaveResult.room);
                const sysMsg = this.chatService.createSystemMessage(roomCode, `Player disconnected permanently.`);
                this.server.to(roomCode).emit('chat:message', sysMsg);
            }
            this.gamesService.endGame(roomCode);
        });
    }
    handleListPublicRooms(client) {
        const list = this.roomsService.listPublicRooms();
        client.emit('room:list', list);
    }
    handleCreateRoom(client, payload) {
        try {
            const user = { ...payload.user, socketId: client.id };
            const room = this.roomsService.createRoom(user, payload.settings);
            client.join(room.code);
            client.emit('room:created', room);
            this.server.emit('room:list', this.roomsService.listPublicRooms());
            const welcomeMsg = this.chatService.createSystemMessage(room.code, `Room created! Code: ${room.code}. Share with your friend!`);
            client.emit('chat:message', welcomeMsg);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create room';
            client.emit('error', { message });
        }
    }
    handleJoinRoom(client, payload) {
        try {
            const user = { ...payload.user, socketId: client.id };
            const { room, isNew } = this.roomsService.joinRoom(payload.code, user, payload.password);
            client.join(room.code);
            client.emit('room:joined', room);
            this.server.to(room.code).emit('room:updated', room);
            this.server.emit('room:list', this.roomsService.listPublicRooms());
            if (isNew) {
                const joinMsg = this.chatService.createSystemMessage(room.code, `${user.nickname} entered the arena!`);
                this.server.to(room.code).emit('chat:message', joinMsg);
            }
            const history = this.chatService.getMessages(room.code);
            client.emit('chat:history', history);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to join room';
            client.emit('error', { message });
        }
    }
    handleQuickJoin(client, payload) {
        try {
            let room = this.roomsService.findQuickJoinRoom();
            if (!room) {
                const user = { ...payload.user, socketId: client.id };
                room = this.roomsService.createRoom(user, {
                    name: `${user.nickname}'s Quick Match`,
                    maxPlayers: 2,
                    isPrivate: false,
                    roundsToWin: 3,
                });
                client.join(room.code);
                client.emit('room:created', room);
                this.server.emit('room:list', this.roomsService.listPublicRooms());
                return;
            }
            this.handleJoinRoom(client, { code: room.code, user: payload.user });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to quick join';
            client.emit('error', { message });
        }
    }
    handlePlayerReady(client, payload) {
        try {
            const room = this.roomsService.setPlayerReady(payload.code, payload.userId, payload.ready);
            this.server.to(room.code).emit('room:updated', room);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error setting ready';
            client.emit('error', { message });
        }
    }
    handleKickPlayer(client, payload) {
        try {
            const { room, kickedUserId } = this.roomsService.hostKickPlayer(payload.code, payload.hostId, payload.targetUserId);
            this.server.to(room.code).emit('room:updated', room);
            this.server.to(room.code).emit('room:player_kicked', { userId: kickedUserId });
            this.server.emit('room:list', this.roomsService.listPublicRooms());
            const kickMsg = this.chatService.createSystemMessage(room.code, `A player was removed by the host.`);
            this.server.to(room.code).emit('chat:message', kickMsg);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error kicking player';
            client.emit('error', { message });
        }
    }
    handleMutePlayer(client, payload) {
        try {
            const room = this.roomsService.hostMutePlayer(payload.code, payload.hostId, payload.targetUserId, payload.mute);
            this.server.to(room.code).emit('room:updated', room);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error muting player';
            client.emit('error', { message });
        }
    }
    handleLeaveRoom(client, payload) {
        const leaveResult = this.roomsService.leaveRoom(payload.code, payload.userId);
        client.leave(payload.code);
        if (leaveResult.room) {
            this.server.to(payload.code).emit('room:updated', leaveResult.room);
            const leaveMsg = this.chatService.createSystemMessage(payload.code, `A player left the room.`);
            this.server.to(payload.code).emit('chat:message', leaveMsg);
        }
        this.gamesService.endGame(payload.code);
        this.server.emit('room:list', this.roomsService.listPublicRooms());
    }
    handleStartGame(client, payload) {
        try {
            const room = this.roomsService.getRoom(payload.code);
            if (!room)
                throw new Error('Room not found');
            if (room.hostId !== payload.hostId)
                throw new Error('Only the host can start the game');
            const playerIds = Object.keys(room.players);
            if (playerIds.length < 2) {
                throw new Error('Need at least 2 players to start a 1v1 battle');
            }
            this.roomsService.updateRoomStatus(room.code, 'playing');
            this.server.to(room.code).emit('room:updated', room);
            this.gamesService.startGame(room.code, [playerIds[0], playerIds[1]], room.roundsToWin || 3, (roomCode, getStateForUser) => {
                const r = this.roomsService.getRoom(roomCode);
                if (!r)
                    return;
                for (const pid of Object.keys(r.players)) {
                    const player = r.players[pid];
                    if (player.socketId) {
                        const state = getStateForUser(pid);
                        this.server.to(player.socketId).emit('game:state', state);
                    }
                }
            }, async (winnerId) => {
                this.logger.log(`Game over in room ${room.code}. Winner: ${winnerId}`);
                const winName = winnerId && room.players[winnerId] ? room.players[winnerId].nickname : 'Nobody';
                const msg = this.chatService.createSystemMessage(room.code, `🏆 Match Finished! Winner: ${winName}!`);
                this.server.to(room.code).emit('chat:message', msg);
                const engine = this.gamesService.getGame(room.code);
                const state = engine ? engine.getState() : null;
                const p1Score = state?.scores[playerIds[0]] || 0;
                const p2Score = state?.scores[playerIds[1]] || 0;
                await this.authService.recordMatch(room.code, playerIds[0], playerIds[1], winnerId, p1Score, p2Score);
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Error starting game';
            client.emit('error', { message });
        }
    }
    handleGameChoice(client, payload) {
        const success = this.gamesService.makeChoice(payload.code, payload.userId, payload.choice);
        if (!success) {
            client.emit('error', { message: 'Invalid move or round has already ended' });
        }
    }
    handleRematch(client, payload) {
        this.gamesService.requestRematch(payload.code, payload.userId);
    }
    handleChatMessage(client, payload) {
        const msg = this.chatService.createMessage(payload.code, payload.user, payload.text, 'user');
        this.server.to(payload.code).emit('chat:message', msg);
    }
    handleChatReaction(client, payload) {
        const msg = this.chatService.createMessage(payload.code, payload.user, payload.emoji, 'reaction', payload.emoji);
        this.server.to(payload.code).emit('chat:message', msg);
    }
    handleVoiceSignal(client, payload) {
        const room = this.roomsService.getRoom(payload.code);
        if (!room)
            return;
        const targetPlayer = room.players[payload.targetUserId];
        if (targetPlayer && targetPlayer.socketId) {
            this.server.to(targetPlayer.socketId).emit('voice:signal', {
                senderUserId: payload.senderUserId,
                signal: payload.signal,
            });
        }
    }
    handleVoiceState(client, payload) {
        const room = this.roomsService.updatePlayerVoice(payload.code, payload.userId, payload.isMuted, payload.isSpeaking);
        if (room) {
            this.server.to(payload.code).emit('voice:state_changed', {
                userId: payload.userId,
                isMuted: payload.isMuted,
                isSpeaking: payload.isSpeaking,
            });
        }
    }
};
exports.AppGateway = AppGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AppGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:list_public'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleListPublicRooms", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:create'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:quick_join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleQuickJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:ready'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handlePlayerReady", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:kick'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleKickPlayer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:mute_player'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleMutePlayer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('room:leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('game:start'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleStartGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('game:choose'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleGameChoice", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('game:rematch'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleRematch", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('chat:send'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleChatMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('chat:reaction'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleChatReaction", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('voice:signal'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleVoiceSignal", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('voice:state'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleVoiceState", null);
exports.AppGateway = AppGateway = AppGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [rooms_service_1.RoomsService,
        games_service_1.GamesService,
        chat_service_1.ChatService,
        auth_service_1.AuthService])
], AppGateway);
//# sourceMappingURL=app.gateway.js.map