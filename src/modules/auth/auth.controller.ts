import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from 'src/common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 1 daqiqada ko'pi bilan 5 ta urinish
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tizimga kirish va JWT token olish' })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli login' })
  @ApiResponse({ status: 401, description: 'Login yoki PIN xato' })
  @ApiResponse({ status: 429, description: 'Juda ko\'p urinish, biroz kuting' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Get('app-version')
  @ApiOperation({ summary: 'Mobil ilova OTA yangilanish versiyasini olish' })
  async getAppVersion() {
    const frontendUrl = process.env.FRONTEND_URL || 'https://undiruv-bank.vercel.app';
    try {
      const res = await fetch(`${frontendUrl.replace(/\/$/, '')}/version.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        return { success: true, ...data };
      }
    } catch (e: any) {}
    return {
      success: true,
      version: '1.0.0',
      url: `${frontendUrl}/update.zip`,
    };
  }
}
