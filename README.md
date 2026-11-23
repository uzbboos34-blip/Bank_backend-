# Undiruv Yordamchisi — Backend Tizimi

Bank undiruv bo'limi xodimlari uchun qarzdorlar ro'yxatini boshqarish, Excel import qilish, joyiga borib holat va qaydlarni yozish imkoniyatini beruvchi ko'p foydalanuvchili (Multi-user) backend xizmati.

Loyihada **EduCoin** tizimi arxitekturasi, tezlik va qotib qolmaslik (SWC kompilyatori, BigInt serializatsiyasi, kompozit indekslar, tranzaksiya izolyatsiyasi) andozalari to'liq qo'llanilgan.

---

## 👥 Foydalanuvchilar Rollari va Izolyatsiya

1. **SUPER_ADMIN (Bosh Administrator):**
   - Yangi undiruvchi xodimlarni login, PIN va ism-sharifi bilan tizimga qo'shadi (`POST /users`).
   - Barcha xodimlar ro'yxatini va ularga biriktirilgan qarzdorlar sonini ko'radi (`GET /users`).
   - Xodimlarning PIN kodini yangilashi yoki ishdan ketgan bo'lsa hisobini faolsizlantirishi (bloklashi) mumkin (`PATCH /users/:id`).

2. **COLLECTOR (Undiruvchi Xodim):**
   - Har bir xodim faqat o'zining login va PIN kodi bilan tizimga kiradi.
   - **Qat'iy izolyatsiya:** Har bir xodim faqat **o'ziga biriktirilgan qarzdorlarni** ko'radi. Boshqa xodimning qarzdorini ko'rish yoki unga qayd yozish 100% bloklangan (`403 Forbidden`).
   - O'z qarzdorlarini Excel orqali import qiladi, joyiga borib qayd va holat yozadi.

---

## 🛠 Texnologiyalar

- **Freymvork:** NestJS 11 + TypeScript (Strict typing, Zero `any`)
- **Kompilyator:** SWC Builder (`@swc/cli`, `@swc/core`) — ultra-tezkor kompilyatsiya (~70ms)
- **ORM & DB:** Prisma ORM + PostgreSQL (Neon Cloud)
- **Autentifikatsiya:** JWT (Passport-JWT) + Bcrypt PIN hashing + RolesGuard
- **Excel parser:** SheetJS (`xlsx`) — avtomatik ustun aniqlash va telefonlarni regex bilan ajratish
- **Xavfsizlik:** Helmet, Throttler (Rate Limit), CORS, expressBasicAuth (Swagger)
- **Maxfiylik:** SanitizeLoggerInterceptor — bank mijozlarining shaxsiy ma'lumotlari (ism, telefon, manzil) loglarga chiqmaydi.

---

## 📁 Loyiha Strukturasi

```text
Bank/
├── prisma/
│   └── schema.prisma                 # User, Debtor, Note modellari, Role enumi va Indexlar
├── src/
│   ├── core/
│   │   └── database/
│   │       ├── prisma.service.ts     # Ulanish va graceful shutdown nazorati
│   │       ├── prisma.module.ts
│   │       └── seed.ts               # Super Admin va boshlang'ich xodimni yaratish
│   ├── common/
│   │   ├── config/
│   │   │   ├── swagger.ts            # BasicAuth bilan himoyalangan Swagger hujjati
│   │   │   └── cors.config.ts        # CORS sozlamasi
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts    # @Roles(Role.SUPER_ADMIN)
│   │   │   └── public.decorator.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts # O'zbekcha xato xabarlari (P2002, P2025)
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts     # Global JWT himoyasi
│   │   │   └── roles.guard.ts        # Rollar bo'yicha ruxsat nazorati
│   │   ├── interceptors/
│   │   │   ├── bigint.interceptor.ts # Decimal/BigInt xatosiz JSON serializatsiyasi
│   │   │   └── sanitize-logger.interceptor.ts # Logda mijoz ma'lumotlarini yashirish
│   │   └── helpers/
│   │       ├── phone.helper.ts       # O'zbekiston raqamlarini ajratish va +998... qilish
│   │       ├── excel.helper.ts       # Moslashuvchan Excel parser va xatolarni hisoblash
│   │       └── pagination.helper.ts  # Xavfsiz sahifalash
│   ├── modules/
│   │   ├── auth/                     # POST /auth/login (Rate Limit bilan)
│   │   ├── users/                    # SUPER ADMIN: Hodimlarni boshqarish (CRUD)
│   │   ├── debtors/                  # Import, Ro'yxat, Bugungi reja, Patch
│   │   ├── notes/                    # POST /debtors/:id/notes (Idempotent clientId bilan)
│   │   └── stats/                    # GET /stats/today
│   ├── app.module.ts
│   └── main.ts                       # SWC, Compression, Helmet, Throttler
├── sample_data/
│   └── qarzdorlar_namuna.xlsx        # Sinov uchun soxta ma'lumotli Excel fayl
├── scripts/
│   ├── generate-mock-excel.ts        # Namuna Excel yaratish skripti
│   ├── test-all-endpoints.ts         # Barcha endpointlarni jonli test qilish skripti
│   └── test-multi-user.ts            # Ko'p foydalanuvchili va Admin huquqlari testi
├── .swcrc                            # SWC tezkor kompilyator konfiguratsiyasi
├── nest-cli.json                     # SWC builder integratsiyasi
├── .env
├── .env.example
└── package.json
```

