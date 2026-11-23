import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './core/database/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DebtorsModule } from './modules/debtors/debtors.module';
import { NotesModule } from './modules/notes/notes.module';
import { StatsModule } from './modules/stats/stats.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    DebtorsModule,
    NotesModule,
    StatsModule,
    TelegramModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Barcha endpointlar avtomatik JWT bilan himoyalangan (@Public() dan tashqari)
    },
  ],
})
export class AppModule {}
