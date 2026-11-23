import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
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
    return this.debtorsService.importExcel(file.buffer, user.id);
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

  @Post(':id/send-photo')
  @ApiOperation({ summary: 'Qarzdorga tashrif rasmini Telegram guruhga yuborish' })
  @ApiResponse({ status: 200, description: 'Rasm yuborildi yoki xato' })
  async sendPhoto(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { imageBase64: string; status: string; note?: string },
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

    const now = new Date();
    const dateStr = now.toLocaleDateString('uz-UZ', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const caption = [
      `📸 TASHRIF ISBOTI`,
      `👤 ${debtor.fullName}`,
      `📍 ${debtor.mfy || ''} ${debtor.address || ''}`.trim(),
      `📋 Holat: ${statusLabels[body.status] || body.status}`,
      `📅 ${dateStr}`,
      `👨‍💼 Kollektor: ${user.login || 'bank_collector'}`,
      body.note ? `💬 Izoh: ${body.note}` : '',
    ].filter(Boolean).join('\n');

    const sent = await this.telegramService.sendPhoto(body.imageBase64, caption);
    return { success: sent, message: sent ? 'Rasm yuborildi' : 'Yuborishda xatolik' };
  }
}
