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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async register(dto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase().trim() },
        });
        if (existing) {
            throw new common_1.ConflictException('Email is already registered');
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
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase().trim() },
        });
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Invalid email or password');
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
    async syncGuest(dto) {
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
    async getProfile(userId) {
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
            throw new common_1.NotFoundException('User not found');
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
    async recordMatch(roomCode, player1Id, player2Id, winnerId, p1Score, p2Score) {
        try {
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
        }
        catch (err) {
            this.logger.error('Failed to record match in database', err);
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map