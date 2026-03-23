import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { answers } = await req.json();

    // Generate new quests using AI
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Ты - эксперт по персональному развитию. На основе ответов пользователя создай персонализированные ЕЖЕДНЕВНЫЕ квесты для daily tracker.

Ответы пользователя:
${Object.entries(answers).map(([cat, answer]) => `${cat}: ${answer}`).join('\n')}

ВАЖНО: Квесты должны быть ЕЖЕДНЕВНЫМИ действиями, которые можно выполнять каждый день, а НЕ долгосрочными целями!
❌ Неправильно: "Сбросить 5кг", "Получить повышение", "Купить квартиру"
✅ Правильно: "Пробежать 3км", "Выполнить задачу на работе", "Отложить 500₽"

Для каждой категории создай 3 ЕЖЕДНЕВНЫХ квеста разных уровней сложности:
- Level 1: самый простой, базовый (можно делать каждый день)
- Level 2: средний (требует больше усилий, но выполнимо ежедневно)
- Level 3: сложный (амбициозное ежедневное действие)

Категории:
- health: физическая активность, спорт, здоровье
- mind: обучение, медитация, чтение
- work: рабочие задачи, проекты
- money: финансовые привычки, накопления
- love: романтические отношения, время с партнером/любимым человеком
- friends: общение с друзьями, социализация

Квесты должны быть:
- ЕЖЕДНЕВНЫМИ действиями
- Конкретными и измеримыми
- Подходящими под ситуацию пользователя
- Реалистичными для ежедневного выполнения
- Мотивирующими
- Короткими (до 30 символов)
- БЕЗ эмодзи в названии (эмодзи только в поле emoji)

ВАЖНО для категории money:
- НЕ указывай конкретные суммы или валюты (₽, $, 500₽, 10%)
- Используй общие формулировки ("отложить часть дохода", "проверить бюджет")

Подбери подходящие эмодзи для каждого квеста (эмодзи отдельно, не в названии).`,
      response_json_schema: {
        type: "object",
        properties: {
          health: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "number" },
                emoji: { type: "string" },
                name: { type: "string" }
              },
              required: ["level", "emoji", "name"]
            }
          },
          mind: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "number" },
                emoji: { type: "string" },
                name: { type: "string" }
              },
              required: ["level", "emoji", "name"]
            }
          },
          work: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "number" },
                emoji: { type: "string" },
                name: { type: "string" }
              },
              required: ["level", "emoji", "name"]
            }
          },
          money: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "number" },
                emoji: { type: "string" },
                name: { type: "string" }
              },
              required: ["level", "emoji", "name"]
            }
          },
          love: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "number" },
                emoji: { type: "string" },
                name: { type: "string" }
              },
              required: ["level", "emoji", "name"]
            }
          },
          friends: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "number" },
                emoji: { type: "string" },
                name: { type: "string" }
              },
              required: ["level", "emoji", "name"]
            }
          }
        },
        required: ["health", "mind", "work", "money", "love", "friends"]
      }
    });

    // Get user data and update only quest_data
    const userDataList = await base44.entities.UserQuestData.filter({ created_by: user.email });

    if (userDataList.length > 0) {
      const userData = userDataList[0];
      // Update with new quests but keep everything else
      await base44.entities.UserQuestData.update(userData.id, {
        quest_data: result,
        onboarding_answers: answers
      });

      return Response.json({ 
        success: true,
        message: 'Quests refreshed successfully'
      });
    } else {
      return Response.json({ 
        error: 'User data not found',
        success: false
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error refreshing quests:', error);
    return Response.json({ 
      error: error.message || 'Failed to refresh quests',
      success: false
    }, { status: 500 });
  }
});