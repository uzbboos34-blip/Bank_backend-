import { Injectable, NotFoundException } from '@nestjs/common';
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

    // Tab filtri
    if (query.tab === 'yangi') {
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
    } else if (query.tab === 'barchasi') {
      // Barchasi bo'lsa status bo'yicha cheklov yo'q
    } else if (query.status) {
      where.status = query.status;
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

    // Masofa hisoblash (User lokatsiyasiga qarab yoki chiroyli demo masofa)
    const uLat = query.userLat || 41.2995;
    const uLng = query.userLng || 69.2401;

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

    const uLat = userLat || 41.2995;
    const uLng = userLng || 69.2401;
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
   * Qarzdorni yangilash (Status, Va'da sanasi, Lokatsiya)
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

    return this.prisma.debtor.update({
      where: { id },
      data,
    });
  }
}
