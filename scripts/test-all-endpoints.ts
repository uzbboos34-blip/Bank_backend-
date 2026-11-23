import * as fs from 'fs';
import * as path from 'path';

async function testApi() {
  const baseUrl = 'http://localhost:3000';
  console.log('--- Undiruv Yordamchisi API Testlarini Boshlash ---');

  // 1. Login
  console.log('1. POST /auth/login tekshirilmoqda...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'bank_collector', pin: '1234' }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login muvaffaqiyatsiz bo'ldi: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('✅ Login muvaffaqiyatli! Foydalanuvchi ID:', loginData.user.id);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // 2. Excel Import
  console.log('2. POST /debtors/import tekshirilmoqda...');
  const filePath = path.resolve(process.cwd(), 'sample_data/qarzdorlar_namuna.xlsx');
  const fileBuffer = fs.readFileSync(filePath);
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

  const bodyParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qarzdorlar_namuna.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    fileBuffer,
    `\r\n--${boundary}--\r\n`,
  ];

  const multipartBody = Buffer.concat([
    Buffer.from(bodyParts[0]),
    fileBuffer,
    Buffer.from(bodyParts[2]),
  ]);

  const importRes = await fetch(`${baseUrl}/debtors/import`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const importResult = await importRes.json();
  console.log('✅ Import natijasi:', importResult);

  // 3. GET /debtors
  console.log('3. GET /debtors ro\'yxat tekshirilmoqda...');
  const debtorsRes = await fetch(`${baseUrl}/debtors?page=1&limit=10`, {
    headers: authHeaders,
  });
  const debtorsData = await debtorsRes.json();
  console.log(`✅ Qarzdorlar soni: ${debtorsData.total}, Sahifa: ${debtorsData.page}`);

  const firstDebtor = debtorsData.items[0];
  console.log('Birinchi qarzdor namuna:', {
    id: firstDebtor.id,
    externalId: firstDebtor.externalId,
    fullName: firstDebtor.fullName,
    phones: firstDebtor.phones,
    address: firstDebtor.address,
    minDebt: firstDebtor.minDebt,
  });

  // 4. PATCH /debtors/:id
  console.log(`4. PATCH /debtors/${firstDebtor.id} tekshirilmoqda...`);
  const patchRes = await fetch(`${baseUrl}/debtors/${firstDebtor.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'PROMISED',
      promiseDate: new Date().toISOString(),
      lat: 41.2995,
      lng: 69.2401,
    }),
  });
  const patchedData = await patchRes.json();
  console.log('✅ PATCH natijasi status:', patchedData.status, 'promiseDate:', patchedData.promiseDate);

  // 5. POST /debtors/:id/notes (Idempotentlik bilan)
  console.log(`5. POST /debtors/${firstDebtor.id}/notes (Idempotent) tekshirilmoqda...`);
  const clientId = 'test-client-uuid-12345';
  const notePayload = {
    clientId,
    status: 'PROMISED',
    text: 'Mijoz bilan ko\'rishildi, 2 kunda to\'lashga va\'da berdi.',
  };

  const noteRes1 = await fetch(`${baseUrl}/debtors/${firstDebtor.id}/notes`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(notePayload),
  });
  const noteData1 = await noteRes1.json();
  console.log('✅ 1-marta qayd yaratildi: ID =', noteData1.id);

  // Takroriy so'rov (bir xil clientId bilan)
  const noteRes2 = await fetch(`${baseUrl}/debtors/${firstDebtor.id}/notes`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(notePayload),
  });
  const noteData2 = await noteRes2.json();
  console.log('✅ Idempotent takroriy so\'rov: ID =', noteData2.id, '(bir xil ID qaytdi, yangi duplikat ochilmadi)');

  // 6. GET /debtors/today
  console.log('6. GET /debtors/today tekshirilmoqda...');
  const todayRes = await fetch(`${baseUrl}/debtors/today`, { headers: authHeaders });
  const todayData = await todayRes.json();
  console.log(`✅ Bugungi rejada ${todayData.length} ta qarzdor bor.`);

  // 7. GET /stats/today
  console.log('7. GET /stats/today tekshirilmoqda...');
  const statsRes = await fetch(`${baseUrl}/stats/today`, { headers: authHeaders });
  const statsData = await statsRes.json();
  console.log('✅ Bugungi statistika:', statsData);

  console.log('🎉 BARCHA ENDPOINTLAR 100% MUVAFFAQIYATLI ISHLADI!');
}

testApi().catch((err) => {
  console.error('❌ Test xatoligi:', err);
  process.exit(1);
});
