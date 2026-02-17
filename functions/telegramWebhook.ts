import { createClient } from 'npm:@base44/sdk@0.8.6';

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const APP_ID = Deno.env.get("BASE44_APP_ID");

// Initialize base44 with service role for webhook (no user auth)
const base44 = createClient({ appId: APP_ID }).asServiceRole;

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    // Handle Telegram webhook update
    const message = body.message || body.edited_message;
    if (!message) {
      return Response.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const username = message.from.username || '';
    const firstName = message.from.first_name || '';
    const text = (message.text || '').trim();

    console.log(`Received message from ${chatId} (${username}): ${text}`);

    // Check if this telegram user already exists in our DB
    const existing = await base44.entities.TelegramUser.filter({
      telegram_chat_id: chatId
    });

    if (existing.length === 0) {
      // Save new telegram user
      await base44.entities.TelegramUser.create({
        telegram_chat_id: chatId,
        telegram_username: username,
        telegram_first_name: firstName,
        user_email: ''
      });
      console.log(`Created new TelegramUser: ${chatId}`);
    } else {
      // Update info if changed
      const record = existing[0];
      if (record.telegram_username !== username || record.telegram_first_name !== firstName) {
        await base44.entities.TelegramUser.update(record.id, {
          telegram_username: username,
          telegram_first_name: firstName
        });
      }
    }

    // Handle /start command
    if (text === '/start' || text.startsWith('/start')) {
      await sendTelegramMessage(chatId, `👋 Привет, ${firstName}!\n\nДобро пожаловать в Daily Quests! 🎯\n\nТеперь ты будешь получать напоминания о квестах прямо сюда.\n\n🔥 Прокачивай свою жизнь каждый день!`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ ok: true }); // Always return 200 to Telegram
  }
});

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  });
  const data = await res.json();
  console.log(`Telegram sendMessage result:`, JSON.stringify(data));
  return data;
}