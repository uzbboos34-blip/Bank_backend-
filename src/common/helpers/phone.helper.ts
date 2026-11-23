/**
 * O'zbekiston telefon raqamlarini matndan ajratish va normalizatsiya qilish.
 * Qaytaradi: { phones: string[], cleanedAddress: string }
 */
export function extractPhonesAndAddress(rawText: string | null | undefined): {
  phones: string[];
  address: string;
} {
  if (!rawText || typeof rawText !== 'string') {
    return { phones: [], address: '' };
  }

  const phoneRegex =
    /(?:(?:\+?998|8)[\s\-_(]*)?(\d{2})[\s\-_)]*(\d{3})[\s\-_]*(\d{2})[\s\-_]*(\d{2})/g;

  const validPrefixes = new Set([
    '20', '33', '50', '55', '71', '72', '73', '74', '75', '76', '77', '78',
    '79', '88', '90', '91', '93', '94', '95', '97', '98', '99',
  ]);

  const phonesSet = new Set<string>();
  let match: RegExpExecArray | null;

  // Raqamlarni qidirib topish
  while ((match = phoneRegex.exec(rawText)) !== null) {
    const prefix = match[1];
    const part1 = match[2];
    const part2 = match[3];
    const part3 = match[4];

    // Haqiqiy O'zbekiston operator kodi ekanligini tasdiqlash
    if (validPrefixes.has(prefix)) {
      phonesSet.add(`+998${prefix}${part1}${part2}${part3}`);
    }
  }

  // Raqamlar matndan olib tashlanadi, qolgani manzil bo'ladi
  let cleaned = rawText.replace(phoneRegex, ' ');

  // Telefon prefikslari yoki qoldiqlari qolgan bo'lsa (masalan "тел:", "tel:", "tel") tozalash
  cleaned = cleaned.replace(/\b(tel|тел|telefon|телефон|t|т)\s*[:.\-]?/gi, ' ');

  // Ortiqcha tinish belgilari va bo'shliqlarni tozalash
  cleaned = cleaned
    .replace(/[,;/\-_|]\s*[,;/\-_|]+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;/\-_|.\s]+|[,;/\-_|.\s]+$/g, '');

  return {
    phones: Array.from(phonesSet),
    address: cleaned,
  };
}
