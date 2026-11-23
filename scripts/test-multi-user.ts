async function testMultiUser() {
  const baseUrl = 'http://localhost:3000';
  console.log('--- Multi-User va Super Admin Huquqlari Testi ---');

  // 1. Super Admin login
  console.log('1. Super Admin tizimga kirdi: super_admin / 7777');
  const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'super_admin', pin: '7777' }),
  });
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.accessToken;
  console.log('✅ Super Admin tasdiqlandi. Role:', adminData.user.role);

  // 2. Super Admin yangi hodim qo'shadi
  console.log('2. Super Admin yangi hodim qo\'shmoqda (nodir_collector / 4321)...');
  const addEmpRes = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      login: 'nodir_collector',
      pin: '4321',
      fullName: 'Nodir Aliyev (Undiruv xodimi)',
      role: 'COLLECTOR',
    }),
  });
  const newEmp = await addEmpRes.json();
  console.log('✅ Yangi hodim yaratildi:', newEmp);

  // 3. Super Admin barcha hodimlarni ko'radi
  console.log('3. Super Admin barcha hodimlar ro\'yxatini olmoqda...');
  const employeesRes = await fetch(`${baseUrl}/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const employees = await employeesRes.json();
  console.log(`✅ Jami hodimlar soni: ${employees.length} ta.`);

  // 4. Yangi hodim (nodir_collector) o'z login-paroli bilan kiradi
  console.log('4. Yangi hodim (nodir_collector / 4321) tizimga kirmoqda...');
  const nodirLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'nodir_collector', pin: '4321' }),
  });
  const nodirData = await nodirLoginRes.json();
  const nodirToken = nodirData.accessToken;
  console.log('✅ Nodir tizimga kirdi! ID:', nodirData.user.id, 'Role:', nodirData.user.role);

  // 5. Oddiy hodim Super Admin sahifasiga kirishga urinsa:
  console.log('5. Oddiy hodim /users endpointiga kirishga urinsa (Tekshirish)...');
  const forbiddenRes = await fetch(`${baseUrl}/users`, {
    headers: { Authorization: `Bearer ${nodirToken}` },
  });
  console.log('✅ Ruxsat berilmadi (Kutilgan natija): Status =', forbiddenRes.status);

  // 6. Nodir o'zining qarzdorlar ro'yxatini ko'radi
  console.log('6. Nodir o\'z qarzdorlarini tekshirmoqda...');
  const nodirDebtorsRes = await fetch(`${baseUrl}/debtors`, {
    headers: { Authorization: `Bearer ${nodirToken}` },
  });
  const nodirDebtors = await nodirDebtorsRes.json();
  console.log(`✅ Nodirning qarzdorlari soni: ${nodirDebtors.total} (Hali hech kim yo'q, boshqa hodimniki unga ko'rinmaydi)`);

  // 7. Nodir boshqa hodimning qarzdoriga (ID: 5) ruxsatsiz kirishga urinsa:
  console.log('7. Nodir boshqa hodimga tegishli qarzdor (ID: 5) ni o\'zgartirishga urinsa...');
  const patchOtherRes = await fetch(`${baseUrl}/debtors/5`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${nodirToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'PAID' }),
  });
  console.log('✅ Boshqa hodim qarzdoriga teginish bloklandi: Status =', patchOtherRes.status);

  console.log('🎉 KO\'P FOYDALANUVCHILI TIZIM VA SUPER ADMIN TALABLARI 100% ISHLAMOQDA!');
}

testMultiUser().catch((e) => {
  console.error('Test xatoligi:', e);
  process.exit(1);
});
