import { Module } from '@nestjs/common';
import { DebtorsController } from './debtors.controller';
import { DebtorsService } from './debtors.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  controllers: [DebtorsController],
  providers: [DebtorsService],
  exports: [DebtorsService],
})
export class DebtorsModule {}
