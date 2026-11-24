"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
let RoomsService = RoomsService_1 = class RoomsService {
    constructor() {
        this.logger = new common_1.Logger(RoomsService_1.name);
        this.rooms = new Map();
        this.userToRoom = new Map();
        this.socketToUser = new Map();
        this.disconnectedUsers = new Map();
    }
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        do {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.rooms.has(code));
        return code;
    }
    createRoom(host, settings) {
        const code = this.generateRoomCode();
        const newRoom = {
            code,
            name: settings.name?.trim() || `${host.nickname}'s Battle Arena`,
            hostId: host.id,
            gameType: 'rock-paper-scissors',
            maxPlayers: Math.min(Math.max(settings.maxPlayers || 2, 2), 4),
            isPrivate: Boolean(settings.isPrivate),
            password: settings.password || undefined,
            status: 'waiting',
            players: {
                [host.id]: {
                    ...host,
                    isHost: true,
                    isReady: true,
                    isMuted: false,
                    isMutedByHost: false,
                    isSpeaking: false,
                },
            },
            roundsToWin: settings.roundsToWin || 3,
            createdAt: Date.now(),
        };
        this.rooms.set(code, newRoom);
        this.userToRoom.set(host.id, code);
        if (host.socketId) {
            this.socketToUser.set(host.socketId, host.id);
        }
        this.logger.log(`Room created: ${code} by ${host.nickname} (${host.id})`);
        return newRoom;
    }
    joinRoom(code, user, password) {
        const upperCode = code.toUpperCase();
        const room = this.rooms.get(upperCode);
        if (!room) {
            throw new Error('Room not found');
        }
        if (room.isPrivate && room.password && room.password !== password) {
            throw new Error('Incorrect room password');
        }
        const existingPlayer = room.players[user.id];
        if (existingPlayer) {
            const disconnectInfo = this.disconnectedUsers.get(user.id);
            if (disconnectInfo) {
                clearTimeout(disconnectInfo.timer);
                this.disconnectedUsers.delete(user.id);
            }
            room.players[user.id] = {
                ...existingPlayer,
                ...user,
                socketId: user.socketId,
            };
            this.userToRoom.set(user.id, upperCode);
            if (user.socketId) {
                this.socketToUser.set(user.socketId, user.id);
            }
            return room;
        }
        const currentPlayers = Object.keys(room.players);
        if (currentPlayers.length >= room.maxPlayers) {
            throw new Error('Room is already full');
        }
        room.players[user.id] = {
            ...user,
            isHost: false,
            isReady: false,
            isMuted: false,
            isMutedByHost: false,
            isSpeaking: false,
        };
        this.userToRoom.set(user.id, upperCode);
        if (user.socketId) {
            this.socketToUser.set(user.socketId, user.id);
        }
        this.logger.log(`Player ${user.nickname} joined room ${upperCode}`);
        return room;
    }
    getRoom(code) {
        return this.rooms.get(code.toUpperCase());
    }
    getRoomByUserId(userId) {
        const code = this.userToRoom.get(userId);
        return code ? this.rooms.get(code) : undefined;
    }
    getUserIdBySocketId(socketId) {
        return this.socketToUser.get(socketId);
    }
    setSocketUser(socketId, userId) {
        this.socketToUser.set(socketId, userId);
    }
    removeSocket(socketId) {
        const userId = this.socketToUser.get(socketId);
        if (userId) {
            this.socketToUser.delete(socketId);
        }
        return userId;
    }
    listPublicRooms() {
        const summaries = [];
        for (const room of this.rooms.values()) {
            if (!room.isPrivate) {
                const host = room.players[room.hostId];
                summaries.push({
                    code: room.code,
                    name: room.name,
                    hostName: host ? host.nickname : 'Host',
                    gameType: room.gameType,
                    playerCount: Object.keys(room.players).length,
                    maxPlayers: room.maxPlayers,
                    isPrivate: false,
                    status: room.status,
                });
            }
        }
        return summaries;
    }
    findQuickJoinRoom() {
        for (const room of this.rooms.values()) {
            if (!room.isPrivate && room.status === 'waiting') {
                const count = Object.keys(room.players).length;
                if (count < room.maxPlayers) {
                    return room;
                }
            }
        }
        return undefined;
    }
    setPlayerReady(code, userId, ready) {
        const room = this.rooms.get(code.toUpperCase());
        if (!room)
            throw new Error('Room not found');
        const player = room.players[userId];
        if (!player)
            throw new Error('Player not in room');
        player.isReady = ready;
        return room;
    }
    updatePlayerVoice(code, userId, isMuted, isSpeaking) {
        const room = this.rooms.get(code.toUpperCase());
        if (!room || !room.players[userId])
            return undefined;
        room.players[userId].isMuted = isMuted;
        room.players[userId].isSpeaking = isSpeaking;
        return room;
    }
    hostMutePlayer(code, hostId, targetUserId, mute) {
        const room = this.rooms.get(code.toUpperCase());
        if (!room)
            throw new Error('Room not found');
        if (room.hostId !== hostId)
            throw new Error('Only the room host can mute players');
        if (!room.players[targetUserId])
            throw new Error('Player not in room');
        room.players[targetUserId].isMutedByHost = mute;
        return room;
    }
    hostKickPlayer(code, hostId, targetUserId) {
        const room = this.rooms.get(code.toUpperCase());
        if (!room)
            throw new Error('Room not found');
        if (room.hostId !== hostId)
            throw new Error('Only the host can kick players');
        if (targetUserId === hostId)
            throw new Error('Host cannot kick themselves');
        delete room.players[targetUserId];
        this.userToRoom.delete(targetUserId);
        return { room, kickedUserId: targetUserId };
    }
    updateRoomStatus(code, status) {
        const room = this.rooms.get(code.toUpperCase());
        if (room) {
            room.status = status;
        }
        return room;
    }
    leaveRoom(code, userId) {
        const upperCode = code.toUpperCase();
        const room = this.rooms.get(upperCode);
        if (!room)
            return { wasHost: false, destroyed: true };
        const wasHost = room.hostId === userId;
        delete room.players[userId];
        this.userToRoom.delete(userId);
        const remainingPlayerIds = Object.keys(room.players);
        if (remainingPlayerIds.length === 0) {
            this.rooms.delete(upperCode);
            this.logger.log(`Room ${upperCode} destroyed (empty)`);
            return { wasHost, destroyed: true };
        }
        let newHostId;
        if (wasHost) {
            newHostId = remainingPlayerIds[0];
            room.hostId = newHostId;
            room.players[newHostId].isHost = true;
            room.players[newHostId].isReady = true;
            this.logger.log(`Host migrated in room ${upperCode} to ${room.players[newHostId].nickname}`);
        }
        return { room, wasHost, newHostId, destroyed: false };
    }
    scheduleDisconnectGrace(userId, onExpired) {
        const roomCode = this.userToRoom.get(userId);
        if (!roomCode)
            return;
        const timer = setTimeout(() => {
            this.disconnectedUsers.delete(userId);
            onExpired(roomCode, userId);
        }, 30000);
        this.disconnectedUsers.set(userId, { roomCode, timer });
        this.logger.log(`Disconnect grace started for user ${userId} in room ${roomCode}`);
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = RoomsService_1 = __decorate([
    (0, common_1.Injectable)()
], RoomsService);
//# sourceMappingURL=rooms.service.js.map