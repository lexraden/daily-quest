import React, { useState } from 'react';
import { Copy, Check, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/*
  Этот компонент показывает полный HTML код для Telegram Mini App
  Скопируйте код и разверните на Vercel/Netlify
*/

const TELEGRAM_MINI_APP_CODE = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Daily Tracker</title>
    
    <!-- Telegram Web App Script -->
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    
    <style>
        /* ============================================
           🎨 CSS CUSTOMIZATION SECTION
           Измените переменные для кастомизации дизайна
           ============================================ */
        
        :root {
            /* Основные цвета */
            --bg-primary: #0f1419;
            --bg-secondary: #1e2836;
            --bg-card: #1e2836;
            --bg-hover: #242f3d;
            
            /* Акцентные цвета */
            --accent-purple: #6c5ce7;
            --accent-cyan: #00cec9;
            --accent-orange: #e17055;
            --accent-green: #00b894;
            
            /* Текст */
            --text-primary: #ffffff;
            --text-secondary: #a0aec0;
            --text-muted: #64748b;
            
            /* Границы */
            --border-color: rgba(255, 255, 255, 0.05);
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, #1a1f2e 50%, var(--bg-primary) 100%);
            color: var(--text-primary);
            min-height: 100vh;
            padding-bottom: 2rem;
            -webkit-tap-highlight-color: transparent;
        }
        
        /* Header */
        .header {
            position: relative;
            padding: 2rem 1.25rem 1.5rem;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, 
                rgba(108, 92, 231, 0.2), 
                rgba(0, 206, 201, 0.1), 
                rgba(108, 92, 231, 0.2)
            );
            filter: blur(40px);
        }
        
        .header-content {
            position: relative;
        }
        
        .user-greeting {
            color: var(--text-secondary);
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
        }
        
        .header h1 {
            font-size: 1.875rem;
            font-weight: 700;
            background: linear-gradient(90deg, #fff, #ddd6fe, #a5f3fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .header p {
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            padding: 0 1.25rem;
            margin-top: -0.5rem;
        }
        
        .stat-card {
            position: relative;
            overflow: hidden;
            background: linear-gradient(135deg, var(--bg-card), #151c28);
            border-radius: 1rem;
            padding: 1rem;
            border: 1px solid var(--border-color);
        }
        
        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 5rem;
            height: 5rem;
            border-radius: 50%;
            filter: blur(30px);
        }
        
        .stat-card.level::before {
            background: rgba(108, 92, 231, 0.1);
        }
        
        .stat-card.streak::before {
            background: rgba(225, 112, 85, 0.1);
        }
        
        .stat-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.5rem;
        }
        
        .stat-value {
            display: flex;
            align-items: baseline;
            gap: 0.5rem;
        }
        
        .stat-value .icon {
            font-size: 1.5rem;
        }
        
        .stat-value .name {
            font-size: 1.125rem;
            font-weight: 600;
        }
        
        .stat-value .number {
            font-size: 1.875rem;
            font-weight: 700;
            color: var(--accent-orange);
        }
        
        .stat-value .unit {
            font-size: 0.875rem;
            color: var(--text-muted);
        }
        
        .stat-subtext {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 0.5rem;
        }
        
        /* Progress Bar */
        .progress-container {
            margin-top: 0.75rem;
        }
        
        .progress-bar {
            height: 0.375rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 9999px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            border-radius: 9999px;
            transition: width 0.5s ease-out;
        }
        
        /* Today's Progress Card */
        .progress-card {
            margin: 1.5rem 1.25rem;
            background: linear-gradient(135deg, var(--bg-card), #151c28);
            border-radius: 1rem;
            padding: 1.25rem;
            border: 1px solid var(--border-color);
        }
        
        .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .progress-title {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 500;
        }
        
        .progress-count {
            font-size: 0.875rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-secondary);
        }
        
        .main-progress {
            height: 0.75rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 9999px;
            overflow: hidden;
            position: relative;
        }
        
        .main-progress-fill {
            height: 100%;
            border-radius: 9999px;
            transition: width 0.7s ease-out;
            background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan));
        }
        
        .main-progress-fill.complete {
            background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan), #fdcb6e);
        }
        
        .motivation {
            text-align: center;
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-top: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        
        /* Tasks List */
        .tasks-list {
            padding: 0 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .task-item {
            position: relative;
            overflow: hidden;
            border-radius: 1rem;
            padding: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
        }
        
        .task-item:hover {
            background: var(--bg-hover);
        }
        
        .task-item:active {
            transform: scale(0.98);
        }
        
        .task-item.completed {
            background: linear-gradient(90deg, 
                rgba(108, 92, 231, 0.2), 
                rgba(0, 206, 201, 0.2)
            );
            border-color: rgba(108, 92, 231, 0.3);
        }
        
        .task-item.celebrating {
            transform: scale(1.02);
        }
        
        .task-content {
            display: flex;
            align-items: center;
            gap: 1rem;
            position: relative;
        }
        
        .checkbox {
            width: 1.75rem;
            height: 1.75rem;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            flex-shrink: 0;
        }
        
        .checkbox.unchecked {
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
        }
        
        .checkbox.checked {
            background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
        }
        
        .checkbox svg {
            width: 1rem;
            height: 1rem;
            color: white;
        }
        
        .task-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .task-emoji {
            font-size: 1.125rem;
        }
        
        .task-name {
            font-weight: 500;
            transition: all 0.3s;
        }
        
        .task-name.completed {
            color: var(--text-secondary);
            text-decoration: line-through;
        }
        
        .task-status {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
            transition: all 0.3s;
        }
        
        .task-status.pending {
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-muted);
        }
        
        .task-status.done {
            background: rgba(0, 184, 148, 0.2);
            color: var(--accent-green);
        }
        
        /* Bottom Stats */
        .bottom-stats {
            display: flex;
            justify-content: center;
            gap: 1.5rem;
            padding: 2rem 1.25rem;
            font-size: 0.875rem;
            color: var(--text-muted);
        }
        
        .bottom-stat {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        /* Animations */
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .shimmer {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 2s infinite;
        }
        
        /* Loading */
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        
        .spinner {
            width: 3rem;
            height: 3rem;
            border: 2px solid transparent;
            border-top-color: var(--accent-purple);
            border-bottom-color: var(--accent-purple);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* SVG Icons */
        .icon-sm {
            width: 1rem;
            height: 1rem;
        }
        
        .icon-md {
            width: 1.25rem;
            height: 1.25rem;
        }
    </style>
</head>
<body>
    <div id="app">
        <div class="loading">
            <div class="spinner"></div>
        </div>
    </div>

    <script>
        /* ============================================
           ⚙️ CONFIGURATION SECTION
           Измените эти значения для кастомизации
           ============================================ */
        
        const CONFIG = {
            // Тексты приложения
            title: "Daily Tracker",
            subtitle: "Твой путь к успеху",
            streakLabel: "Серия",
            levelLabel: "Уровень",
            tasksLabel: "Задачи на сегодня",
            completedText: "Выполнено",
            pendingText: "Ожидает",
            
            // Мотивационные сообщения
            motivationTexts: [
                "Отличное начало! 🚀",
                "Ты на верном пути! 💪",
                "Невероятный прогресс! ⭐",
                "Ты — чемпион! 🏆",
                "Легенда! 👑"
            ]
        };
        
        // Система уровней
        const LEVELS = [
            { threshold: 0, name: "Новичок", icon: "🌱", color: "#6c5ce7" },
            { threshold: 10, name: "Ученик", icon: "📚", color: "#00cec9" },
            { threshold: 25, name: "Практик", icon: "⚡", color: "#fdcb6e" },
            { threshold: 50, name: "Мастер", icon: "🔥", color: "#e17055" },
            { threshold: 100, name: "Эксперт", icon: "💎", color: "#d63031" },
            { threshold: 200, name: "Легенда", icon: "👑", color: "#ffeaa7" }
        ];
        
        // Задачи по умолчанию
        const DEFAULT_TASKS = [
            { id: 1, name: "Утренняя зарядка", emoji: "🏃" },
            { id: 2, name: "Выпить 2л воды", emoji: "💧" },
            { id: 3, name: "Чтение 30 минут", emoji: "📖" },
            { id: 4, name: "Медитация", emoji: "🧘" },
            { id: 5, name: "Прогулка", emoji: "🚶" }
        ];
        
        /* ============================================
           END OF CONFIGURATION
           ============================================ */
        
        // State
        let state = {
            tasks: [...DEFAULT_TASKS],
            completedToday: {},
            totalCompleted: 0,
            streak: 0,
            lastCompletedDate: null,
            tgUser: null
        };
        
        // Telegram Web App
        let tg = null;
        
        // Utils
        const getTodayKey = () => new Date().toISOString().split('T')[0];
        
        const getCurrentLevel = () => {
            let currentLevel = LEVELS[0];
            for (const level of LEVELS) {
                if (state.totalCompleted >= level.threshold) {
                    currentLevel = level;
                }
            }
            return currentLevel;
        };
        
        const getProgressToNextLevel = () => {
            const currentLevel = getCurrentLevel();
            const currentLevelIndex = LEVELS.findIndex(l => l.threshold === currentLevel.threshold);
            const nextLevel = LEVELS[currentLevelIndex + 1];
            
            if (!nextLevel) return { progress: 100, remaining: 0, nextLevel: null };
            
            const progress = ((state.totalCompleted - currentLevel.threshold) / 
                             (nextLevel.threshold - currentLevel.threshold)) * 100;
            const remaining = nextLevel.threshold - state.totalCompleted;
            
            return { progress: Math.min(progress, 100), remaining, nextLevel };
        };
        
        const getMotivation = () => {
            const completedCount = Object.values(state.completedToday).filter(Boolean).length;
            if (completedCount === 0) return "";
            const index = Math.min(
                Math.floor((completedCount / state.tasks.length) * CONFIG.motivationTexts.length),
                CONFIG.motivationTexts.length - 1
            );
            return CONFIG.motivationTexts[index];
        };
        
        // Storage
        const saveData = () => {
            const data = {
                totalCompleted: state.totalCompleted,
                streak: state.streak,
                lastCompletedDate: state.lastCompletedDate,
                completedToday: state.completedToday,
                lastVisitDate: getTodayKey()
            };
            localStorage.setItem('dailyTrackerData', JSON.stringify(data));
        };
        
        const loadData = () => {
            const savedData = localStorage.getItem('dailyTrackerData');
            if (savedData) {
                const data = JSON.parse(savedData);
                state.totalCompleted = data.totalCompleted || 0;
                state.streak = data.streak || 0;
                state.lastCompletedDate = data.lastCompletedDate || null;
                
                const today = getTodayKey();
                if (data.completedToday && data.lastVisitDate === today) {
                    state.completedToday = data.completedToday;
                } else {
                    if (data.lastVisitDate) {
                        const lastVisit = new Date(data.lastVisitDate);
                        const todayDate = new Date(today);
                        const diffDays = Math.floor((todayDate - lastVisit) / (1000 * 60 * 60 * 24));
                        if (diffDays > 1) {
                            state.streak = 0;
                        }
                    }
                    state.completedToday = {};
                }
            }
        };
        
        // Toggle task
        const toggleTask = (taskId) => {
            const wasCompleted = state.completedToday[taskId];
            const today = getTodayKey();
            
            state.completedToday[taskId] = !state.completedToday[taskId];
            
            if (!wasCompleted) {
                state.totalCompleted++;
                
                const completedCount = Object.values(state.completedToday).filter(Boolean).length;
                if (completedCount === 1 && state.lastCompletedDate !== today) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayKey = yesterday.toISOString().split('T')[0];
                    
                    if (state.lastCompletedDate === yesterdayKey) {
                        state.streak++;
                    } else if (!state.lastCompletedDate) {
                        state.streak = 1;
                    }
                    state.lastCompletedDate = today;
                }
                
                // Haptic feedback
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred('medium');
                }
                
                // Celebration animation
                const taskEl = document.querySelector(\`[data-task-id="\${taskId}"]\`);
                if (taskEl) {
                    taskEl.classList.add('celebrating');
                    setTimeout(() => taskEl.classList.remove('celebrating'), 300);
                }
            } else {
                state.totalCompleted = Math.max(0, state.totalCompleted - 1);
            }
            
            saveData();
            render();
        };
        
        // Render
        const render = () => {
            const completedCount = Object.values(state.completedToday).filter(Boolean).length;
            const progress = (completedCount / state.tasks.length) * 100;
            const currentLevel = getCurrentLevel();
            const levelProgress = getProgressToNextLevel();
            
            const app = document.getElementById('app');
            app.innerHTML = \`
                <!-- Header -->
                <div class="header">
                    <div class="header-content">
                        \${state.tgUser ? \`<p class="user-greeting">Привет, \${state.tgUser.first_name}! 👋</p>\` : ''}
                        <h1>\${CONFIG.title}</h1>
                        <p>\${CONFIG.subtitle}</p>
                    </div>
                </div>
                
                <!-- Stats Grid -->
                <div class="stats-grid">
                    <!-- Level Card -->
                    <div class="stat-card level">
                        <div class="stat-label">
                            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #a78bfa;">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            \${CONFIG.levelLabel}
                        </div>
                        <div class="stat-value">
                            <span class="icon">\${currentLevel.icon}</span>
                            <span class="name" style="color: \${currentLevel.color}">\${currentLevel.name}</span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: \${levelProgress.progress}%; background: linear-gradient(90deg, \${currentLevel.color}, \${levelProgress.nextLevel?.color || currentLevel.color})"></div>
                            </div>
                            \${levelProgress.nextLevel ? \`<p class="stat-subtext">\${levelProgress.remaining} до \${levelProgress.nextLevel.icon}</p>\` : ''}
                        </div>
                    </div>
                    
                    <!-- Streak Card -->
                    <div class="stat-card streak">
                        <div class="stat-label">
                            <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #fb923c;">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                            </svg>
                            \${CONFIG.streakLabel}
                        </div>
                        <div class="stat-value">
                            <span class="number">\${state.streak}</span>
                            <span class="unit">дней</span>
                        </div>
                        <p class="stat-subtext">Всего: \${state.totalCompleted} задач</p>
                    </div>
                </div>
                
                <!-- Today's Progress -->
                <div class="progress-card">
                    <div class="progress-header">
                        <div class="progress-title">
                            <svg class="icon-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #22d3ee;">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            \${CONFIG.tasksLabel}
                        </div>
                        <span class="progress-count">\${completedCount}/\${state.tasks.length}</span>
                    </div>
                    <div class="main-progress">
                        <div class="main-progress-fill \${progress === 100 ? 'complete' : ''}" style="width: \${progress}%">
                            \${progress === 100 ? '<div class="shimmer"></div>' : ''}
                        </div>
                    </div>
                    \${getMotivation() ? \`<div class="motivation">✨ \${getMotivation()}</div>\` : ''}
                </div>
                
                <!-- Tasks List -->
                <div class="tasks-list">
                    \${state.tasks.map(task => {
                        const isCompleted = state.completedToday[task.id];
                        return \`
                            <div class="task-item \${isCompleted ? 'completed' : ''}" 
                                 data-task-id="\${task.id}"
                                 onclick="toggleTask(\${task.id})">
                                <div class="task-content">
                                    <div class="checkbox \${isCompleted ? 'checked' : 'unchecked'}">
                                        \${isCompleted ? \`
                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                                            </svg>
                                        \` : ''}
                                    </div>
                                    <div class="task-info">
                                        <span class="task-emoji">\${task.emoji}</span>
                                        <span class="task-name \${isCompleted ? 'completed' : ''}">\${task.name}</span>
                                    </div>
                                    <span class="task-status \${isCompleted ? 'done' : 'pending'}">
                                        \${isCompleted ? CONFIG.completedText : CONFIG.pendingText}
                                    </span>
                                </div>
                            </div>
                        \`;
                    }).join('')}
                </div>
                
                <!-- Bottom Stats -->
                <div class="bottom-stats">
                    <div class="bottom-stat">
                        <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Обновится завтра
                    </div>
                    <div class="bottom-stat">
                        <svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #fbbf24;">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                        </svg>
                        \${state.totalCompleted} всего
                    </div>
                </div>
            \`;
        };
        
        // Init
        const init = () => {
            // Initialize Telegram Web App
            if (window.Telegram?.WebApp) {
                tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();
                
                if (tg.initDataUnsafe?.user) {
                    state.tgUser = tg.initDataUnsafe.user;
                }
                
                // Apply Telegram theme
                if (tg.colorScheme === 'dark') {
                    document.documentElement.style.setProperty('--bg-primary', '#0f1419');
                }
            }
            
            loadData();
            render();
        };
        
        // Start app when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    </script>
    
    <!--
    ============================================
    📱 TELEGRAM BOT SETUP INSTRUCTIONS
    ============================================
    
    1. Создайте бота через @BotFather командой /newbot
    2. После создания отправьте /mybots
    3. Выберите вашего бота
    4. Нажмите "Bot Settings" -> "Menu Button" -> "Configure Menu Button"
    5. Отправьте URL вашего приложения (например: https://your-app.vercel.app)
    
    Альтернативный способ (Web App через кнопку):
    1. Отправьте @BotFather команду /newapp
    2. Выберите бота
    3. Укажите название приложения
    4. Укажите URL приложения
    5. Загрузите иконку (512x512 PNG)
    
    Для тестирования:
    - Используйте @WebAppBot или @DurgerKingBot для теста
    - Или откройте через: https://t.me/YOUR_BOT_NAME?startapp
    
    ============================================
    -->
</body>
</html>`;

export default function TelegramMiniAppCode() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(TELEGRAM_MINI_APP_CODE);
    setCopied(true);
    toast.success('Код скопирован!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([TELEGRAM_MINI_APP_CODE], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daily-tracker.html';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Файл загружен!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Telegram Mini App Code
          </h1>
          <p className="text-slate-400">
            Полный HTML/CSS/JS код для деплоя на Vercel/Netlify
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <Button 
            onClick={handleCopy}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Скопировано!' : 'Копировать код'}
          </Button>
          <Button 
            onClick={handleDownload}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Скачать HTML
          </Button>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800/50 rounded-xl p-6 mb-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-cyan-400" />
            Инструкция по подключению к Telegram
          </h2>
          <ol className="space-y-3 text-slate-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-sm font-medium">1</span>
              <span>Создайте бота через <code className="px-2 py-0.5 bg-slate-700 rounded">@BotFather</code> командой <code className="px-2 py-0.5 bg-slate-700 rounded">/newbot</code></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-sm font-medium">2</span>
              <span>Разверните HTML файл на Vercel/Netlify (drag & drop)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-sm font-medium">3</span>
              <span>Отправьте <code className="px-2 py-0.5 bg-slate-700 rounded">/mybots</code> → выберите бота → Bot Settings → Menu Button</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-sm font-medium">4</span>
              <span>Укажите URL вашего приложения (например: <code className="px-2 py-0.5 bg-slate-700 rounded">https://your-app.vercel.app</code>)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-sm font-medium">5</span>
              <span>Готово! Откройте бота и нажмите кнопку меню для запуска Mini App</span>
            </li>
          </ol>
        </div>

        {/* Code Preview */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <span className="text-sm text-slate-400">daily-tracker.html</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">
              {TELEGRAM_MINI_APP_CODE.length.toLocaleString()} символов
            </span>
          </div>
          <pre className="p-4 text-sm text-slate-300 overflow-auto max-h-[500px]">
            <code>{TELEGRAM_MINI_APP_CODE.slice(0, 2000)}...</code>
          </pre>
        </div>
      </div>
    </div>
  );
}