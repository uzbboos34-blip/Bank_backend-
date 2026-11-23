import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramService } from '../telegram/telegram.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly telegramService: TelegramService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Server holatini tekshirish (Render keep-alive ping)' })
  check() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      telegram: {
        hasAppId: !!this.config.get('TG_APP_ID'),
        hasAppHash: !!this.config.get('TG_APP_HASH'),
        hasSession: !!this.config.get('TG_SESSION'),
        sessionLen: this.config.get<string>('TG_SESSION')?.length || 0,
        chatId: this.config.get('TG_CHAT_ID') || null,
        isConnected: this.telegramService.connected,
      },
    };
  }
}
