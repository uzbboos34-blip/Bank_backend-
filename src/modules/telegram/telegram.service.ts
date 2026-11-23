import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private client: TelegramClient | null = null;
  private isConnected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      const apiId = Number(this.config.get('TG_APP_ID'));
      const apiHash = this.config.get<string>('TG_APP_HASH');
      const sessionStr = this.config.get<string>('TG_SESSION');

      if (!apiId || !apiHash || !sessionStr) {
        this.logger.warn('Telegram credentials topilmadi — rasm yuborish o\'chirilgan');
        return;
      }

      const session = new StringSession(sessionStr);
      this.client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 3,
      });

      await this.client.connect();
      this.isConnected = true;
      this.logger.log('✅ Telegram ulandi (shaxsiy akkaunt)');
    } catch (err) {
      this.logger.error('Telegram ulanishda xatolik: ' + err.message);
      this.isConnected = false;
    }
  }

  /**
   * Guruhga rasm + caption yuboradi (shaxsiy akkauntdan)
   * @param imageBase64 - base64 formatidagi rasm
   * @param caption     - rasm ostidagi matn
   */
  async sendPhoto(imageBase64: string, caption: string): Promise<{ success: boolean; message: string }> {
    if (!this.isConnected || !this.client) {
      const msg = `Telegram ulangan emas (connected: ${this.isConnected})`;
      this.logger.warn(msg);
      return { success: false, message: msg };
    }

    const chatId = this.config.get<string>('TG_CHAT_ID');
    if (!chatId) {
      const msg = 'TG_CHAT_ID sozlanmagan';
      this.logger.warn(msg);
      return { success: false, message: msg };
    }

    // base64 → temp fayl
    const tmpPath = path.join(os.tmpdir(), `photo_${Date.now()}.jpg`);
    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'));

      await this.client.sendFile(chatId, {
        file: tmpPath,
        caption: caption,
      });

      this.logger.log(`📸 Rasm guruhga yuborildi: ${chatId}`);
      return { success: true, message: 'Rasm yuborildi' };
    } catch (err: any) {
      const msg = 'Telegram sendFile xatosi: ' + (err.message || String(err));
      this.logger.error(msg);
      return { success: false, message: msg };
    } finally {
      // Temp faylni o'chiramiz
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  }

  get connected() {
    return this.isConnected;
  }
}
