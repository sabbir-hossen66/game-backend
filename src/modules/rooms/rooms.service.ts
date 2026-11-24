import { Injectable, Logger } from '@nestjs/common';
import { Room, RoomSettings, RoomSummary, RoomStatus } from '../../common/types/room.types';
import { UserProfile } from '../../common/types/user.types';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  private rooms: Map<string, Room> = new Map();
  private userToRoom: Map<string, string> = new Map(); // userId -> roomCode
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId
  private disconnectedUsers: Map<string, { roomCode: string; timer: NodeJS.Timeout }> = new Map();

  // Generate 6-character room code (e.g. "RPS892")
  private generateRoomCode(): string {
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

  createRoom(host: UserProfile, settings: RoomSettings): Room {
    const code = this.generateRoomCode();
    const newRoom: Room = {
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

  joinRoom(code: string, user: UserProfile, password?: string): { room: Room; isNew: boolean } {
    const upperCode = code.toUpperCase();
    const room = this.rooms.get(upperCode);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.isPrivate && room.password && room.password !== password) {
      throw new Error('Incorrect room password');
    }

    // Check if player is rejoining after disconnect
    const existingPlayer = room.players[user.id];
    if (existingPlayer) {
      // Clear disconnect timer if any
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
      return { room, isNew: false };
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
    return { room, isNew: true };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomByUserId(userId: string): Room | undefined {
    const code = this.userToRoom.get(userId);
    return code ? this.rooms.get(code) : undefined;
  }

  getUserIdBySocketId(socketId: string): string | undefined {
    return this.socketToUser.get(socketId);
  }

  setSocketUser(socketId: string, userId: string): void {
    this.socketToUser.set(socketId, userId);
  }

  removeSocket(socketId: string): string | undefined {
    const userId = this.socketToUser.get(socketId);
    if (userId) {
      this.socketToUser.delete(socketId);
    }
    return userId;
  }

  listPublicRooms(): RoomSummary[] {
    const summaries: RoomSummary[] = [];
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

  findQuickJoinRoom(): Room | undefined {
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

  setPlayerReady(code: string, userId: string, ready: boolean): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found');
    const player = room.players[userId];
    if (!player) throw new Error('Player not in room');

    player.isReady = ready;
    return room;
  }

  updatePlayerVoice(
    code: string,
    userId: string,
    isMuted: boolean,
    isSpeaking: boolean
  ): Room | undefined {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || !room.players[userId]) return undefined;

    room.players[userId].isMuted = isMuted;
    room.players[userId].isSpeaking = isSpeaking;
    return room;
  }

  hostMutePlayer(code: string, hostId: string, targetUserId: string, mute: boolean): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the room host can mute players');
    if (!room.players[targetUserId]) throw new Error('Player not in room');

    room.players[targetUserId].isMutedByHost = mute;
    return room;
  }

  hostKickPlayer(code: string, hostId: string, targetUserId: string): { room: Room; kickedUserId: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the host can kick players');
    if (targetUserId === hostId) throw new Error('Host cannot kick themselves');

    delete room.players[targetUserId];
    this.userToRoom.delete(targetUserId);

    return { room, kickedUserId: targetUserId };
  }

  updateRoomStatus(code: string, status: RoomStatus): Room | undefined {
    const room = this.rooms.get(code.toUpperCase());
    if (room) {
      room.status = status;
    }
    return room;
  }

  leaveRoom(code: string, userId: string): {
    room?: Room;
    wasHost: boolean;
    newHostId?: string;
    destroyed: boolean;
  } {
    const upperCode = code.toUpperCase();
    const room = this.rooms.get(upperCode);
    if (!room) return { wasHost: false, destroyed: true };

    const wasHost = room.hostId === userId;
    delete room.players[userId];
    this.userToRoom.delete(userId);

    const remainingPlayerIds = Object.keys(room.players);
    if (remainingPlayerIds.length === 0) {
      this.rooms.delete(upperCode);
      this.logger.log(`Room ${upperCode} destroyed (empty)`);
      return { wasHost, destroyed: true };
    }

    let newHostId: string | undefined;
    if (wasHost) {
      newHostId = remainingPlayerIds[0];
      room.hostId = newHostId;
      room.players[newHostId].isHost = true;
      room.players[newHostId].isReady = true;
      this.logger.log(`Host migrated in room ${upperCode} to ${room.players[newHostId].nickname}`);
    }

    return { room, wasHost, newHostId, destroyed: false };
  }

  scheduleDisconnectGrace(userId: string, onExpired: (roomCode: string, uid: string) => void): void {
    const roomCode = this.userToRoom.get(userId);
    if (!roomCode) return;

    // 30 seconds reconnect grace period
    const timer = setTimeout(() => {
      this.disconnectedUsers.delete(userId);
      onExpired(roomCode, userId);
    }, 30000);

    this.disconnectedUsers.set(userId, { roomCode, timer });
    this.logger.log(`Disconnect grace started for user ${userId} in room ${roomCode}`);
  }
}
