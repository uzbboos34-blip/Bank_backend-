import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
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
    const versionFile = path.join(process.cwd(), 'public', 'ota', 'version.json');
    try {
      if (fs.existsSync(versionFile)) {
        const raw = fs.readFileSync(versionFile, 'utf-8');
        const data = JSON.parse(raw);
        const backendUrl = process.env.RENDER_EXTERNAL_URL || 'https://bank-backend-syzt.onrender.com';
        return {
          success: true,
          version: data.version,
          url: `${backendUrl.replace(/\/$/, '')}/auth/ota/update.zip`,
          releasedAt: data.releasedAt,
        };
      }
    } catch (e: any) {}

    return {
      success: true,
      version: '1.0.0',
      url: 'https://bank-backend-syzt.onrender.com/auth/ota/update.zip',
    };
  }

  @Public()
  @Get('ota/update.zip')
  @ApiOperation({ summary: 'Mobil ilova OTA yangilanish ZIP paketini yuklab olish' })
  async downloadOtaBundle(@Res() res: Response) {
    const zipPath = path.join(process.cwd(), 'public', 'ota', 'update.zip');
    if (!fs.existsSync(zipPath)) {
      throw new NotFoundException('Yangilanish paketi topilmadi');
    }
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="update.zip"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    fs.createReadStream(zipPath).pipe(res);
  }
}
