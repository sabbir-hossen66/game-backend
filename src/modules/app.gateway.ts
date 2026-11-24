import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms/rooms.service';
import { GamesService } from './games/games.service';
import { ChatService } from './chat/chat.service';
import { AuthService } from './auth/auth.service';
import { RoomSettings } from '../common/types/room.types';
import { UserProfile } from '../common/types/user.types';
import { RpsChoice } from '../common/types/game.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private readonly roomsService: RoomsService,
    private readonly gamesService: GamesService,
    private readonly chatService: ChatService,
    private readonly authService: AuthService
  ) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket disconnected: ${client.id}`);
    const userId = this.roomsService.removeSocket(client.id);
    if (!userId) return;

    const room = this.roomsService.getRoomByUserId(userId);
    if (!room) return;

    // Grace period of 30 seconds for reconnection
    this.roomsService.scheduleDisconnectGrace(userId, (roomCode, uid) => {
      const leaveResult = this.roomsService.leaveRoom(roomCode, uid);
      if (leaveResult.room) {
        this.server.to(roomCode).emit('room:updated', leaveResult.room);
        const sysMsg = this.chatService.createSystemMessage(
          roomCode,
          `Player disconnected permanently.`
        );
        this.server.to(roomCode).emit('chat:message', sysMsg);
      }
      this.gamesService.endGame(roomCode);
    });
  }

  @SubscribeMessage('room:list_public')
  handleListPublicRooms(@ConnectedSocket() client: Socket): void {
    const list = this.roomsService.listPublicRooms();
    client.emit('room:list', list);
  }

  @SubscribeMessage('room:create')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { user: UserProfile; settings: RoomSettings }
  ): void {
    try {
      const user = { ...payload.user, socketId: client.id };
      const room = this.roomsService.createRoom(user, payload.settings);
      client.join(room.code);
      client.emit('room:created', room);
      this.server.emit('room:list', this.roomsService.listPublicRooms());

      const welcomeMsg = this.chatService.createSystemMessage(
        room.code,
        `Room created! Code: ${room.code}. Share with your friend!`
      );
      client.emit('chat:message', welcomeMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('room:join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; user: UserProfile; password?: string }
  ): void {
    try {
      const user = { ...payload.user, socketId: client.id };
      const { room, isNew } = this.roomsService.joinRoom(payload.code, user, payload.password);
      client.join(room.code);

      // Emit room:joined to caller and room:updated to whole room
      client.emit('room:joined', room);
      this.server.to(room.code).emit('room:updated', room);
      this.server.emit('room:list', this.roomsService.listPublicRooms());

      if (isNew) {
        const joinMsg = this.chatService.createSystemMessage(
          room.code,
          `${user.nickname} entered the arena!`
        );
        this.server.to(room.code).emit('chat:message', joinMsg);
      }

      // Send existing chat history only to this user
      const history = this.chatService.getMessages(room.code);
      client.emit('chat:history', history);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('room:quick_join')
  handleQuickJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { user: UserProfile }
  ): void {
    try {
      let room = this.roomsService.findQuickJoinRoom();
      if (!room) {
        // Automatically create a public room if none is available
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to quick join';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('room:ready')
  handlePlayerReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; userId: string; ready: boolean }
  ): void {
    try {
      const room = this.roomsService.setPlayerReady(payload.code, payload.userId, payload.ready);
      this.server.to(room.code).emit('room:updated', room);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error setting ready';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('room:kick')
  handleKickPlayer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; hostId: string; targetUserId: string }
  ): void {
    try {
      const { room, kickedUserId } = this.roomsService.hostKickPlayer(
        payload.code,
        payload.hostId,
        payload.targetUserId
      );
      this.server.to(room.code).emit('room:updated', room);
      this.server.to(room.code).emit('room:player_kicked', { userId: kickedUserId });
      this.server.emit('room:list', this.roomsService.listPublicRooms());

      const kickMsg = this.chatService.createSystemMessage(
        room.code,
        `A player was removed by the host.`
      );
      this.server.to(room.code).emit('chat:message', kickMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error kicking player';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('room:mute_player')
  handleMutePlayer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; hostId: string; targetUserId: string; mute: boolean }
  ): void {
    try {
      const room = this.roomsService.hostMutePlayer(
        payload.code,
        payload.hostId,
        payload.targetUserId,
        payload.mute
      );
      this.server.to(room.code).emit('room:updated', room);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error muting player';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('room:leave')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; userId: string }
  ): void {
    const leaveResult = this.roomsService.leaveRoom(payload.code, payload.userId);
    client.leave(payload.code);
    if (leaveResult.room) {
      this.server.to(payload.code).emit('room:updated', leaveResult.room);
      const leaveMsg = this.chatService.createSystemMessage(
        payload.code,
        `A player left the room.`
      );
      this.server.to(payload.code).emit('chat:message', leaveMsg);
    }
    this.gamesService.endGame(payload.code);
    this.server.emit('room:list', this.roomsService.listPublicRooms());
  }

  @SubscribeMessage('game:start')
  handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; hostId: string }
  ): void {
    try {
      const room = this.roomsService.getRoom(payload.code);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== payload.hostId) throw new Error('Only the host can start the game');

      const playerIds = Object.keys(room.players);
      if (playerIds.length < 2) {
        throw new Error('Need at least 2 players to start a 1v1 battle');
      }

      this.roomsService.updateRoomStatus(room.code, 'playing');
      this.server.to(room.code).emit('room:updated', room);

      this.gamesService.startGame(
        room.code,
        [playerIds[0], playerIds[1]],
        room.roundsToWin || 3,
        (roomCode, getStateForUser) => {
          // Send customized state to each socket
          const r = this.roomsService.getRoom(roomCode);
          if (!r) return;
          for (const pid of Object.keys(r.players)) {
            const player = r.players[pid];
            if (player.socketId) {
              const state = getStateForUser(pid);
              this.server.to(player.socketId).emit('game:state', state);
            }
          }
        },
        async (winnerId) => {
          this.logger.log(`Game over in room ${room.code}. Winner: ${winnerId}`);
          const winName = winnerId && room.players[winnerId] ? room.players[winnerId].nickname : 'Nobody';
          const msg = this.chatService.createSystemMessage(
            room.code,
            `🏆 Match Finished! Winner: ${winName}!`
          );
          this.server.to(room.code).emit('chat:message', msg);

          // Permanently record match to Neon PostgreSQL
          const engine = this.gamesService.getGame(room.code);
          const state = engine ? engine.getState() : null;
          const p1Score = state?.scores[playerIds[0]] || 0;
          const p2Score = state?.scores[playerIds[1]] || 0;
          await this.authService.recordMatch(
            room.code,
            playerIds[0],
            playerIds[1],
            winnerId,
            p1Score,
            p2Score
          );
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error starting game';
      client.emit('error', { message });
    }
  }

  @SubscribeMessage('game:choose')
  handleGameChoice(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; userId: string; choice: RpsChoice }
  ): void {
    const success = this.gamesService.makeChoice(payload.code, payload.userId, payload.choice);
    if (!success) {
      client.emit('error', { message: 'Invalid move or round has already ended' });
    }
  }

  @SubscribeMessage('game:rematch')
  handleRematch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; userId: string }
  ): void {
    this.gamesService.requestRematch(payload.code, payload.userId);
  }

  @SubscribeMessage('chat:send')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; user: UserProfile; text: string }
  ): void {
    const msg = this.chatService.createMessage(payload.code, payload.user, payload.text, 'user');
    this.server.to(payload.code).emit('chat:message', msg);
  }

  @SubscribeMessage('chat:reaction')
  handleChatReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string; user: UserProfile; emoji: string }
  ): void {
    const msg = this.chatService.createMessage(
      payload.code,
      payload.user,
      payload.emoji,
      'reaction',
      payload.emoji
    );
    this.server.to(payload.code).emit('chat:message', msg);
  }

  // --- 100% FREE WebRTC Peer-to-Peer Voice Signaling ---
  @SubscribeMessage('voice:signal')
  handleVoiceSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      code: string;
      targetUserId: string;
      senderUserId: string;
      signal: unknown;
    }
  ): void {
    const room = this.roomsService.getRoom(payload.code);
    if (!room) return;
    const targetPlayer = room.players[payload.targetUserId];
    if (targetPlayer && targetPlayer.socketId) {
      this.server.to(targetPlayer.socketId).emit('voice:signal', {
        senderUserId: payload.senderUserId,
        signal: payload.signal,
      });
    }
  }

  @SubscribeMessage('voice:state')
  handleVoiceState(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      code: string;
      userId: string;
      isMuted: boolean;
      isSpeaking: boolean;
    }
  ): void {
    const room = this.roomsService.updatePlayerVoice(
      payload.code,
      payload.userId,
      payload.isMuted,
      payload.isSpeaking
    );
    if (room) {
      this.server.to(payload.code).emit('voice:state_changed', {
        userId: payload.userId,
        isMuted: payload.isMuted,
        isSpeaking: payload.isSpeaking,
      });
    }
  }
}
