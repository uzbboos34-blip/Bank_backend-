const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input'); // input prompts
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const apiId = Number(process.env.TG_APP_ID || 13292460);
const apiHash = process.env.TG_APP_HASH || '5e211ffc78bd127ad0d784b502e7ce36';

(async () => {
  console.log('--- Telegram Shaxsiy Akkauntga Kirish ---');
  const stringSession = new StringSession(''); // Yangi sessiya

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Telefon raqamingizni kiriting (+998...): '),
    password: async () => await input.password('Agar 2-bosqichli parol (2FA) bo\'lsa kiriting: '),
    phoneCode: async () => await input.text('Telegramga kelgan 5 xonali kodni kiriting: '),
    onError: (err) => console.log('Xatolik:', err.message),
  });

  console.log('\n✅ Muvaffaqiyatli ulandingiz!');
  const newSession = client.session.save();

  // "11353 МУАММОЛИ" guruhini qidiramiz
  console.log('Guruhlar qidirilmoqda...');
  const dialogs = await client.getDialogs({ limit: 100 });
  let foundChatId = null;

  for (const d of dialogs) {
    if (d.title && (d.title.includes('11353') || d.title.includes('МУАММОЛИ'))) {
      foundChatId = d.id.toString();
      console.log(`\n🎉 Guruh topildi: "${d.title}" (ID: ${foundChatId})`);
      break;
    }
  }

  // .env faylni yangilaymiz
  const envPath = path.join(__dirname, '../.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // TG_SESSION almashtirish
  if (envContent.includes('TG_SESSION=')) {
    envContent = envContent.replace(/TG_SESSION=.*/g, `TG_SESSION=${newSession}`);
  } else {
    envContent += `\nTG_SESSION=${newSession}`;
  }

  // TG_CHAT_ID almashtirish
  if (foundChatId) {
    if (envContent.includes('TG_CHAT_ID=')) {
      envContent = envContent.replace(/TG_CHAT_ID=.*/g, `TG_CHAT_ID=${foundChatId}`);
    } else {
      envContent += `\nTG_CHAT_ID=${foundChatId}`;
    }
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ Yangi sessiya va Guruh ID .env fayliga saqlandi!');

  await client.disconnect();
  process.exit(0);
})();