---

## 🔑 Boshlang'ich Foydalanuvchilar (Default Hisoblar)

Baza to'ldirilganda (`npm run seed`) avtomatik yaratiladi:

| Rol | Login | Boshlang'ich PIN | Ism |
|---|---|---|---|
| **Super Admin** | `super_admin` | `7777` | Bosh Administrator |
| **Undiruvchi xodim** | `bank_collector` | `1234` | Sardor Rustamov |

---

## 📡 API Endpointlar Shartnomasi

### 1. Autentifikatsiya
| Metod | Yo'l | Tavsif | Ruxsat |
|---|---|---|---|
| `POST` | `/auth/login` | Tizimga kirish va JWT olish (`{ login, pin }`) | Ochiq (Rate Limit) |

### 2. Administrator (Faqat Super Admin uchun)
| Metod | Yo'l | Tavsif | Ruxsat |
|---|---|---|---|
| `POST` | `/users` | Yangi hodim qo'shish (`{ login, pin, fullName, role? }`) | SUPER_ADMIN |
| `GET` | `/users` | Barcha hodimlar ro'yxati va ulardagi qarzdorlar soni | SUPER_ADMIN |
| `GET` | `/users/:id` | Bitta hodim tafsilotlari | SUPER_ADMIN |
| `PATCH` | `/users/:id` | Hodim PIN kodini o'zgartirish, faollikni boshqarish | SUPER_ADMIN |

### 3. Qarzdorlar bilan ishlash (Har bir hodim faqat o'zinikini ko'radi)
| Metod | Yo'l | Tavsif | Ruxsat |
|---|---|---|---|
| `POST` | `/debtors/import` | Excel fayl yuklash (multipart, field: `file`) | Har bir hodim |
| `GET` | `/debtors` | Qarzdorlar ro'yxati (search, status, mfy, sort, page, limit) | Har bir hodim |
| `GET` | `/debtors/today` | Bugungi rejadagi qarzdorlar (`promiseDate <= bugun`, `status != PAID`) | Har bir hodim |
| `GET` | `/debtors/:id` | Bitta qarzdorning to'liq ma'lumoti va qaydlari | Faqat egasiga |
| `PATCH` | `/debtors/:id` | Holat, va'da sanasi yoki GPS koordinatalarini yangilash | Faqat egasiga |
| `POST` | `/debtors/:id/notes` | Qayd yozish (`clientId`, `status?`, `text?` - Idempotent) | Faqat egasiga |
| `GET` | `/debtors/:id/notes` | Qarzdorning barcha qaydlarini ko'rish | Faqat egasiga |
| `GET` | `/stats/today` | Bugungi statistika: `{ total, visited, promised, paid }` | Faqat egasiga |

---

## 📖 Swagger Hujjati

Swagger manzili: **[http://localhost:3000/swagger](http://localhost:3000/swagger)**
- **Login:** `bank_admin`
- **Parol:** `bank_admin_pass2026`

---

## ⚡️ Multi-User Testini Ishga Tushirish

Super Admin huquqlari va hodimlar o'rtasidagi ma'lumotlar ajratilishini tekshirish uchun:
```bash
npx ts-node scripts/test-multi-user.ts
```
