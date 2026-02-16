import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

async function sendTelegramMessage(chatId, message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    })
  });

  return response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // If called with specific user (from automation)
    if (payload.telegram_chat_id) {
      const message = `
🌟 <b>Доброе утро!</b>

Время прокачивать свою жизнь! 💪

Твои квесты на сегодня ждут тебя в Daily Quests.

🔥 Продолжай свою серию!
🎯 Каждый день - шаг к цели

<a href="https://t.me/${Deno.env.get('TELEGRAM_BOT_USERNAME') || 'your_bot'}">Открыть Daily Quests</a>
      `.trim();

      await sendTelegramMessage(payload.telegram_chat_id, message);
      return Response.json({ success: true });
    }

    // Batch send to all users (called from automation without params)
    const users = await base44.asServiceRole.entities.User.list();
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      if (user.telegram_chat_id) {
        try {
          const message = `
🌟 <b>Доброе утро, ${user.full_name || 'друг'}!</b>

Время прокачивать свою жизнь! 💪

Твои квесты на сегодня ждут тебя.

🔥 Продолжай свою серию!
🎯 Каждый день - шаг к цели
          `.trim();

          await sendTelegramMessage(user.telegram_chat_id, message);
          sent++;
          
          // Rate limiting - 30 messages per second max
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`Failed to send to user ${user.id}:`, error);
          failed++;
        }
      }
    }

    return Response.json({ 
      success: true, 
      sent, 
      failed,
      total: users.length 
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});