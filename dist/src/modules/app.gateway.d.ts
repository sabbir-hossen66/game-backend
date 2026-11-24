import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms/rooms.service';
import { GamesService } from './games/games.service';
import { ChatService } from './chat/chat.service';
import { RoomSettings } from '../common/types/room.types';
import { UserProfile } from '../common/types/user.types';
import { RpsChoice } from '../common/types/game.types';
export declare class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly roomsService;
    private readonly gamesService;
    private readonly chatService;
    server: Server;
    private readonly logger;
    constructor(roomsService: RoomsService, gamesService: GamesService, chatService: ChatService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleListPublicRooms(client: Socket): void;
    handleCreateRoom(client: Socket, payload: {
        user: UserProfile;
        settings: RoomSettings;
    }): void;
    handleJoinRoom(client: Socket, payload: {
        code: string;
        user: UserProfile;
        password?: string;
    }): void;
    handleQuickJoin(client: Socket, payload: {
        user: UserProfile;
    }): void;
    handlePlayerReady(client: Socket, payload: {
        code: string;
        userId: string;
        ready: boolean;
    }): void;
    handleKickPlayer(client: Socket, payload: {
        code: string;
        hostId: string;
        targetUserId: string;
    }): void;
    handleMutePlayer(client: Socket, payload: {
        code: string;
        hostId: string;
        targetUserId: string;
        mute: boolean;
    }): void;
    handleLeaveRoom(client: Socket, payload: {
        code: string;
        userId: string;
    }): void;
    handleStartGame(client: Socket, payload: {
        code: string;
        hostId: string;
    }): void;
    handleGameChoice(client: Socket, payload: {
        code: string;
        userId: string;
        choice: RpsChoice;
    }): void;
    handleRematch(client: Socket, payload: {
        code: string;
        userId: string;
    }): void;
    handleChatMessage(client: Socket, payload: {
        code: string;
        user: UserProfile;
        text: string;
    }): void;
    handleChatReaction(client: Socket, payload: {
        code: string;
        user: UserProfile;
        emoji: string;
    }): void;
    handleVoiceSignal(client: Socket, payload: {
        code: string;
        targetUserId: string;
        senderUserId: string;
        signal: unknown;
    }): void;
    handleVoiceState(client: Socket, payload: {
        code: string;
        userId: string;
        isMuted: boolean;
        isSpeaking: boolean;
    }): void;
}
