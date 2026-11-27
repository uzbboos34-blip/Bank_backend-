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
   * Qayd matnidan to'langan summani ajratib olish yordamchisi
   */
  private extractPaidAmount(text?: string | null): number {
    if (!text) return 0;
    // 1. "To'ladi: 1 800 000 so'm" yoki "To'ladi: 500000"
    const match = text.match(/To['’`]?ladi:\s*([0-9\s.,]+)/i);
    if (match) {
      const digits = match[1].replace(/[^0-9]/g, '');
      if (digits) return Number(digits);
    }
    // 2. "500 000 so'm" yoki "1 200 000 som"
    const genericMatch = text.match(/([0-9][0-9\s.,]{2,})\s*(?:so['’`]?m|som|сум)/i);
    if (genericMatch) {
      const digits = genericMatch[1].replace(/[^0-9]/g, '');
      if (digits) return Number(digits);
    }
    // 3. Faqat raqamlar
    const onlyDigits = text.replace(/[^0-9]/g, '');
    if (onlyDigits.length >= 4) {
      return Number(onlyDigits);
    }
    return 0;
  }

  /**
   * Batafsil Hisobot (Screenshot 1 va 2 talablari bo'yicha)
   * Qoida:
   * 1. Qarzdorning to'lagan summasi minimal qarzidan katta yoki teng bo'lishi shart (to'lov >= minDebt).
   * 2. Agar kam to'lagan bo'lsa — hisobotga o'tmaydi.
   * 3. Agar minimaldan katta bo'lsa — "Bugun undirildi"ga to'lagan puli emas,
   *    uning ASOSIY QARZI (principalDebt) qo'shiladi!
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

    // 1. Shu davrda yaratilgan to'lov qaydlari va to'langan qarzdorlar
    const paidNotes = await this.prisma.note.findMany({
      where: {
        debtor: { userId },
        status: DebtorStatus.PAID,
        createdAt: { gte: startDate },
      },
      include: {
        debtor: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const paidStatusDebtors = await this.prisma.debtor.findMany({
      where: {
        userId,
        status: DebtorStatus.PAID,
        updatedAt: { gte: startDate },
      },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Har bir qarzdor bo'yicha to'lov ma'lumotlarini birlashtiramiz (takrorlanmasligi uchun)
    const debtorPaymentsMap = new Map<number, {
      id: number;
      fullName: string;
      minDebt: number;
      principalDebt: number;
      paidAmount: number;
    }>();

    // 1-manba: PAID qaydlar
    for (const note of paidNotes) {
      if (!note.debtor) continue;
      const dId = note.debtor.id;
      const parsedAmount = this.extractPaidAmount(note.text);
      if (!debtorPaymentsMap.has(dId)) {
        debtorPaymentsMap.set(dId, {
          id: dId,
          fullName: note.debtor.fullName,
          minDebt: Number(note.debtor.minDebt || 0),
          principalDebt: Number(note.debtor.principalDebt || 0),
          paidAmount: parsedAmount,
        });
      } else {
        const existing = debtorPaymentsMap.get(dId)!;
        existing.paidAmount = Math.max(existing.paidAmount, parsedAmount);
      }
    }

    // 2-manba: Statusi PAID bo'lgan qarzdorlar
    for (const d of paidStatusDebtors) {
      const dId = d.id;
      let parsedAmount = 0;
      for (const n of d.notes) {
        const amt = this.extractPaidAmount(n.text);
        if (amt > 0) {
          parsedAmount = amt;
          break;
        }
      }
      if (!debtorPaymentsMap.has(dId)) {
        debtorPaymentsMap.set(dId, {
          id: dId,
          fullName: d.fullName,
          minDebt: Number(d.minDebt || 0),
          principalDebt: Number(d.principalDebt || 0),
          paidAmount: parsedAmount,
        });
      } else {
        const existing = debtorPaymentsMap.get(dId)!;
        existing.paidAmount = Math.max(existing.paidAmount, parsedAmount);
      }
    }

    // BANK NPL QOIDASI BO'YICHA FILTRLASH:
    // To'lov minimal qarzdan katta/teng bo'lsa -> ASOSIY QARZ undirilgan hisoblanadi!
    const qualifiedPaidDebtors: Array<{
      id: number;
      fullName: string;
      paidAmount: number;
      principalDebt: number;
    }> = [];

    let undirildiSum = 0;

    for (const p of debtorPaymentsMap.values()) {
      const minD = p.minDebt;
      const paid = p.paidAmount;

      // Agar to'langan summa minimaldan katta yoki teng bo'lsa
      const isQualified = minD > 0 ? (paid >= minD) : (paid > 0);

      if (isQualified) {
        qualifiedPaidDebtors.push(p);
        // "Bugun undirildi"ga to'lagan summasi EMAS, ASOSIY QARZ qo'shiladi!
        undirildiSum += p.principalDebt;
      }
    }

    // 2. Borilganlar soni (Shu davrda qayd yozilgan barcha qarzdorlar)
    const visitedNotes = await this.prisma.note.findMany({
      where: {
        debtor: { userId },
        createdAt: { gte: startDate },
      },
      select: { debtorId: true },
    });

    const distinctVisitedIds = new Set(visitedNotes.map((n) => n.debtorId));
    for (const q of qualifiedPaidDebtors) {
      distinctVisitedIds.add(q.id);
    }
    const borildiCount = distinctVisitedIds.size;

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

    // Rahbarga yuboriladigan tayyor matn (Asosiy qarz summasi bilan)
    const summaryText = `${periodLabel}
Borildi: ${borildiCount} ta
To'ladi: ${qualifiedPaidDebtors.length} ta, ${fmt(undirildiSum)} so'm
Va'da berdi: ${vadaCount} ta, ${fmt(vadaSum)} so'm
Uyda yo'q: ${uydaYoqCount} ta`;

    return {
      period,
      dateString: dateStr,
      undirildiSum,
      undirildiFormatted: `${fmt(undirildiSum)} so'm`,
      tolaganCount: qualifiedPaidDebtors.length,
      borildiCount,
      vadaCount,
      vadaSum,
      uydaYoqCount,
      toLovlar: qualifiedPaidDebtors.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        paidAmount: d.paidAmount,
        paidFormatted: `${fmt(d.paidAmount)} so'm`,
        principalDebt: d.principalDebt,
        amount: d.principalDebt,
        amountFormatted: `${fmt(d.principalDebt)} so'm`,
      })),
      summaryText,
    };
  }
}
