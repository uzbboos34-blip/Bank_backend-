import { Injectable, NotFoundException } from '@nestjs/common';
import * as xlsx from 'xlsx';
import { PrismaService } from '../../core/database/prisma.service';
import { DebtorStatus, Prisma } from '@prisma/client';
import {
  DebtorSortOption,
  GetDebtorsQueryDto,
} from './dto/get-debtors-query.dto';
import { PatchDebtorDto } from './dto/patch-debtor.dto';
import { getSafePagination } from '../../common/helpers/pagination.helper';
import { parseExcelBuffer } from '../../common/helpers/excel.helper';

// Masofa hisoblash (Gaver-sinus formulasi bo'yicha)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Yer radiusi metrda
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  const km = (meters / 1000).toFixed(1).replace('.', ',');
  return `${km} km`;
}

@Injectable()
export class DebtorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Excel faylni import qilish va mavjud qarzdorlarni aqlli yangilash
   */
  async importDebtors(userId: number, fileBuffer: Buffer) {
    const parsedRows = parseExcelBuffer(fileBuffer);

    let created = 0;
    let updated = 0;
    let archived = 0;
    const skippedRows: { row: number; error: string }[] = [];

    const existingDebtors = await this.prisma.debtor.findMany({
      where: { userId },
    });
    const existingMap = new Map(existingDebtors.map((d) => [d.externalId, d]));
    const seenExternalIds = new Set<string>();

    for (const item of parsedRows) {
      if (item.error || !item.data) {
        skippedRows.push({
          row: item.row,
          error: item.error || 'Noma\'lum xatolik',
        });
        continue;
      }

      const data = item.data;
      seenExternalIds.add(data.externalId);
      const existing = existingMap.get(data.externalId);

      try {
        if (existing) {
          await this.prisma.debtor.update({
            where: { id: existing.id },
            data: {
              treasuryId: data.treasuryId ?? existing.treasuryId,
              code: data.code ?? existing.code,
              overdueDays: data.overdueDays !== undefined ? data.overdueDays : existing.overdueDays,
              officer: data.officer ?? existing.officer,
              mfy: data.mfy ?? existing.mfy,
              rawContract: data.rawContract ?? existing.rawContract,
              fullName: data.fullName,
              address: data.address ?? existing.address,
              phones: data.phones.length > 0 ? data.phones : existing.phones,
              phoneNote: data.phoneNote ?? existing.phoneNote,
              loanAmount: new Prisma.Decimal(data.loanAmount),
              issuedAt: data.issuedAt ?? existing.issuedAt,
              closingAt: data.closingAt ?? existing.closingAt,
              principalDebt: new Prisma.Decimal(data.principalDebt),
              interestDebt: new Prisma.Decimal(data.interestDebt),
              totalDebt: new Prisma.Decimal(data.totalDebt),
              minDebt: new Prisma.Decimal(data.minDebt),
              archived: false,
            },
          });
          updated++;
        } else {
          await this.prisma.debtor.create({
            data: {
              userId,
              externalId: data.externalId,
              treasuryId: data.treasuryId,
              code: data.code,
              overdueDays: data.overdueDays || 0,
              officer: data.officer,
              mfy: data.mfy,
              rawContract: data.rawContract,
              fullName: data.fullName,
              address: data.address,
              phones: data.phones,
              phoneNote: data.phoneNote,
              loanAmount: new Prisma.Decimal(data.loanAmount),
              issuedAt: data.issuedAt,
              closingAt: data.closingAt,
              principalDebt: new Prisma.Decimal(data.principalDebt),
              interestDebt: new Prisma.Decimal(data.interestDebt),
              totalDebt: new Prisma.Decimal(data.totalDebt),
              minDebt: new Prisma.Decimal(data.minDebt),
              status: DebtorStatus.NEW,
              archived: false,
            },
          });
          created++;
        }
      } catch (err) {
        skippedRows.push({
          row: item.row,
          error: `Saqlashda xatolik: ${(err as Error).message}`,
        });
      }
    }

    const missingDebtors = existingDebtors.filter(
      (d) => !d.archived && !seenExternalIds.has(d.externalId),
    );

    if (missingDebtors.length > 0) {
      const missingIds = missingDebtors.map((d) => d.id);
      await this.prisma.debtor.updateMany({
        where: { id: { in: missingIds } },
        data: { archived: true },
      });
      archived = missingDebtors.length;
    }

    return {
      created,
      updated,
      archived,
      skippedRows,
      importDate: new Date().toISOString(),
    };
  }

  /**
   * Qarzdorlar ro'yxatini olish (Tablar: Yangi, Jarayonda, To'lagan, Barchasi)
   */
  async getDebtors(
    userId: number,
    query: GetDebtorsQueryDto & { tab?: 'yangi' | 'jarayonda' | 'tolagan' | 'barchasi'; userLat?: number; userLng?: number },
  ) {
    const { skip, take, page, limit } = getSafePagination(query.page, query.limit);

    const baseWhere: Prisma.DebtorWhereInput = {
      userId,
      archived: false,
    };

    // 1. Tablar bo'yicha hisob-kitoblar (Bitta groupBy so'rovi bilan juda tez hisoblanadi)
    const [statusGroups, barchasiCount] = await Promise.all([
      this.prisma.debtor.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.debtor.count({
        where: baseWhere,
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const g of statusGroups) {
      statusMap[g.status] = g._count._all;
    }
    const yangiCount = statusMap[DebtorStatus.NEW] || 0;
    const tolaganCount = statusMap[DebtorStatus.PAID] || 0;
    const jarayondaCount =
      (statusMap[DebtorStatus.PROMISED] || 0) +
      (statusMap[DebtorStatus.NOT_HOME] || 0) +
      (statusMap[DebtorStatus.NO_MONEY] || 0) +
      (statusMap[DebtorStatus.PHONE_OFF] || 0) +
      (statusMap[DebtorStatus.MOVED] || 0);

    const where: Prisma.DebtorWhereInput = { ...baseWhere };

    // Status filtri (Agar alohida status tanlangan bo'lsa, u ustunlik qiladi)
    if (query.status) {
      where.status = query.status;
    } else if (query.tab === 'yangi') {
      where.status = DebtorStatus.NEW;
    } else if (query.tab === 'jarayonda') {
      where.status = {
        in: [
          DebtorStatus.PROMISED,
          DebtorStatus.NOT_HOME,
          DebtorStatus.NO_MONEY,
          DebtorStatus.PHONE_OFF,
          DebtorStatus.MOVED,
        ],
      };
    } else if (query.tab === 'tolagan') {
      where.status = DebtorStatus.PAID;
    }

    if (query.mfy) {
      where.mfy = { contains: query.mfy.trim(), mode: 'insensitive' };
    }

    // Backendda tezkor qidiruv (Ism, Manzil, MFY, ID, Xazna ID, Telefon, Izoh)
    if (query.search) {
      const s = query.search.trim();
      const phoneFormat = s.replace(/[^0-9]/g, '');

      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { address: { contains: s, mode: 'insensitive' } },
        { mfy: { contains: s, mode: 'insensitive' } },
        { externalId: { contains: s, mode: 'insensitive' } },
        { treasuryId: { contains: s, mode: 'insensitive' } },
        { phoneNote: { contains: s, mode: 'insensitive' } },
        { rawContract: { contains: s, mode: 'insensitive' } },
      ];

      if (phoneFormat.length >= 4) {
        where.OR.push({ phones: { hasSome: [`+${phoneFormat}`, `+998${phoneFormat}`, phoneFormat] } });
      }
    }

    let orderBy: Prisma.DebtorOrderByWithRelationInput = { overdueDays: 'desc' };

    if (query.sort === DebtorSortOption.MIN_DEBT_DESC) {
      orderBy = { minDebt: 'desc' };
    } else if (query.sort === DebtorSortOption.NAME_ASC) {
      orderBy = { fullName: 'asc' };
    } else if (query.sort === DebtorSortOption.PROMISE_DATE_ASC) {
      orderBy = { promiseDate: 'asc' };
    }

    const [rawItems, total, aggregates] = await Promise.all([
      this.prisma.debtor.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          notes: {
            orderBy: { id: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.debtor.count({ where }),
      this.prisma.debtor.aggregate({
        where,
        _sum: {
          principalDebt: true,
          interestDebt: true,
          totalDebt: true,
          minDebt: true,
          loanAmount: true,
        },
      }),
    ]);

    // Masofa hisoblash (User lokatsiyasiga qarab yoki Beruniy markaziga qarab)
    const uLat = query.userLat || 41.6911; // Beruniy kengligi
    const uLng = query.userLng || 60.7525; // Beruniy uzunligi

    const items = rawItems.map((debtor, idx) => {
      let distanceMeters: number;
      if (debtor.lat && debtor.lng) {
        distanceMeters = getDistanceMeters(uLat, uLng, debtor.lat, debtor.lng);
      } else {
        const demoDistances = [350, 700, 1200, 2400, 4100, 5200, 800, 1500];
        distanceMeters = demoDistances[(debtor.id + idx) % demoDistances.length];
      }
      return {
        ...debtor,
        distanceMeters,
        distanceFormatted: formatDistance(distanceMeters),
        lastNote: debtor.notes?.[0] || null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      counts: {
        yangi: yangiCount,
        jarayonda: jarayondaCount,
        tolagan: tolaganCount,
        barchasi: barchasiCount,
      },
      totals: {
        principalDebt: Number(aggregates._sum.principalDebt || 0),
        interestDebt: Number(aggregates._sum.interestDebt || 0),
        totalDebt: Number(aggregates._sum.totalDebt || 0),
        minDebt: Number(aggregates._sum.minDebt || 0),
        loanAmount: Number(aggregates._sum.loanAmount || 0),
      },
    };
  }

  /**
   * Bugungi ro'yxat
   */
  async getTodayDebtors(userId: number) {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return this.prisma.debtor.findMany({
      where: {
        userId,
        archived: false,
        status: { not: DebtorStatus.PAID },
        promiseDate: {
          not: null,
          lte: todayEnd,
        },
      },
      orderBy: { promiseDate: 'asc' },
      include: {
        notes: {
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });
  }

  /**
   * Bitta qarzdor ma'lumotlarini olish (qaydlari bilan)
   */
  async getDebtorById(id: number, userId: number, userLat?: number, userLng?: number) {
    const debtor = await this.prisma.debtor.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!debtor || debtor.userId !== userId) {
      throw new NotFoundException('Qarzdor topilmadi');
    }

    // Beruniy markaziy koordinatasi (Toshkent emas)
    const uLat = userLat || 41.6911;
    const uLng = userLng || 60.7525;
    let distanceMeters = 500;
    if (debtor.lat && debtor.lng) {
      distanceMeters = getDistanceMeters(uLat, uLng, debtor.lat, debtor.lng);
    }

    return {
      ...debtor,
      distanceMeters,
      distanceFormatted: formatDistance(distanceMeters),
      lastNote: debtor.notes[0] || null,
    };
  }

  /**
   * Qarzdorni yangilash (Status, Va'da sanasi, Lokatsiya, Telefon, Manzil)
   */
  async patchDebtor(id: number, userId: number, dto: PatchDebtorDto) {
    const debtor = await this.prisma.debtor.findUnique({ where: { id } });
    if (!debtor || debtor.userId !== userId) {
      throw new NotFoundException('Qarzdor topilmadi');
    }

    const data: Prisma.DebtorUpdateInput = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.promiseDate !== undefined) {
      data.promiseDate = dto.promiseDate ? new Date(dto.promiseDate) : null;
    }

    if (dto.lat !== undefined && dto.lng !== undefined) {
      data.lat = dto.lat;
      data.lng = dto.lng;
    }

    // Telefon raqamlarni yangilash (bo'sh bo'lmagan qiymatlar saqlanadi)
    if (dto.phones !== undefined) {
      const cleaned = dto.phones
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      data.phones = cleaned;
    }

    // Manzilni yangilash
    if (dto.address !== undefined) {
      data.address = dto.address.trim();
    }

    return this.prisma.debtor.update({
      where: { id },
      data,
    });
  }

  /**
   * Bitta qarzdorni o'chirish
   */
  async deleteDebtor(id: number, userId: number) {
    const debtor = await this.prisma.debtor.findUnique({ where: { id } });
    if (!debtor || debtor.userId !== userId) {
      throw new NotFoundException('Qarzdor topilmadi');
    }
    // Avval bog'liq qaydlarni o'chiramiz
    await this.prisma.note.deleteMany({ where: { debtorId: id } });
    await this.prisma.debtor.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  /**
   * Ko'p qarzdorlarni bir vaqtda o'chirish
   */
  async bulkDelete(ids: number[], userId: number) {
    // Faqat shu foydalanuvchiga tegishli bo'lganlarini o'chiramiz
    const debtors = await this.prisma.debtor.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true },
    });
    const validIds = debtors.map((d) => d.id);
    if (validIds.length === 0) {
      throw new NotFoundException('O\'chiriladigan qarzdorlar topilmadi');
    }
    await this.prisma.note.deleteMany({ where: { debtorId: { in: validIds } } });
    await this.prisma.debtor.deleteMany({ where: { id: { in: validIds } } });
    return { success: true, deletedCount: validIds.length, deletedIds: validIds };
  }

  /**
   * Qarzdorlar ro'yxatini haqiqiy Excel (.xlsx) fayl sifatida eksport qilish
   */
  async exportExcel(
    userId: number,
    query: GetDebtorsQueryDto & { tab?: 'yangi' | 'jarayonda' | 'tolagan' | 'barchasi' },
  ): Promise<Buffer> {
    const where: Prisma.DebtorWhereInput = { userId, archived: false };

    if (query.status) {
      where.status = query.status;
    } else if (query.tab === 'yangi') {
      where.status = DebtorStatus.NEW;
    } else if (query.tab === 'jarayonda') {
      where.status = {
        in: [
          DebtorStatus.PROMISED,
          DebtorStatus.NOT_HOME,
          DebtorStatus.NO_MONEY,
          DebtorStatus.PHONE_OFF,
          DebtorStatus.MOVED,
        ],
      };
    } else if (query.tab === 'tolagan') {
      where.status = DebtorStatus.PAID;
    }

    if (query.mfy) {
      where.mfy = { contains: query.mfy.trim(), mode: 'insensitive' };
    }

    if (query.search) {
      const s = query.search.trim();
      const phoneFormat = s.replace(/[^0-9]/g, '');
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { address: { contains: s, mode: 'insensitive' } },
        { mfy: { contains: s, mode: 'insensitive' } },
        { externalId: { contains: s, mode: 'insensitive' } },
        { treasuryId: { contains: s, mode: 'insensitive' } },
        { phoneNote: { contains: s, mode: 'insensitive' } },
        { rawContract: { contains: s, mode: 'insensitive' } },
      ];
      if (phoneFormat.length >= 4) {
        where.OR.push({ phones: { hasSome: [`+${phoneFormat}`, `+998${phoneFormat}`, phoneFormat] } });
      }
    }

    const debtors = await this.prisma.debtor.findMany({
      where,
      orderBy: { overdueDays: 'desc' },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const fmtDate = (d?: Date | null) => {
      if (!d) return '';
      return new Date(d).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    const statusLabels: Record<string, string> = {
      NEW: 'Yangi',
      PROMISED: "Va'da berdi",
      PAID: "To'ladi",
      NOT_HOME: "Uyda yo'q",
      NO_MONEY: "Pul yo'q",
      PHONE_OFF: "Telefon o'chiq",
      MOVED: "Ko'chib ketgan",
    };

    const rows = debtors.map((d, idx) => ({
      '№': idx + 1,
      ID: d.externalId || '',
      'Xazna ID': d.treasuryId || '',
      'Maks kun': d.overdueDays || 0,
      '22-band': d.code || '0',
      'Mijoz nomi': d.fullName || '',
      Telefon: (d.phones || []).join(', '),
      MFY: d.mfy || '',
      Manzil: d.address || '',
      'Kredit summasi': Number(d.loanAmount || 0),
      'Berilgan sana': fmtDate(d.issuedAt),
      'Tugallanish sana': fmtDate(d.closingAt),
      'Asosiy qarz': Number(d.principalDebt || 0),
      'Jami qarzdorlik': Number(d.totalDebt || 0),
      'JAMI minimal': Number(d.minDebt || 0),
      Holati: statusLabels[d.status] || d.status,
      "Va'da sanasi": d.status === DebtorStatus.PROMISED ? fmtDate(d.promiseDate) : '',
      Izoh: d.notes?.[0]?.text || d.phoneNote || '',
    }));

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Qarzdorlar');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
