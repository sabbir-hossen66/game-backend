import { AuthService, RegisterDto, LoginDto, GuestDto } from './auth.service';
import { JwtService } from '@nestjs/jwt';
export declare class AuthController {
    private readonly authService;
    private readonly jwtService;
    constructor(authService: AuthService, jwtService: JwtService);
    register(body: RegisterDto): Promise<import("./auth.service").AuthResponse>;
    login(body: LoginDto): Promise<import("./auth.service").AuthResponse>;
    syncGuest(body: GuestDto): Promise<{
        id: string;
        nickname: string;
        avatar: string;
        isGuest: boolean;
        totalWins: number;
        gamesPlayed: number;
    }>;
    getLeaderboard(): Promise<{
        id: string;
        nickname: string;
        avatar: string;
        isGuest: boolean;
        totalWins: number;
        gamesPlayed: number;
    }[]>;
    getProfile(authHeader?: string, queryUserId?: string): Promise<{
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
}
