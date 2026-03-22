// Centralized i18n system for the app
// Detects user's system language and provides translations

const translations = {
  ru: {
    // Navigation
    nav: {
      quests: 'Квесты',
      history: 'История',
      profile: 'Профиль',
    },
    // Common
    common: {
      cancel: 'Отмена',
      close: 'Закрыть',
      save: 'Сохранить',
      delete: 'Удалить',
      back: 'Назад',
      next: 'Далее',
      all: 'Все',
      edit: 'Редактировать',
      export: 'Экспорт',
      days: 'дней',
      level: 'Уровень',
      quests: 'квестов',
      notes: 'заметок',
      total: 'всего',
      today: 'Сегодня',
      yesterday: 'Вчера',
      processing: 'Обрабатываю...',
      error: 'Ошибка',
    },
    // DailyTracker page
    tracker: {
      subtitle: 'Твой путь к успеху',
      streak: 'Серия',
      darkTheme: 'Тёмная тема',
      lightTheme: 'Светлая тема',
      xpTo: 'до',
      motivations: [
        "Отличное начало! 🚀",
        "Ты на верном пути! 💪",
        "Невероятный прогресс! ⭐",
        "Ты — чемпион! 🏆",
        "Легенда! 👑"
      ],
    },
    // Levels
    levels: {
      1: 'Новичок',
      2: 'Ученик',
      3: 'Практик',
      4: 'Мастер',
      5: 'Эксперт',
      6: 'Герой',
      7: 'Чемпион',
      8: 'Легенда',
      9: 'Титан',
      10: 'Бог',
    },
    // Default quests
    defaultQuests: {
      health: [
        { level: 1, name: "Прогулка 15 мин", emoji: "🚶" },
        { level: 2, name: "Зарядка 20 мин", emoji: "🏃" },
        { level: 3, name: "Тренировка 45 мин", emoji: "💪" }
      ],
      mind: [
        { level: 1, name: "Медитация 5 мин", emoji: "🧘" },
        { level: 2, name: "Чтение 20 мин", emoji: "📖" },
        { level: 3, name: "Изучение нового 1 час", emoji: "🎓" }
      ],
      money: [
        { level: 1, name: "Проверить расходы", emoji: "💳" },
        { level: 2, name: "Отложить 10%", emoji: "💰" },
        { level: 3, name: "Инвестировать", emoji: "📈" }
      ],
      work: [
        { level: 1, name: "План на день", emoji: "📝" },
        { level: 2, name: "Фокус-сессия 1 час", emoji: "⏰" },
        { level: 3, name: "Завершить проект", emoji: "🎯" }
      ],
      love: [
        { level: 1, name: "Позвонить близким", emoji: "☎️" },
        { level: 2, name: "Провести вечер вместе", emoji: "🌟" },
        { level: 3, name: "Сюрприз для любимых", emoji: "🎁" }
      ],
      friends: [
        { level: 1, name: "Написать другу", emoji: "💬" },
        { level: 2, name: "Встретиться с другом", emoji: "🤝" },
        { level: 3, name: "Организовать встречу", emoji: "🎉" }
      ]
    },
    // Voice input
    voice: {
      listening: 'Слушаю...',
      voice: 'Голос',
      micPermission: 'Разрешите доступ к микрофону',
      notSupported: 'Голосовой ввод не поддерживается',
      micFailed: 'Не удалось запустить микрофон',
      processError: 'Ошибка обработки',
      voiceInput: 'Голосовой ввод',
    },
    // Photo/Calories
    calories: {
      todayCalories: 'Калории сегодня',
      meals: 'приёмов',
      kcal: 'ккал',
      protein: 'Белки',
      fat: 'Жиры',
      carbs: 'Углеводы',
      mealList: 'Приёмы пищи',
      analyzing: 'Анализирую еду...',
      photoFood: 'Сфотографировать еду',
      analyze: 'Анализировать',
      addPhoto: 'Добавить фото',
      removePhoto: 'Удалить фото',
      analysisError: 'Ошибка анализа фото',
      caloriesLabel: 'Калории',
      mealSaved: '🍽️ Приём пищи сохранён!',
    },
    // Meal edit
    mealEdit: {
      whatToChange: 'Что изменить? (AI пересчитает)',
      placeholder: 'Например: было 2 круассана, а не 1',
      recalculate: 'Пересчитать',
      recalculated: 'Пересчитано! ✅',
      recalcError: 'Ошибка пересчёта',
      writeChange: 'Напишите, что нужно изменить',
      deleteMeal: 'Удалить приём пищи',
      deleteConfirm: 'Удалить',
      mealDeleted: 'Приём пищи удалён',
      no: 'Нет',
    },
    // Meal report
    mealReport: {
      discard: 'Отмена',
      saveMeal: 'Сохранить',
    },
    // Profile
    profilePage: {
      title: 'Профиль',
      user: 'Пользователь',
      editName: 'Редактировать имя',
      saveName: 'Сохранить имя',
      cancelEdit: 'Отменить редактирование',
      nameSaved: 'Имя сохранено! ✓',
      nameError: 'Не удалось сохранить имя',
      logout: 'Выйти',
      toLevel: 'до Level',
      updateQuests: 'Обновить квесты',
      updateQuestsQ: 'Обновить квесты?',
      updateQuestsDesc: 'Ваша история и достижения сохранятся. Мы создадим новые персонализированные квесты.',
      yesUpdate: 'Да, обновить',
      questsUpdated: 'Квесты обновлены! 🎉',
      questsUpdateError: 'Ошибка при обновлении квестов',
      deleteAccount: 'Удалить аккаунт',
    },
    // Delete account
    deleteAcc: {
      title: 'Удаление аккаунта',
      irreversible: 'Это действие необратимо. Будут удалены:',
      allQuests: 'Все квесты и настройки',
      history: 'История выполнения',
      streakProgress: 'Серия дней и прогресс',
      journalMeals: 'Записи журнала и питания',
      continue: 'Продолжить',
      typeWord: 'Введите',
      toConfirm: 'для подтверждения:',
      confirmWord: 'УДАЛИТЬ',
      deleteForever: 'Удалить навсегда',
      deleting: 'Удаление...',
      deleted: 'Аккаунт удалён',
      deleteError: 'Ошибка при удалении',
    },
    // History
    historyPage: {
      title: 'История',
      day: 'День',
      week: 'Неделя',
      month: 'Месяц',
      noRecords: 'Нет записей за этот период',
      dayNames: ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],
      dayNamesShort: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
      dayNamesShortMon: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
      monthsGen: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
      months: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
      prevPeriod: 'Предыдущий период',
      nextPeriod: 'Следующий период',
      goToToday: 'Перейти к сегодняшнему дню',
    },
    // Stats
    stats: {
      dayPeriod: 'День',
      weekPeriod: 'Неделя',
      monthPeriod: 'Месяц',
      period: 'Период',
      dynamics: '📈 Динамика',
      byCategory: '📊 По категориям',
      balance: '🎯 Баланс',
      categories: '🏆 Категории',
      questsLabel: 'Квесты',
    },
    // Category progress
    catProgress: {
      weeklyReport: 'Недельный отчёт',
      currentLevel: 'Текущий уровень',
      progressToLvl: 'Прогресс до Lvl',
      last7Days: 'За последние 7 дней',
      startNow: 'Пора начать!',
      goodStart: 'Хорошее начало! Продолжай в том же духе',
      great: 'Отлично! Ты на правильном пути 🔥',
      totalQuests: 'Всего квестов',
      toNext: 'До следующего',
      achievements: 'Достижения',
      levelN: 'Уровень',
    },
    // Streak
    streakCeleb: {
      3: { emoji: '🔥', title: '3 дня подряд!', message: 'Отличное начало! Привычка начинает формироваться.' },
      5: { emoji: '⚡', title: '5 дней подряд!', message: 'Ты набираешь обороты! Так держать!' },
      7: { emoji: '🌟', title: 'Неделя подряд!', message: 'Целая неделя! Ты уже на пути к настоящей привычке.' },
      10: { emoji: '💪', title: '10 дней подряд!', message: 'Молодец! Ты уже 10 дней повышаешь свой уровень!' },
      14: { emoji: '🏅', title: '2 недели подряд!', message: 'Невероятная дисциплина! Ты — настоящий воин.' },
      21: { emoji: '🧠', title: '21 день подряд!', message: 'Привычка сформирована! Ты — машина!' },
      30: { emoji: '🏆', title: 'Месяц подряд!', message: 'Целый месяц без пропусков! Это легендарно!' },
      50: { emoji: '👑', title: '50 дней подряд!', message: 'Полсотни дней! Ты в элите!' },
      100: { emoji: '✨', title: '100 дней подряд!', message: 'СТО ДНЕЙ! Ты — абсолютная легенда!' },
    },
    streakContinue: '🔥 Продолжаем!',
    // Streak freeze
    streakFreeze: {
      missedDay: 'Ты пропустил вчерашний день!',
      daySeries: 'дней серия',
      youHave: 'У тебя есть',
      freezeWord: 'заморозка',
      freezeWordPlural: 'заморозки',
      freezeQuestion: 'серии. Использовать одну, чтобы сохранить свой стрик?',
      useFreeze: 'Использовать заморозку',
      resetStreak: 'Сбросить серию',
      freezeUsed: '❄️ Заморозка использована! Серия сохранена.',
      streakReset: 'Серия сброшена. Начинай заново! 💪',
    },
    // Motivational
    motivation: {
      phrases: [
        { text: "Ты на правильном пути!", emoji: "🚀" },
        { text: "Каждый день — новая возможность!", emoji: "🌟" },
        { text: "Продолжай в том же духе!", emoji: "💪" },
        { text: "Ты делаешь невероятные вещи!", emoji: "⭐" },
        { text: "Верь в себя, всё получится!", emoji: "🔥" },
        { text: "Маленькие шаги — большие результаты!", emoji: "👣" },
        { text: "Ты сильнее, чем думаешь!", emoji: "💎" },
        { text: "Сегодня твой день!", emoji: "☀️" },
        { text: "Ты можешь больше!", emoji: "🎯" },
        { text: "Двигайся вперёд, не останавливайся!", emoji: "🏃" },
        { text: "Ты вдохновляешь!", emoji: "✨" },
        { text: "Прогресс есть, продолжай!", emoji: "📈" }
      ]
    },
    // AI response modal
    aiModal: {
      title: 'AI Ассистент',
      youSaid: 'Вы сказали:',
      processingMsg: 'Обрабатываю ваше сообщение...',
      aiUnderstood: 'AI понял:',
      questCompleted: 'Квест выполнен',
      newQuest: 'Новый квест',
      deleteQuest: 'Удалить квест',
      editQuest: 'Изменить квест',
      note: 'Заметка',
      aiResponse: 'AI ответ',
      addQuest: 'Добавить квест',
      great: 'Отлично!',
    },
    // Quest suggestion
    questSuggest: {
      title: 'AI предложение',
      emojiLabel: 'Эмодзи',
      questName: 'Название квеста',
      add: 'Добавить',
    },
    // Premium
    premium: {
      title: 'Premium Features',
      subtitle: 'Расширенные возможности трекера',
      free: 'Бесплатно',
      freeze1: '1 freeze',
      soon: 'Скоро',
      webLimited: 'Web ограничен',
      afterRelease: 'Premium функции будут доступны после релиза 🚀',
      tgLimit: 'Telegram Mini Apps пока имеют технические ограничения',
      understood: 'Понятно',
      caloriePhoto: 'AI Калории по фото',
      caloriePhotoDesc: 'Сфотографируй еду и получи точный подсчет калорий',
      autoSteps: 'Автопроверка шагов',
      autoStepsDesc: 'Автоматическая синхронизация с Apple Health / Google Fit',
      nutritionAnalytics: 'Аналитика питания',
      nutritionAnalyticsDesc: 'Отслеживание дефицита/профицита калорий',
      bodyHistory: 'История тела',
      bodyHistoryDesc: 'Трекинг веса, объемов и прогресса',
      smartRecommendations: 'Умные рекомендации',
      smartRecommendationsDesc: 'Персональные советы от AI на основе твоих данных',
      streakProtection: 'Защита стрика',
      streakProtectionDesc: '1 бесплатная защита, +3 с Premium',
      dataExport: 'Экспорт данных',
      dataExportDesc: 'Выгрузка всей истории в JSON формате',
      coachMode: 'Coach Mode',
      coachModeDesc: 'Личный AI тренер для мотивации и советов',
    },
    // Journal
    journal: {
      completedQuests: 'Выполненные квесты',
      notes: 'Заметки',
      noQuests: 'Нет выполненных квестов',
      noNotes: 'Нет заметок',
    },
    // Entry detail
    entryDetail: {
      meal: 'Приём пищи',
      completedQuest: 'Выполненный квест',
      noteLabel: 'Заметка',
      food: 'Еда',
      quest: 'Квест',
    },
    // Onboarding errors/toasts
    onboarding: {
      questsReady: 'Ваши персональные квесты готовы! 🎉',
      questsError: 'Ошибка при создании квестов. Используем стандартные.',
      dataLoadError: 'Ошибка загрузки данных',
    },
    // Quest edit inline
    questEdit: {
      saveQuest: 'Сохранить',
      cancelEdit: 'Отмена',
      editQuest: 'Редактировать квест',
      uncheckQuest: 'Отменить квест',
      completeQuest: 'Выполнить квест',
      categoryProgress: 'прогресс',
    },
    // Notifications
    notifications: {
      title: 'Уведомления',
      subtitle: 'Настройки напоминаний',
      enable: 'Включить напоминания',
      reminderTime: 'Время напоминания',
      streakWarning: 'Защита стрика',
      streakWarningDesc: 'Предупреждение о потере серии',
      pushNotReady: 'Push-уведомления скоро будут доступны. Пока отправляем email.',
      save: 'Сохранить настройки',
      saved: 'Настройки сохранены! ✓',
    },
    // AI prompts language
    aiLang: 'ru',
  },
  en: {
    nav: {
      quests: 'Quests',
      history: 'History',
      profile: 'Profile',
    },
    common: {
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      delete: 'Delete',
      back: 'Back',
      next: 'Next',
      all: 'All',
      edit: 'Edit',
      export: 'Export',
      days: 'days',
      level: 'Level',
      quests: 'quests',
      notes: 'notes',
      total: 'total',
      today: 'Today',
      yesterday: 'Yesterday',
      processing: 'Processing...',
      error: 'Error',
    },
    tracker: {
      subtitle: 'Your path to success',
      streak: 'Streak',
      darkTheme: 'Dark theme',
      lightTheme: 'Light theme',
      xpTo: 'to',
      motivations: [
        "Great start! 🚀",
        "You're on the right track! 💪",
        "Incredible progress! ⭐",
        "You're a champion! 🏆",
        "Legendary! 👑"
      ],
    },
    levels: {
      1: 'Novice',
      2: 'Apprentice',
      3: 'Practitioner',
      4: 'Master',
      5: 'Expert',
      6: 'Hero',
      7: 'Champion',
      8: 'Legend',
      9: 'Titan',
      10: 'God',
    },
    defaultQuests: {
      health: [
        { level: 1, name: "Walk 15 min", emoji: "🚶" },
        { level: 2, name: "Workout 20 min", emoji: "🏃" },
        { level: 3, name: "Full training 45 min", emoji: "💪" }
      ],
      mind: [
        { level: 1, name: "Meditate 5 min", emoji: "🧘" },
        { level: 2, name: "Read 20 min", emoji: "📖" },
        { level: 3, name: "Learn something new 1h", emoji: "🎓" }
      ],
      money: [
        { level: 1, name: "Check expenses", emoji: "💳" },
        { level: 2, name: "Save 10%", emoji: "💰" },
        { level: 3, name: "Invest", emoji: "📈" }
      ],
      work: [
        { level: 1, name: "Plan the day", emoji: "📝" },
        { level: 2, name: "Focus session 1h", emoji: "⏰" },
        { level: 3, name: "Complete a project", emoji: "🎯" }
      ],
      love: [
        { level: 1, name: "Call loved ones", emoji: "☎️" },
        { level: 2, name: "Evening together", emoji: "🌟" },
        { level: 3, name: "Surprise loved ones", emoji: "🎁" }
      ],
      friends: [
        { level: 1, name: "Message a friend", emoji: "💬" },
        { level: 2, name: "Meet a friend", emoji: "🤝" },
        { level: 3, name: "Organize a meetup", emoji: "🎉" }
      ]
    },
    voice: {
      listening: 'Listening...',
      voice: 'Voice',
      micPermission: 'Allow microphone access',
      notSupported: 'Voice input not supported',
      micFailed: 'Failed to start microphone',
      processError: 'Processing error',
      voiceInput: 'Voice input',
    },
    calories: {
      todayCalories: 'Calories today',
      meals: 'meals',
      kcal: 'kcal',
      protein: 'Protein',
      fat: 'Fat',
      carbs: 'Carbs',
      mealList: 'Meals',
      analyzing: 'Analyzing food...',
      photoFood: 'Photo food',
      analyze: 'Analyze',
      addPhoto: 'Add photo',
      removePhoto: 'Remove photo',
      analysisError: 'Photo analysis error',
      caloriesLabel: 'Calories',
      mealSaved: '🍽️ Meal saved!',
    },
    mealEdit: {
      whatToChange: 'What to change? (AI will recalculate)',
      placeholder: 'Example: there were 2 croissants, not 1',
      recalculate: 'Recalculate',
      recalculated: 'Recalculated! ✅',
      recalcError: 'Recalculation error',
      writeChange: 'Write what needs to change',
      deleteMeal: 'Delete meal',
      deleteConfirm: 'Delete',
      mealDeleted: 'Meal deleted',
      no: 'No',
    },
    mealReport: {
      discard: 'Cancel',
      saveMeal: 'Save',
    },
    profilePage: {
      title: 'Profile',
      user: 'User',
      editName: 'Edit name',
      saveName: 'Save name',
      cancelEdit: 'Cancel editing',
      nameSaved: 'Name saved! ✓',
      nameError: 'Failed to save name',
      logout: 'Logout',
      toLevel: 'to Level',
      updateQuests: 'Update quests',
      updateQuestsQ: 'Update quests?',
      updateQuestsDesc: 'Your history and achievements will be preserved. We will create new personalized quests.',
      yesUpdate: 'Yes, update',
      questsUpdated: 'Quests updated! 🎉',
      questsUpdateError: 'Error updating quests',
      deleteAccount: 'Delete account',
    },
    deleteAcc: {
      title: 'Delete account',
      irreversible: 'This action is irreversible. Will be deleted:',
      allQuests: 'All quests and settings',
      history: 'Completion history',
      streakProgress: 'Day streak and progress',
      journalMeals: 'Journal and meal entries',
      continue: 'Continue',
      typeWord: 'Type',
      toConfirm: 'to confirm:',
      confirmWord: 'DELETE',
      deleteForever: 'Delete forever',
      deleting: 'Deleting...',
      deleted: 'Account deleted',
      deleteError: 'Error deleting account',
    },
    historyPage: {
      title: 'History',
      day: 'Day',
      week: 'Week',
      month: 'Month',
      noRecords: 'No records for this period',
      dayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
      dayNamesShort: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      dayNamesShortMon: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      monthsGen: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      prevPeriod: 'Previous period',
      nextPeriod: 'Next period',
      goToToday: 'Go to today',
    },
    stats: {
      dayPeriod: 'Day',
      weekPeriod: 'Week',
      monthPeriod: 'Month',
      period: 'Period',
      dynamics: '📈 Dynamics',
      byCategory: '📊 By category',
      balance: '🎯 Balance',
      categories: '🏆 Categories',
      questsLabel: 'Quests',
    },
    catProgress: {
      weeklyReport: 'Weekly report',
      currentLevel: 'Current level',
      progressToLvl: 'Progress to Lvl',
      last7Days: 'Last 7 days',
      startNow: 'Time to start!',
      goodStart: 'Good start! Keep going',
      great: 'Great! You\'re on the right track 🔥',
      totalQuests: 'Total quests',
      toNext: 'To next level',
      achievements: 'Achievements',
      levelN: 'Level',
    },
    streakCeleb: {
      3: { emoji: '🔥', title: '3 days in a row!', message: 'Great start! A habit is forming.' },
      5: { emoji: '⚡', title: '5 days in a row!', message: 'You\'re gaining momentum! Keep it up!' },
      7: { emoji: '🌟', title: 'A whole week!', message: 'One full week! You\'re building a real habit.' },
      10: { emoji: '💪', title: '10 days in a row!', message: 'Amazing! 10 days of leveling up!' },
      14: { emoji: '🏅', title: '2 weeks in a row!', message: 'Incredible discipline! You\'re a warrior.' },
      21: { emoji: '🧠', title: '21 days in a row!', message: 'Habit formed! You\'re a machine!' },
      30: { emoji: '🏆', title: 'A whole month!', message: 'A month without missing! Legendary!' },
      50: { emoji: '👑', title: '50 days in a row!', message: 'Fifty days! You\'re elite!' },
      100: { emoji: '✨', title: '100 days in a row!', message: '100 DAYS! You\'re an absolute legend!' },
    },
    streakContinue: '🔥 Keep going!',
    streakFreeze: {
      missedDay: 'You missed yesterday!',
      daySeries: 'day streak',
      youHave: 'You have',
      freezeWord: 'freeze',
      freezeWordPlural: 'freezes',
      freezeQuestion: 'streak. Use one to keep your streak?',
      useFreeze: 'Use freeze',
      resetStreak: 'Reset streak',
      freezeUsed: '❄️ Freeze used! Streak saved.',
      streakReset: 'Streak reset. Start again! 💪',
    },
    motivation: {
      phrases: [
        { text: "You're on the right path!", emoji: "🚀" },
        { text: "Every day is a new opportunity!", emoji: "🌟" },
        { text: "Keep up the great work!", emoji: "💪" },
        { text: "You're doing amazing things!", emoji: "⭐" },
        { text: "Believe in yourself!", emoji: "🔥" },
        { text: "Small steps — big results!", emoji: "👣" },
        { text: "You're stronger than you think!", emoji: "💎" },
        { text: "Today is your day!", emoji: "☀️" },
        { text: "You can do more!", emoji: "🎯" },
        { text: "Move forward, don't stop!", emoji: "🏃" },
        { text: "You're inspiring!", emoji: "✨" },
        { text: "Progress is real, keep going!", emoji: "📈" }
      ]
    },
    aiModal: {
      title: 'AI Assistant',
      youSaid: 'You said:',
      processingMsg: 'Processing your message...',
      aiUnderstood: 'AI understood:',
      questCompleted: 'Quest completed',
      newQuest: 'New quest',
      deleteQuest: 'Delete quest',
      editQuest: 'Edit quest',
      note: 'Note',
      aiResponse: 'AI response',
      addQuest: 'Add quest',
      great: 'Great!',
    },
    questSuggest: {
      title: 'AI suggestion',
      emojiLabel: 'Emoji',
      questName: 'Quest name',
      add: 'Add',
    },
    premium: {
      title: 'Premium Features',
      subtitle: 'Advanced tracker features',
      free: 'Free',
      freeze1: '1 freeze',
      soon: 'Soon',
      webLimited: 'Web limited',
      afterRelease: 'Premium features will be available after release 🚀',
      tgLimit: 'Telegram Mini Apps have technical limitations',
      understood: 'Got it',
      caloriePhoto: 'AI Calories by photo',
      caloriePhotoDesc: 'Take a photo of food and get accurate calorie count',
      autoSteps: 'Auto step tracking',
      autoStepsDesc: 'Auto sync with Apple Health / Google Fit',
      nutritionAnalytics: 'Nutrition analytics',
      nutritionAnalyticsDesc: 'Calorie deficit/surplus tracking',
      bodyHistory: 'Body history',
      bodyHistoryDesc: 'Weight, measurements and progress tracking',
      smartRecommendations: 'Smart recommendations',
      smartRecommendationsDesc: 'Personal AI advice based on your data',
      streakProtection: 'Streak protection',
      streakProtectionDesc: '1 free protection, +3 with Premium',
      dataExport: 'Data export',
      dataExportDesc: 'Export all history in JSON format',
      coachMode: 'Coach Mode',
      coachModeDesc: 'Personal AI coach for motivation and advice',
    },
    journal: {
      completedQuests: 'Completed quests',
      notes: 'Notes',
      noQuests: 'No completed quests',
      noNotes: 'No notes',
    },
    entryDetail: {
      meal: 'Meal',
      completedQuest: 'Completed quest',
      noteLabel: 'Note',
      food: 'Food',
      quest: 'Quest',
    },
    onboarding: {
      questsReady: 'Your personalized quests are ready! 🎉',
      questsError: 'Error creating quests. Using default ones.',
      dataLoadError: 'Error loading data',
    },
    questEdit: {
      saveQuest: 'Save',
      cancelEdit: 'Cancel',
      editQuest: 'Edit quest',
      uncheckQuest: 'Uncheck quest',
      completeQuest: 'Complete quest',
      categoryProgress: 'progress',
    },
    notifications: {
      title: 'Notifications',
      subtitle: 'Reminder settings',
      enable: 'Enable reminders',
      reminderTime: 'Reminder time',
      streakWarning: 'Streak protection',
      streakWarningDesc: 'Alert before losing streak',
      pushNotReady: 'Push notifications coming soon. Email reminders active for now.',
      save: 'Save settings',
      saved: 'Settings saved! ✓',
    },
    aiLang: 'en',
  }
};

// Detect user language from browser
function detectLanguage() {
  const lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  return lang.startsWith('ru') ? 'ru' : 'en';
}

// Cached language
let cachedLang = null;

export function getLang() {
  if (!cachedLang) {
    cachedLang = detectLanguage();
  }
  return cachedLang;
}

export function t() {
  return translations[getLang()];
}

// Speech recognition language code
export function getSpeechLang() {
  return getLang() === 'ru' ? 'ru-RU' : 'en-US';
}

// Locale string for dates
export function getLocale() {
  return getLang() === 'ru' ? 'ru-RU' : 'en-US';
}

export default translations;