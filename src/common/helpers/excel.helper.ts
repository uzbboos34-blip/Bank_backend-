import * as xlsx from 'xlsx';
import { extractPhonesAndAddress } from './phone.helper';

export interface ParsedDebtorRow {
  externalId: string;
  treasuryId?: string;
  code?: string;
  overdueDays?: number;
  officer?: string;
  mfy?: string;
  rawContract?: string;
  fullName: string;
  address?: string;
  phones: string[];
  phoneNote?: string;
  loanAmount: number;
  issuedAt?: Date;
  closingAt?: Date;
  principalDebt: number;
  interestDebt: number;
  totalDebt: number;
  minDebt: number;
}

export interface ExcelImportRowResult {
  row: number;
  error?: string;
  data?: ParsedDebtorRow;
}

// Ustun sarlavhasini me'yorlashtirish (katta-kichik harf, kirill/lotin va belgilardan tozalash)
function normalizeHeader(header: string): string {
  if (!header) return '';
  return header
    .toString()
    .toLowerCase()
    .replace(/['`ʻ’ʼ"\s_\-./\\()]/g, '')
    .trim();
}

function parseDecimal(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseInteger(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  const cleaned = String(val).replace(/[^0-9-]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

function parseExcelDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  // Agar Excel serial soni kelsa (masalan 44560)
  if (typeof val === 'number') {
    const parsed = xlsx.SSF.parse_date_code(val);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // DD.MM.YYYY yoki DD/MM/YYYY formati
    const dmy = trimmed.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10) - 1;
      const y = parseInt(dmy[3], 10);
      const date = new Date(Date.UTC(y, m, d));
      if (!isNaN(date.getTime())) return date;
    }
    const standard = new Date(trimmed);
    if (!isNaN(standard.getTime())) return standard;
  }
  return undefined;
}

export function parseExcelBuffer(buffer: Buffer): ExcelImportRowResult[] {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel faylida varaq (sheet) topilmadi');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, unknown>[] = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
  });

  if (rawRows.length < 2) {
    throw new Error('Excel faylida ma\'lumotlar mavjud emas yoki sarlavha yetishmaydi');
  }

  // Sarlavha qatorini topish (odatda 0-qator, yoki ba'zan 1-qator)
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(5, rawRows.length); r++) {
    const rCells = (rawRows[r] as unknown[]) || [];
    const joined = rCells.map((c) => String(c || '').toLowerCase()).join(' ');
    if (joined.includes('id') || joined.includes('мижоз') || joined.includes('kredit') || joined.includes('хазна')) {
      headerRowIdx = r;
      break;
    }
  }

  const headerRow = rawRows[headerRowIdx] as unknown[];
  const columnIndexMap: Record<string, number> = {};

  headerRow.forEach((col, idx) => {
    const norm = normalizeHeader(String(col || ''));
    if (!norm) return;

    if (norm === 'id' || norm === 'ид' || norm === 'externalid') columnIndexMap['externalId'] = idx;
    else if (norm.includes('xazna') || norm.includes('хазна') || norm.includes('treasury')) columnIndexMap['treasuryId'] = idx;
    else if (norm.includes('makskun') || norm.includes('макскун') || norm.includes('mudotkun') || norm.includes('мудоткун') || norm.includes('muddat') || norm.includes('overdue') || norm.includes('макс') || norm === 'кун' || norm === 'kun') columnIndexMap['overdueDays'] = idx;
    else if (norm.includes('22band') || norm.includes('22банд') || norm.includes('band') || norm.includes('банд') || norm === 'kc' || norm === 'кс' || norm.includes('kod') || norm.includes('коды') || norm === 'code') columnIndexMap['code'] = idx;
    else if (norm.includes('masulxodim') || norm.includes('масъулходим') || norm.includes('officer')) columnIndexMap['officer'] = idx;
    else if (norm.includes('mfy') || norm.includes('мфй') || norm.includes('mahalla') || norm.includes('маҳалла')) columnIndexMap['mfy'] = idx;
    else if (norm.includes('shartnoma') || norm.includes('шартнома') || norm.includes('contract')) columnIndexMap['rawContract'] = idx;
    else if (norm.includes('manzil') || norm.includes('манзил') || norm.includes('address')) columnIndexMap['address'] = idx;
    else if (norm.includes('telefon') || norm.includes('телефон') || norm === 'tel' || norm === 'тел' || norm.includes('phone')) columnIndexMap['phones'] = idx;
    else if (norm.includes('mijoznomi') || norm.includes('мижозноми') || norm.includes('mijoz') || norm.includes('мижоз') || norm.includes('fio') || norm.includes('фио')) columnIndexMap['fullName'] = idx;
    else if (norm.includes('kreditsummasi') || norm.includes('кредитсуммаси') || norm.includes('loanamount') || norm.includes('сумэкв')) columnIndexMap['loanAmount'] = idx;
    else if (norm.includes('berilgansana') || norm.includes('берилгансана')) columnIndexMap['issuedAt'] = idx;
    else if (norm.includes('tugallanishsana') || norm.includes('тугалланишсана') || norm.includes('yopiladigansana') || norm.includes('ёпиладигансана')) columnIndexMap['closingAt'] = idx;
    else if (norm.includes('asosiyqarzdorlik') || norm.includes('асосийқарздорлик') || norm.includes('asosiy')) columnIndexMap['principalDebt'] = idx;
    else if (norm.includes('prosent') || norm.includes('просент') || norm.includes('foiz') || norm.includes('фоиз')) columnIndexMap['interestDebt'] = idx;
    else if (norm.includes('jamiqarzdorlik') || norm.includes('жамиқарздорлик') || norm.includes('totaldebt')) columnIndexMap['totalDebt'] = idx;
    else if (norm.includes('minimal') || norm.includes('минимал') || norm.includes('mindebt')) columnIndexMap['minDebt'] = idx;
  });

  if (columnIndexMap['externalId'] === undefined && columnIndexMap['fullName'] === undefined) {
    throw new Error('Excel faylida kerakli ustunlar (ID yoki Mijoz nomi) topilmadi. Sarlavhalarni tekshiring.');
  }

  const results: ExcelImportRowResult[] = [];

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r] as unknown[];
    const rowNumber = r + 1;

    // Agar bo'sh qator bo'lsa o'tkazib yuborish
    if (!row || row.every((c) => c === '' || c === null || c === undefined)) {
      continue;
    }

    const getVal = (key: string): unknown => {
      const idx = columnIndexMap[key];
      return idx !== undefined ? row[idx] : undefined;
    };

    const externalIdRaw = String(getVal('externalId') ?? '').trim();
    const fullNameRaw = String(getVal('fullName') ?? '').trim();

    if (!externalIdRaw) {
      results.push({
        row: rowNumber,
        error: 'ID (externalId) ustuni bo\'sh',
      });
      continue;
    }

    if (!fullNameRaw) {
      results.push({
        row: rowNumber,
        error: 'Mijoz nomi (fullName) ustuni bo\'sh',
      });
      continue;
    }

    const rawContract = String(getVal('rawContract') ?? '').trim();
    const explicitAddress = getVal('address') ? String(getVal('address')).trim() : '';
    const explicitPhone = getVal('phones') ? String(getVal('phones')).trim() : '';

    // Telefon va manzilni ajratish
    const sourceTextForExtraction = `${explicitPhone} ${rawContract} ${explicitAddress}`;
    const { phones: extractedPhones, address: extractedAddress } = extractPhonesAndAddress(sourceTextForExtraction);
    const phones = extractedPhones.length > 0 ? extractedPhones : (explicitPhone ? [explicitPhone] : []);

    const finalAddress = explicitAddress || extractedAddress || undefined;

    const principal = parseDecimal(getVal('principalDebt'));
    const interest = parseDecimal(getVal('interestDebt'));
    const parsedTotalDebt = parseDecimal(getVal('totalDebt'));
    const finalTotalDebt = parsedTotalDebt > 0 ? parsedTotalDebt : principal + interest;

    const minDebt = parseDecimal(getVal('minDebt'));

    const parsedData: ParsedDebtorRow = {
      externalId: externalIdRaw,
      treasuryId: getVal('treasuryId') ? String(getVal('treasuryId')).trim() : undefined,
      code: getVal('code') ? String(getVal('code')).trim() : undefined,
      overdueDays: parseInteger(getVal('overdueDays')),
      officer: getVal('officer') ? String(getVal('officer')).trim() : undefined,
      mfy: getVal('mfy') ? String(getVal('mfy')).trim() : undefined,
      rawContract: rawContract || undefined,
      fullName: fullNameRaw,
      address: finalAddress,
      phones,
      phoneNote: explicitPhone && phones.length > 0 ? explicitPhone : undefined,
      loanAmount: parseDecimal(getVal('loanAmount')),
      issuedAt: parseExcelDate(getVal('issuedAt')),
      closingAt: parseExcelDate(getVal('closingAt')),
      principalDebt: principal,
      interestDebt: interest,
      totalDebt: finalTotalDebt,
      minDebt: minDebt > 0 ? minDebt : principal,
    };

    results.push({
      row: rowNumber,
      data: parsedData,
    });
  }

  return results;
}
