import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async createNote(debtorId: number, userId: number, dto: CreateNoteDto) {
    // 1. Qarzdor mavjudligini va aynan shu foydalanuvchiga tegishliligini tekshirish
    const debtor = await this.prisma.debtor.findUnique({
      where: { id: debtorId },
      select: { id: true, userId: true, status: true },
    });

    if (!debtor) {
      throw new NotFoundException('Qarzdor topilmadi');
    }

    if (debtor.userId !== userId) {
      throw new ForbiddenException('Bu qarzdorga qayd qo\'shish huquqingiz yo\'q');
    }

    // 2. Idempotentlik tekshiruvi: Agar clientId bilan qayd allaqachon yaratilgan bo'lsa
    const existingNote = await this.prisma.note.findUnique({
      where: { clientId: dto.clientId },
    });

    if (existingNote) {
      return existingNote;
    }

    // 3. Qayd yaratish va agar status kelsa debtor statusini yangilash (Tranzaksiya ichida tezkor)
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.note.create({
        data: {
          debtorId,
          clientId: dto.clientId,
          status: dto.status ?? null,
          text: dto.text ?? null,
        },
      });

      if (dto.status && dto.status !== debtor.status) {
        await tx.debtor.update({
          where: { id: debtorId },
          data: { status: dto.status },
        });
      }

      return note;
    });
  }

  async getDebtorNotes(debtorId: number, userId: number) {
    // Qarzdor foydalanuvchiga tegishliligini tekshirish
    const debtor = await this.prisma.debtor.findUnique({
      where: { id: debtorId },
      select: { id: true, userId: true },
    });

    if (!debtor) {
      throw new NotFoundException('Qarzdor topilmadi');
    }

    if (debtor.userId !== userId) {
      throw new ForbiddenException('Bu qarzdor ma\'lumotlarini ko\'rish huquqingiz yo\'q');
    }

    return this.prisma.note.findMany({
      where: { debtorId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
