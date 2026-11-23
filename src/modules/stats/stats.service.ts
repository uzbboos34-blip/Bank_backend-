import { Injectable } from '@nestjs/common';
import { DebtorStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Bugungi tezkor statistika
   */
  async getTodayStats(userId: number) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const total = await this.prisma.debtor.count({
      where: { userId, archived: false },
    });

    const visitedDebtors = await this.prisma.note.findMany({
      where: {
        debtor: { userId },
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { debtorId: true },
      distinct: ['debtorId'],
    });
    const visited = visitedDebtors.length;

    const promised = await this.prisma.debtor.count({
      where: { userId, archived: false, status: DebtorStatus.PROMISED },
    });

    const paid = await this.prisma.debtor.count({
      where: { userId, archived: false, status: DebtorStatus.PAID },
    });

    return { total, visited, promised, paid };
  }

  /**
   * Batafsil Hisobot (Screenshot 3 talabi bo'yicha: Bugun, Hafta, Oy)
   */
  async getDetailedReport(userId: number, period: 'bugun' | 'hafta' | 'oy' = 'bugun') {
    const now = new Date();
    let startDate = new Date();

    if (period === 'bugun') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'hafta') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'oy') {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    // 1. Shu davrda to'langan qarzdorlar
    const paidDebtors = await this.prisma.debtor.findMany({
      where: {
        userId,
        status: DebtorStatus.PAID,
        updatedAt: { gte: startDate },
      },
      select: {
        id: true,
        fullName: true,
        minDebt: true,
        principalDebt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Jami undirilgan summa
    const undirildiSum = paidDebtors.reduce(
      (sum, d) => sum + Number(d.minDebt || d.principalDebt || 0),
      0,
    );

    // 2. Borilganlar soni (Shu davrda qayd yozilgan qarzdorlar)
    const visitedNotes = await this.prisma.note.findMany({
      where: {
        debtor: { userId },
        createdAt: { gte: startDate },
      },
      select: { debtorId: true, status: true },
    });

    const distinctVisitedIds = new Set(visitedNotes.map((n) => n.debtorId));
    const borildiCount = Math.max(distinctVisitedIds.size, paidDebtors.length);

    // 3. Va'da berganlar
    const promisedDebtors = await this.prisma.debtor.findMany({
      where: {
        userId,
        status: DebtorStatus.PROMISED,
      },
      select: { minDebt: true },
    });
    const vadaCount = promisedDebtors.length;
    const vadaSum = promisedDebtors.reduce((sum, d) => sum + Number(d.minDebt || 0), 0);

    // 4. Uyda yo'qlar soni
    const uydaYoqCount = await this.prisma.debtor.count({
      where: { userId, status: DebtorStatus.NOT_HOME },
    });

    // Format money helper
    const fmt = (num: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(num));

    const dateStr = now.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' });
    const periodLabel = period === 'bugun' ? `${dateStr} hisoboti` : period === 'hafta' ? 'Haftalik hisobot' : 'Oylik hisobot';

    // Rahbarga yuboriladigan tayyor matn
    const summaryText = `${periodLabel}
Borildi: ${borildiCount} ta
To'ladi: ${paidDebtors.length} ta, ${fmt(undirildiSum)} so'm
Va'da berdi: ${vadaCount} ta, ${fmt(vadaSum)} so'm
Uyda yo'q: ${uydaYoqCount} ta`;

    return {
      period,
      dateString: dateStr,
      undirildiSum,
      undirildiFormatted: `${fmt(undirildiSum)} so'm`,
      tolaganCount: paidDebtors.length,
      borildiCount,
      vadaCount,
      vadaSum,
      uydaYoqCount,
      toLovlar: paidDebtors.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        amount: Number(d.minDebt || d.principalDebt || 0),
        amountFormatted: fmt(Number(d.minDebt || d.principalDebt || 0)),
      })),
      summaryText,
    };
  }
}
