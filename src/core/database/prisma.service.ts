import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger('Database');

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('PostgreSQL (Neon) muvaffaqiyatli ulandi.');
    } catch (error) {
      this.logger.error('Ma\'lumotlar bazasiga ulanishda xatolik:', (error as Error).message);
      process.exit(1);
    }
  }

  async onApplicationShutdown() {
    try {
      await this.$disconnect();
      this.logger.log('Ma\'lumotlar bazasi ulanishi uzildi.');
    } catch (error) {
      this.logger.error('Ulanishni uzishda xatolik:', (error as Error).message);
    }
  }
}
