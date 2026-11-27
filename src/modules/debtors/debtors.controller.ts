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
    if (!/\.(xlsx|xls)$/i.test(file.originalname || '')) {
      throw new BadRequestException("Noto'g'ri fayl formati! Faqat .xlsx yoki .xls Excel faylini yuklang.");
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
    @Body() body: {
      imageBase64: string;
      status: string;
      note?: string;
      takenAt?: string | number;
      promiseDate?: string;
      paidAmount?: number | string;
    },
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

    // Va'da sanasi (agar "Va'da berdi" bo'lsa)
    let promiseLine = '';
    if (body.status === 'PROMISED') {
      const rawPromise = body.promiseDate || debtor.promiseDate;
      if (rawPromise) {
        const pDate = new Date(rawPromise);
        if (!isNaN(pDate.getTime())) {
          const pStr = pDate.toLocaleDateString('ru-RU', {
            timeZone: 'Asia/Tashkent',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          promiseLine = `🗓 Va'da sanasi: ${pStr}`;
        }
      }
    }

    // To'langan summa (agar "To'ladi" bo'lsa)
    let paidLine = '';
    if (body.status === 'PAID') {
      let amountNum = Number(String(body.paidAmount ?? '').replace(/[^0-9]/g, '')) || 0;
      if (!amountNum && body.note) {
        const m = body.note.match(/([0-9][0-9\s.,]*)/);
        if (m) amountNum = Number(m[1].replace(/[^0-9]/g, '')) || 0;
      }
      if (!amountNum && debtor.notes?.[0]?.text) {
        const m = debtor.notes[0].text.match(/([0-9][0-9\s.,]*)/);
        if (m) amountNum = Number(m[1].replace(/[^0-9]/g, '')) || 0;
      }
      if (amountNum > 0) {
        paidLine = `💰 To'lagan summa: ${new Intl.NumberFormat('uz-UZ').format(amountNum)} so'm`;
      }
    }

    // Manzil takrorlanishini oldini olish (MFY address ichida bo'lsa)
    const mfyStr = (debtor.mfy || '').trim();
    const addrStr = (debtor.address || '').trim();
    const locationStr = mfyStr && addrStr.toLowerCase().includes(mfyStr.toLowerCase())
      ? addrStr
      : `${mfyStr} ${addrStr}`.trim();

    // Izohdan "To'ladi: X so'm." qismini olib tashlash (takrorlanmasligi uchun)
    const cleanNote = (body.note || '')
      .replace(/^To['’`]?ladi:\s*[0-9\s.,]+\s*(?:so['’`]?m|som|сум)?\.?\s*/i, '')
      .trim();

    const caption = [
      `📸 TASHRIF ISBOTI`,
      `👤 ${debtor.fullName}`,
      locationStr ? `📍 ${locationStr}` : '',
      `📋 Holat: ${statusLabels[body.status] || body.status}`,
      promiseLine,
      paidLine,
      `📅 ${dateStr}`,
      cleanNote ? `💬 Izoh: ${cleanNote}` : '',
    ].filter(Boolean).join('\n');

    // Telegramga yuborish orqa fonda asinxron ketadi — foydalanuvchi kutib turmaydi!
    this.telegramService.sendPhoto(body.imageBase64, caption).catch((err) => {
      // Background log
    });

    return { success: true, message: 'Rasm fonda yuborilmoqda' };
  }
}
