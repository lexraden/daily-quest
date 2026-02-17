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

    // If called with specific user and custom message (for onboarding etc.)
    if (payload.telegram_chat_id && payload.message) {
      await sendTelegramMessage(payload.telegram_chat_id, payload.message);
      return Response.json({ success: true });
    }

    // Load all telegram users from TelegramUser entity
    const telegramUsers = await base44.asServiceRole.entities.TelegramUser.list();
    
    // Build a map of email -> telegram_chat_id from TelegramUser records
    const emailToChatId = {};
    const allChatIds = new Set();
    for (const tgUser of telegramUsers) {
      if (tgUser.telegram_chat_id) {
        allChatIds.add(tgUser.telegram_chat_id);
        if (tgUser.user_email) {
          emailToChatId[tgUser.user_email] = tgUser.telegram_chat_id;
        }
      }
    }

    // Load all user quest data
    const allUserData = await base44.asServiceRole.entities.UserQuestData.list();
    
    let sent = 0;
    let failed = 0;

    for (const userData of allUserData) {
      // Find telegram chat ID: first try by email mapping, then from completion data
      const userEmail = userData.created_by;
      const telegramChatId = emailToChatId[userEmail];
      
      if (!telegramChatId) continue;

      try {
        const today = new Date().toISOString().split('T')[0];
        const todayHistory = userData.completion_history?.[today] || [];
        
        // Find uncompleted quests
        const categories = ['health', 'mind', 'work', 'money', 'love', 'friends'];
        const uncompleted = [];
        
        for (const category of categories) {
          const categoryQuests = userData.quest_data?.[category] || [];
          
          for (const quest of categoryQuests) {
            const isCompleted = todayHistory.some(h => 
              h.category === category && h.level === quest.level
            );
            
            if (!isCompleted) {
              uncompleted.push({ ...quest, category });
            }
          }
        }

        if (uncompleted.length > 0) {
          const randomQuest = uncompleted[Math.floor(Math.random() * uncompleted.length)];
          const categoryNames = {
            health: 'Здоровье',
            mind: 'Разум',
            work: 'Работа',
            money: 'Финансы',
            love: 'Любовь',
            friends: 'Друзья'
          };

          const message = `
${randomQuest.emoji} <b>Напоминание!</b>

Ещё не выполнен квест из категории "${categoryNames[randomQuest.category]}":

<b>${randomQuest.name}</b>

🔥 Серия: ${userData.streak || 0} дней
🎯 Продолжай прокачивать свою жизнь!
          `.trim();

          const result = await sendTelegramMessage(telegramChatId, message);
          if (result.ok) {
            sent++;
          } else {
            console.error(`Telegram error for ${userEmail}:`, result.description);
            failed++;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Failed for ${userEmail}:`, error);
        failed++;
      }
    }

    // Also send to telegram users that are NOT linked to any app user (just registered via bot)
    // Send them a generic motivational message
    const linkedChatIds = new Set(Object.values(emailToChatId));
    for (const tgUser of telegramUsers) {
      if (tgUser.telegram_chat_id && !linkedChatIds.has(tgUser.telegram_chat_id)) {
        try {
          const name = tgUser.telegram_first_name || 'друг';
          const message = `👋 Привет, ${name}!\n\n🎯 Не забудь выполнить свои квесты сегодня!\n\n🔥 Каждый день — это шанс стать лучше!`;
          const result = await sendTelegramMessage(tgUser.telegram_chat_id, message);
          if (result.ok) sent++;
          else failed++;
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          failed++;
        }
      }
    }

    return Response.json({ 
      success: true, 
      sent, 
      failed,
      total_telegram_users: telegramUsers.length,
      total_user_data: allUserData.length
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});