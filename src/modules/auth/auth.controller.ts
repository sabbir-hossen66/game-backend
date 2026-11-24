import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthService,
  RegisterDto,
  LoginDto,
  GuestDto,
} from './auth.service';
import { JwtService } from '@nestjs/jwt';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('guest')
  async syncGuest(@Body() body: GuestDto) {
    return this.authService.syncGuest(body);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.authService.getLeaderboard();
  }

  @Get('me')
  async getProfile(
    @Headers('authorization') authHeader?: string,
    @Query('userId') queryUserId?: string
  ) {
    let targetUserId = queryUserId;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = this.jwtService.verify<{ sub: string }>(token);
        targetUserId = decoded.sub;
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }

    if (!targetUserId) {
      throw new UnauthorizedException('UserId or Bearer token is required');
    }

    return this.authService.getProfile(targetUserId);
  }
}
