import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger(HealthService.name);

  onModuleInit() {
    // Server to'liq ishlab ketishi uchun 10 soniyadan keyin self-ping ni boshlaymiz
    setTimeout(() => this.startSelfPinging(), 10000);
  }

  private startSelfPinging() {
    const externalUrl =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.RENDER_URL ||
      process.env.PING_URL ||
      process.env.BACKEND_URL;

    if (!externalUrl) {
      this.logger.warn(
        'RENDER_EXTERNAL_URL / PING_URL belgilanmagan. Render keep-alive self-ping o\'chirildi.',
      );
      return;
    }

    const healthUrl = `${externalUrl.replace(/\/$/, '')}/health`;
    this.logger.log(`🚀 Render keep-alive o'z-o'ziga ping xizmati ishga tushdi: ${healthUrl}`);

    // Har 10 daqiqada (600 000 ms) o'ziga so'rov yuborib serverni uyg'oq ushlab turadi
    setInterval(async () => {
      try {
        const res = await fetch(healthUrl);
        this.logger.log(`[KeepAlive] Ping holati: ${res.status} (${res.statusText})`);
      } catch (err: any) {
        this.logger.error(`[KeepAlive] Ping xatosi: ${err.message || err}`);
      }
    }, 10 * 60 * 1000);
  }
}
