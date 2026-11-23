import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Bank qarzdorlarining soxta ma'lumotlaridan iborat namunaviy Excel fayl yaratish skripti.
 * Bu fayl O'zbekiston sharoitiga to'liq mos keladi:
 * - "Shartnoma" katagida manzil va turli formatdagi telefon raqamlari aralash yozilgan
 * - Valyutalar, sanalar, MFY va boshqa bank ustunlari mavjud
 */
function generateMockExcel() {
  const rows = [
    // Sarlavha qatori (Excel import talablariga mos)
    [
      'ID',
      'xazna ID',
      'kodlar',
      'mas\'ul xodim',
      'MFY',
      'Shartnoma',
      'Mijoz nomi',
      'Kredit summasi',
      'Berilgan sana',
      'Yopiladigan sana',
      'Jami asosiy qarzdorlik',
      'Jami foiz qarzdorlik',
      'JAMI minimal qarzdorlik',
    ],
    // 1-qarzdor: Bir nechta telefon raqamli va manzil aralash
    [
      'DEBT-001',
      'XZ-98124',
      'KD-1102',
      'Rustamov Sardor',
      'Chilonzor 9-mavze',
      'Toshkent sh., Chilonzor tumani, 9-mavze, 14-uy, 28-xonadon. Tel: +998 (90) 123-45-67, qo\'shimcha 91 234-56-78',
      'Aliyev Vali G\'aniyevich',
      25000000,
      '2024-01-15',
      '2026-01-15',
      12500000,
      1200000,
      2800000,
    ],
    // 2-qarzdor: Boshqa formatdagi telefon
    [
      'DEBT-002',
      'XZ-98125',
      'KD-1103',
      'Rustamov Sardor',
      'Bo\'ston MFY',
      'Samarqand viloyati, Samarqand shahri, Gagarin ko\'chasi, 45-uy. telefon 998939876543',
      'Karimov Botir Shokirovich',
      40000000,
      '2023-05-10',
      '2025-05-10',
      24000000,
      3500000,
      5200000,
    ],
    // 3-qarzdor: Toshkent viloyati, 998siz 9 xonali raqam
    [
      'DEBT-003',
      'XZ-98126',
      'KD-1104',
      'Yo\'ldoshev Jamshid',
      'Do\'stlik MFY',
      'Toshkent vil., Chirchiq sh., A.Temur ko\'chasi 12-uy. tel: 97 111-22-33',
      'Rahmonova Nilufar Anvarovna',
      15000000,
      '2024-03-20',
      '2025-09-20',
      8000000,
      950000,
      1800000,
    ],
    // 4-qarzdor: Farg'ona, qisqa manzil va 8 bilan yozilgan raqam
    [
      'DEBT-004',
      'XZ-98127',
      'KD-1105',
      'Yo\'ldoshev Jamshid',
      'Navbahor MFY',
      'Farg\'ona viloyati, Qo\'qon sh., Istiqlol 88. 894 555-44-33, 90 999-88-77',
      'Tursunov Jasur Qobilovich',
      50000000,
      '2023-11-01',
      '2026-11-01',
      38000000,
      4200000,
      7600000,
    ],
    // 5-qarzdor: Katta qarz, Andijon
    [
      'DEBT-005',
      'XZ-98128',
      'KD-1106',
      'Rustamov Sardor',
      'Guliston MFY',
      'Andijon viloyati, Asaka shahri, Bobur ko\'chasi 5-uy, tel 99-321-43-21',
      'Qodirov Sherzod Odilovich',
      30000000,
      '2024-02-01',
      '2025-08-01',
      19000000,
      2100000,
      4100000,
    ],
  ];

  const worksheet = xlsx.utils.aoa_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Qarzdorlar');

  const outputDir = path.resolve(process.cwd(), 'sample_data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'qarzdorlar_namuna.xlsx');
  xlsx.writeFile(workbook, outputPath);

  console.log(`Namuna Excel fayli muvaffaqiyatli yaratildi: ${outputPath}`);
}

generateMockExcel();
