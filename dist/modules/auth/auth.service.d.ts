import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
export interface RegisterDto {
    email: string;
    password: string;
    nickname: string;
    avatar?: string;
}
export interface LoginDto {
    email: string;
    password: string;
}
export interface GuestDto {
    id: string;
    nickname: string;
    avatar?: string;
}
export interface AuthResponse {
    token: string;
    user: {
        id: string;
        email: string | null;
        nickname: string;
        avatar: string;
        isGuest: boolean;
        totalWins: number;
        gamesPlayed: number;
    };
}
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(dto: RegisterDto): Promise<AuthResponse>;
    login(dto: LoginDto): Promise<AuthResponse>;
    syncGuest(dto: GuestDto): Promise<{
        id: string;
        nickname: string;
        avatar: string;
        isGuest: boolean;
        totalWins: number;
        gamesPlayed: number;
    }>;
    getProfile(userId: string): Promise<{
        id: string;
        email: string | null;
        nickname: string;
        avatar: string;
        isGuest: boolean;
        totalWins: number;
        gamesPlayed: number;
        recentMatches: {
            id: string;
            createdAt: Date;
            roomCode: string;
            gameType: string;
            player1Id: string;
            player2Id: string;
            winnerId: string | null;
            p1Score: number;
            p2Score: number;
        }[];
    }>;
    getLeaderboard(): Promise<{
        id: string;
        nickname: string;
        avatar: string;
        isGuest: boolean;
        totalWins: number;
        gamesPlayed: number;
    }[]>;
    recordMatch(roomCode: string, player1Id: string, player2Id: string, winnerId: string | null, p1Score: number, p2Score: number): Promise<{
        id: string;
        createdAt: Date;
        roomCode: string;
        gameType: string;
        player1Id: string;
        player2Id: string;
        winnerId: string | null;
        p1Score: number;
        p2Score: number;
    } | undefined>;
}
