import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentUserPayload } from 'src/common/types/user';
import { CreateNoteDto } from './dto/create-note.dto';
import { NotesService } from './notes.service';

@ApiTags('Debtors Notes')
@ApiBearerAuth('bearer')
@Controller('debtors/:id/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @ApiOperation({ summary: 'Qarzdorga qayd qo\'shish (Idempotent clientId bilan)' })
  @ApiResponse({ status: 201, description: 'Qayd muvaffaqiyatli yaratildi yoki mavjudi qaytarildi' })
  async createNote(
    @Param('id', ParseIntPipe) debtorId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.createNote(debtorId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Qarzdorning barcha qaydlarini olish' })
  @ApiResponse({ status: 200, description: 'Qaydlar ro\'yxati' })
  async getNotes(
    @Param('id', ParseIntPipe) debtorId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.notesService.getDebtorNotes(debtorId, user.id);
  }
}
