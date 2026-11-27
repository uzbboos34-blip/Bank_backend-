import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserPayload } from 'src/common/types/user';
import { DebtorsService } from './debtors.service';
import { GetDebtorsQueryDto } from './dto/get-debtors-query.dto';
import { PatchDebtorDto } from './dto/patch-debtor.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { TelegramService } from '../telegram/telegram.service';

@ApiTags('Debtors')
@ApiBearerAuth('bearer')
@Controller('debtors')
export class DebtorsController {
  constructor(
    private readonly debtorsService: DebtorsService,
    private readonly telegramService: TelegramService,
  ) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Excel fayl orqali qarzdorlar ro\'yxatini import qilish' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Qarzdorlar ro\'yxati Excel fayli (.xlsx, .xls)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Import natijasi: { created, updated, archived, skippedRows }',
  })
  async importDebtors(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Iltimos, Excel faylni yuklang (field "file")');
    }
    return this.debtorsService.importDebtors(user.id, file.buffer);
  }

  @Get('export')
  @ApiOperation({ summary: 'Qarzdorlar ro\'yxatini haqiqiy Excel (.xlsx) fayl sifatida yuklab olish' })
  async exportDebtors(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: GetDebtorsQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.debtorsService.exportExcel(user.id, query);
    const fileName = `NPL_Kreditlar_Portfeli_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Qarzdorlar ro\'yxatini olish (qidirish, filtrlash, sahifalash)' })
  @ApiResponse({ status: 200, description: 'Qarzdorlar ro\'yxati va umumiy soni' })
  async getDebtors(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: GetDebtorsQueryDto,
  ) {
    return this.debtorsService.getDebtors(user.id, query);
  }

  @Get('today')
  @ApiOperation({ summary: 'Bugungi rejadagi qarzdorlar (promiseDate bugun/o\'tib ketgan, to\'lanmagan)' })
  @ApiResponse({ status: 200, description: 'Bugungi reja ro\'yxati' })
  async getTodayDebtors(@CurrentUser() user: CurrentUserPayload) {
    return this.debtorsService.getTodayDebtors(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta qarzdorning to\'liq ma\'lumotlari va qaydlarini ko\'rish' })
  @ApiResponse({ status: 200, description: 'Qarzdor ma\'lumotlari' })
  @ApiResponse({ status: 404, description: 'Qarzdor topilmadi' })
  async getDebtor(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.debtorsService.getDebtorById(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Qarzdor holatini, va\'da sanasini yoki joylashuvini yangilash' })
  @ApiResponse({ status: 200, description: 'Muvaffaqiyatli yangilandi' })
  async patchDebtor(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PatchDebtorDto,
  ) {
    return this.debtorsService.patchDebtor(id, user.id, dto);
  }

  @Delete('bulk')
  @ApiOperation({ summary: "Ko'p qarzdorlarni bir vaqtda o'chirish" })
  @ApiResponse({ status: 200, description: "O'chirilgan qarzdorlar soni" })
  async bulkDelete(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkDeleteDto,
  ) {
    return this.debtorsService.bulkDelete(dto.ids, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Bitta qarzdorni o'chirish" })
  @ApiResponse({ status: 200, description: "Muvaffaqiyatli o'chirildi" })
  @ApiResponse({ status: 404, description: 'Qarzdor topilmadi' })
  async deleteDebtor(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.debtorsService.deleteDebtor(id, user.id);
  }

  @Post(':id/send-photo')
  @ApiOperation({ summary: 'Qarzdorga tashrif rasmini Telegram guruhga yuborish' })
  @ApiResponse({ status: 200, description: 'Rasm yuborildi yoki xato' })
  async sendPhoto(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { imageBase64: string; status: string; note?: string; takenAt?: string | number },
  ) {
    // Qarzdor ma'lumotlarini olamiz
    const debtor = await this.debtorsService.getDebtorById(id, user.id);

    const statusLabels: Record<string, string> = {
      NOT_HOME: "Uyda yo'q",
      PROMISED: "Va'da berdi",
      NO_MONEY: "Pul yo'q",
      PHONE_OFF: "Telefon o'chiq",
      MOVED: "Ko'chib ketgan",
      PAID: "To'ladi",
    };

    // Rasm olingan vaqt (Toshkent vaqti bilan)
    const photoTime = body.takenAt ? new Date(Number(body.takenAt) || body.takenAt) : new Date();
    const dateStr = photoTime.toLocaleDateString('uz-UZ', {
      timeZone: 'Asia/Tashkent',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const caption = [
      `📸 TASHRIF ISBOTI`,
      `👤 ${debtor.fullName}`,
      `📍 ${debtor.mfy || ''} ${debtor.address || ''}`.trim(),
      `📋 Holat: ${statusLabels[body.status] || body.status}`,
      `📅 ${dateStr}`,
      body.note ? `💬 Izoh: ${body.note}` : '',
    ].filter(Boolean).join('\n');

    // Telegramga yuborish orqa fonda asinxron ketadi — foydalanuvchi kutib turmaydi!
    this.telegramService.sendPhoto(body.imageBase64, caption).catch((err) => {
      // Background log
    });

    return { success: true, message: 'Rasm fonda yuborilmoqda' };
  }
}
