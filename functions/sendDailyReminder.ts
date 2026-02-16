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

    // If called with specific user and custom message (for onboarding)
    if (payload.telegram_chat_id && payload.message) {
      await sendTelegramMessage(payload.telegram_chat_id, payload.message);
      return Response.json({ success: true });
    }

    // Batch send to all users
    const users = await base44.asServiceRole.entities.User.list();
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      if (user.telegram_chat_id) {
        try {
          // Загрузить данные пользователя для проверки невыполненных квестов
          const userDataList = await base44.asServiceRole.entities.UserQuestData.filter({ 
            created_by: user.email 
          });

          if (userDataList.length === 0) continue;

          const userData = userDataList[0];
          const today = new Date().toISOString().split('T')[0];
          const todayHistory = userData.completion_history?.[today] || [];
          
          // Найти невыполненные квесты
          const categories = ['health', 'mind', 'work', 'money', 'love', 'friends'];
          const uncompleted = [];
          
          for (const category of categories) {
            const categoryQuests = userData.quest_data?.[category] || [];
            const categoryLevel = userData.category_levels?.[category] || 1;
            
            for (const quest of categoryQuests) {
              const isCompleted = todayHistory.some(h => 
                h.category === category && h.level === quest.level
              );
              
              if (!isCompleted && quest.level <= categoryLevel) {
                uncompleted.push({ ...quest, category });
              }
            }
          }

          // Если есть невыполненные квесты, выбрать случайный
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

            await sendTelegramMessage(user.telegram_chat_id, message);
            sent++;
          }
          
          // Rate limiting
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