import { Room, RoomSettings, RoomSummary, RoomStatus } from '../../common/types/room.types';
import { UserProfile } from '../../common/types/user.types';
export declare class RoomsService {
    private readonly logger;
    private rooms;
    private userToRoom;
    private socketToUser;
    private disconnectedUsers;
    private generateRoomCode;
    createRoom(host: UserProfile, settings: RoomSettings): Room;
    joinRoom(code: string, user: UserProfile, password?: string): {
        room: Room;
        isNew: boolean;
    };
    getRoom(code: string): Room | undefined;
    getRoomByUserId(userId: string): Room | undefined;
    getUserIdBySocketId(socketId: string): string | undefined;
    setSocketUser(socketId: string, userId: string): void;
    removeSocket(socketId: string): string | undefined;
    listPublicRooms(): RoomSummary[];
    findQuickJoinRoom(): Room | undefined;
    setPlayerReady(code: string, userId: string, ready: boolean): Room;
    updatePlayerVoice(code: string, userId: string, isMuted: boolean, isSpeaking: boolean): Room | undefined;
    hostMutePlayer(code: string, hostId: string, targetUserId: string, mute: boolean): Room;
    hostKickPlayer(code: string, hostId: string, targetUserId: string): {
        room: Room;
        kickedUserId: string;
    };
    updateRoomStatus(code: string, status: RoomStatus): Room | undefined;
    leaveRoom(code: string, userId: string): {
        room?: Room;
        wasHost: boolean;
        newHostId?: string;
        destroyed: boolean;
    };
    scheduleDisconnectGrace(userId: string, onExpired: (roomCode: string, uid: string) => void): void;
}
