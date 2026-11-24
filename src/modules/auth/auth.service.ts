import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        nickname: dto.nickname.trim(),
        avatar: dto.avatar || '🎮',
        isGuest: false,
      },
    });

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        isGuest: user.isGuest,
        totalWins: user.totalWins,
        gamesPlayed: user.gamesPlayed,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        isGuest: user.isGuest,
        totalWins: user.totalWins,
        gamesPlayed: user.gamesPlayed,
      },
    };
  }

  async syncGuest(dto: GuestDto) {
    const user = await this.prisma.user.upsert({
      where: { id: dto.id },
      update: {
        nickname: dto.nickname.trim(),
        avatar: dto.avatar || '🎮',
      },
      create: {
        id: dto.id,
        nickname: dto.nickname.trim(),
        avatar: dto.avatar || '🎮',
        isGuest: true,
      },
    });

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      isGuest: user.isGuest,
      totalWins: user.totalWins,
      gamesPlayed: user.gamesPlayed,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        matchesAsP1: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        matchesAsP2: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      isGuest: user.isGuest,
      totalWins: user.totalWins,
      gamesPlayed: user.gamesPlayed,
      recentMatches: [...user.matchesAsP1, ...user.matchesAsP2]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
    };
  }

  async getLeaderboard() {
    return this.prisma.user.findMany({
      take: 10,
      orderBy: { totalWins: 'desc' },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        totalWins: true,
        gamesPlayed: true,
        isGuest: true,
      },
    });
  }

  async recordMatch(
    roomCode: string,
    player1Id: string,
    player2Id: string,
    winnerId: string | null,
    p1Score: number,
    p2Score: number
  ) {
    try {
      // Ensure both players exist in DB (upsert if they played as guests)
      await Promise.all([
        this.prisma.user.upsert({
          where: { id: player1Id },
          update: {
            gamesPlayed: { increment: 1 },
            totalWins: winnerId === player1Id ? { increment: 1 } : undefined,
          },
          create: {
            id: player1Id,
            nickname: 'Player 1',
            isGuest: true,
            gamesPlayed: 1,
            totalWins: winnerId === player1Id ? 1 : 0,
          },
        }),
        this.prisma.user.upsert({
          where: { id: player2Id },
          update: {
            gamesPlayed: { increment: 1 },
            totalWins: winnerId === player2Id ? { increment: 1 } : undefined,
          },
          create: {
            id: player2Id,
            nickname: 'Player 2',
            isGuest: true,
            gamesPlayed: 1,
            totalWins: winnerId === player2Id ? 1 : 0,
          },
        }),
      ]);

      // Record match row in Neon Postgres
      const match = await this.prisma.match.create({
        data: {
          roomCode,
          gameType: 'rock-paper-scissors',
          player1Id,
          player2Id,
          winnerId,
          p1Score,
          p2Score,
        },
      });

      this.logger.log(`Match recorded in NeonDB: ${match.id} (Winner: ${winnerId})`);
      return match;
    } catch (err: unknown) {
      this.logger.error('Failed to record match in database', err);
    }
  }
}
