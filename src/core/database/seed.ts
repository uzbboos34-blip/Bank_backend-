import { PrismaClient, Role, DebtorStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- Ma\'lumotlar bazasini dastlabki to\'ldirish (Seeder) ---');

  // 1. Super Admin yaratish
  const superAdminLogin = 'super_admin';
  const superAdminPin = '7777';

  let superAdmin = await prisma.user.findUnique({
    where: { login: superAdminLogin },
  });

  if (!superAdmin) {
    const adminPinHash = await bcrypt.hash(superAdminPin, 10);
    superAdmin = await prisma.user.create({
      data: {
        login: superAdminLogin,
        pinHash: adminPinHash,
        fullName: 'Bosh Administrator',
        role: Role.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log('✅ Super Administrator yaratildi: super_admin / 7777');
  }

  // 2. Namuna Undiruvchi Hodim (Collector) yaratish
  const collectorLogin = 'bank_collector';
  const collectorPin = '1234';

  let collector = await prisma.user.findUnique({
    where: { login: collectorLogin },
  });

  if (!collector) {
    const collectorPinHash = await bcrypt.hash(collectorPin, 10);
    collector = await prisma.user.create({
      data: {
        login: collectorLogin,
        pinHash: collectorPinHash,
        fullName: 'Sardor Rustamov (Undiruv xodimi)',
        role: Role.COLLECTOR,
        isActive: true,
      },
    });
    console.log('✅ Undiruvchi hodim yaratildi: bank_collector / 1234');
  }

  // 3. Foydalanuvchining fotosuratidagi haqiqiy bank ma'lumotlari (NPL portfeli)
  // Aniq ustunlar: ID | Хазна ИД | Макс кун (Муддати ўтган кун) | 22-банд | Просрочка/Просент
  const bankDebtorsData = [
    {
      externalId: '5715018',
      treasuryId: '12363459',
      overdueDays: 227, // Макс кун (227 кун муддати ўтган)
      code: '0',        // 22-банд бўйича
      mfy: 'Саройпули МФЙ',
      address: 'Севинч кўчаси, 47уй',
      phones: ['+998998992830'],
      fullName: 'JUBANIYAZOVA AYSUWLI PIRNIYAZOVNA',
      loanAmount: 33000000,
      issuedAt: new Date('2025-02-04'),
      closingAt: new Date('2028-12-18'),
      principalDebt: 31517244,
      interestDebt: 13165397,
      totalDebt: 44682641,
      minDebt: 8795185,
      status: DebtorStatus.NEW,
    },
    {
      externalId: '5679698',
      treasuryId: '14068831',
      overdueDays: 164, // Макс кун (164 кун муддати ўтган)
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'ТАЛАБА КЎЧАСИ, 10-УЙ, Р/С',
      phones: ['+998999937608'],
      phoneNote: '41 ГПР Бермаган, Эри Шер кучада экан 3 кунда тулайди',
      fullName: 'DJUMANIYAZOVA ROZA ABDULLAYEVNA',
      loanAmount: 33000000,
      issuedAt: new Date('2024-12-26'),
      closingAt: new Date('2027-11-03'),
      principalDebt: 28415263,
      interestDebt: 8222553,
      totalDebt: 36637816,
      minDebt: 4024206,
      status: DebtorStatus.PROMISED,
      promiseDate: new Date(Date.now() + 86400000), // ertaga
    },
    {
      externalId: '6781663',
      treasuryId: '3470191',
      overdueDays: 802, // Макс кун (802 кун муддати ўтган)
      code: '0',
      mfy: 'Қиёт МФЙ',
      address: 'ул. Ибн Сино 10',
      phones: ['+998915812520'],
      fullName: 'TAIROVA SHAXIDA XUDOYKID QI\'ZI',
      loanAmount: 23000000,
      issuedAt: new Date('2022-11-15'),
      closingAt: new Date('2026-10-25'),
      principalDebt: 15495084,
      interestDebt: 18313872,
      totalDebt: 33808956,
      minDebt: 18482460,
      status: DebtorStatus.NEW,
    },
    {
      externalId: '4878428',
      treasuryId: '811105383',
      overdueDays: 621, // Макс кун (621 кун муддати ўтган)
      code: '0',
      mfy: 'Қиёт МФЙ',
      address: 'ТИЖОРАТЧИЛАР КЎЧАСИ, 10-УЙ',
      phones: ['+998996812851'],
      fullName: 'MAMBETOV RASHID ABDURAZAKOVICH',
      loanAmount: 23000000,
      issuedAt: new Date('2023-10-30'),
      closingAt: new Date('2026-10-25'),
      principalDebt: 13100911,
      interestDebt: 16319133,
      totalDebt: 29420044,
      minDebt: 16923921,
      status: DebtorStatus.NOT_HOME,
    },
    {
      externalId: '5185490',
      treasuryId: '27140736',
      overdueDays: 103, // Макс кун (103 кун муддати ўтган)
      code: '0',
      mfy: 'Тупроққалъа МФЙ',
      address: 'Юқори боғ МФЙ, Хумо кўчаси, 6уй',
      phones: ['+998956590625'],
      phoneNote: 'Махалла раиси тугрисида',
      fullName: 'URINBAYEVA MUXAYYO KURALBEK QIZI',
      loanAmount: 16500000,
      issuedAt: new Date('2024-04-05'),
      closingAt: new Date('2027-03-31'),
      principalDebt: 8238960,
      interestDebt: 4179551,
      totalDebt: 12418511,
      minDebt: 324089,
      status: DebtorStatus.PAID,
    },
    {
      externalId: '4768945',
      treasuryId: '63120017',
      overdueDays: 621, // Макс кун (621 кун муддати ўтган)
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'Мустақиллик МФЙ, Ҳамса кўчаси, 12',
      phones: ['+998880380757'],
      fullName: 'BEKMANOV MAQSAT KAMILOVICH',
      loanAmount: 10000000,
      issuedAt: new Date('2024-09-18'),
      closingAt: new Date('2026-09-18'),
      principalDebt: 3850000,
      interestDebt: 6031913,
      totalDebt: 9881913,
      minDebt: 4887691,
      status: DebtorStatus.NEW,
    },
    {
      externalId: '5541153',
      treasuryId: '34966179',
      overdueDays: 560, // Макс кун (560 кун муддати ўтган)
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'Марказий кўча 6-уй',
      phones: ['+998972532525'],
      fullName: 'ABDULLAYEV SARDOR URINBAYEVICH',
      loanAmount: 33000000,
      issuedAt: new Date('2024-10-13'),
      closingAt: new Date('2026-04-07'),
      principalDebt: 31369750,
      interestDebt: 33790462,
      totalDebt: 65160212,
      minDebt: 32991799,
      status: DebtorStatus.PROMISED,
      promiseDate: new Date(Date.now() + 2 * 86400000), // 3 kundan
    },
    {
      externalId: '4844325',
      treasuryId: '48906002',
      overdueDays: 924, // Макс кун (924 кун муддати ўтган)
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'ул. Кудратлиlar, дом 72',
      phones: ['+998975166881'],
      fullName: 'XUDAYBERGENOVA GO\'ZAL AZIM QIZI',
      loanAmount: 10000000,
      issuedAt: new Date('2024-09-21'),
      closingAt: new Date('2026-09-19'),
      principalDebt: 7910462,
      interestDebt: 5390262,
      totalDebt: 13300724,
      minDebt: 1767185,
      status: DebtorStatus.NO_MONEY,
    },
    {
      externalId: '5976489',
      treasuryId: '63474693',
      overdueDays: 103, // Макс кун (103 кун муддати ўтган)
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'Шахрихон кўчаси, 108 уй',
      phones: ['+998999307111'],
      fullName: 'SHAMURATOV ALIJON RUZIMBAYEVICH',
      loanAmount: 33000000,
      issuedAt: new Date('2023-11-07'),
      closingAt: new Date('2029-10-30'),
      principalDebt: 29876822,
      interestDebt: 4642011,
      totalDebt: 34518833,
      minDebt: 835042,
      status: DebtorStatus.NEW,
    },
    {
      externalId: '4896870',
      treasuryId: '58447792',
      overdueDays: 103, // Макс кун (103 кун муддати ўтган)
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'Мулкдор кўчаси, 15',
      phones: ['+998975000195'],
      fullName: 'YAKUBBAYEV JAVOXIR FAZILJAN O\'G\'LI',
      loanAmount: 20000000,
      issuedAt: new Date('2025-07-23'),
      closingAt: new Date('2029-05-06'),
      principalDebt: 21993544,
      interestDebt: 4843171,
      totalDebt: 26836715,
      minDebt: 1196988,
      status: DebtorStatus.PHONE_OFF,
    },
    {
      externalId: '5725896',
      treasuryId: '5764588',
      overdueDays: 0, // 0 кун
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'ЖОМАШУВЕРДИ КЎЧАСИ, уй-18/1',
      phones: ['+998975050195'],
      fullName: 'ALLAMBERGENOVA IRODA ATABEK QIZI',
      loanAmount: 33000000,
      issuedAt: new Date('2024-10-05'),
      closingAt: new Date('2028-09-14'),
      principalDebt: 23765778,
      interestDebt: 18916553,
      totalDebt: 42682331,
      minDebt: 13585929,
      status: DebtorStatus.NEW,
    },
    {
      externalId: '5521677',
      treasuryId: '68859077',
      overdueDays: 103, // 103 кун
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'Кахрамонlar кўчаси, 41а',
      phones: ['+998885052737'],
      fullName: 'KO\'CHQAROVA IRODA ASATBAYEVNA',
      loanAmount: 33000000,
      issuedAt: new Date('2024-08-09'),
      closingAt: new Date('2026-08-02'),
      principalDebt: 27699998,
      interestDebt: 5176986,
      totalDebt: 32876984,
      minDebt: 363413,
      status: DebtorStatus.PAID,
    },
    {
      externalId: '4814080',
      treasuryId: '67383289',
      overdueDays: 741, // 741 кун
      code: '0',
      mfy: 'Саройпули МФЙ',
      address: 'Кахрамонлар кўчаси, 108 уй',
      phones: ['+998930489700'],
      fullName: 'KOSHCHANOV ASHIRBAY ZARIPOVICH',
      loanAmount: 33000000,
      issuedAt: new Date('2024-07-22'),
      closingAt: new Date('2026-10-11'),
      principalDebt: 14387072,
      interestDebt: 14287072,
      totalDebt: 28674144,
      minDebt: 7848550,
      status: DebtorStatus.MOVED,
    },
  ];

  for (const item of bankDebtorsData) {
    await prisma.debtor.upsert({
      where: {
        externalId_userId: {
          externalId: item.externalId,
          userId: collector.id,
        },
      },
      update: {
        treasuryId: item.treasuryId,
        code: item.code,
        overdueDays: item.overdueDays,
        mfy: item.mfy,
        address: item.address,
        phones: item.phones,
        phoneNote: item.phoneNote,
        fullName: item.fullName,
        loanAmount: new Prisma.Decimal(item.loanAmount),
        issuedAt: item.issuedAt,
        closingAt: item.closingAt,
        principalDebt: new Prisma.Decimal(item.principalDebt),
        interestDebt: new Prisma.Decimal(item.interestDebt),
        totalDebt: new Prisma.Decimal(item.totalDebt),
        minDebt: new Prisma.Decimal(item.minDebt),
        status: item.status,
        promiseDate: item.promiseDate,
        archived: false,
      },
      create: {
        userId: collector.id,
        externalId: item.externalId,
        treasuryId: item.treasuryId,
        code: item.code,
        overdueDays: item.overdueDays,
        mfy: item.mfy,
        address: item.address,
        phones: item.phones,
        phoneNote: item.phoneNote,
        fullName: item.fullName,
        loanAmount: new Prisma.Decimal(item.loanAmount),
        issuedAt: item.issuedAt,
        closingAt: item.closingAt,
        principalDebt: new Prisma.Decimal(item.principalDebt),
        interestDebt: new Prisma.Decimal(item.interestDebt),
        totalDebt: new Prisma.Decimal(item.totalDebt),
        minDebt: new Prisma.Decimal(item.minDebt),
        status: item.status,
        promiseDate: item.promiseDate,
        archived: false,
      },
    });
  }

  console.log(`✅ ${bankDebtorsData.length} ta bank qarzdori aniq 'Maks kun' (muddati o'tgan kunlar) bilan saqlandi!`);
}

main()
  .catch((e) => {
    console.error('Seeder xatoligi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
