import { Module } from '@nestjs/common';
import { RoomsService } from './modules/rooms/rooms.service';
import { GamesService } from './modules/games/games.service';
import { ChatService } from './modules/chat/chat.service';
import { AppGateway } from './modules/app.gateway';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [],
  providers: [AppGateway, RoomsService, GamesService, ChatService],
})
export class AppModule {}
