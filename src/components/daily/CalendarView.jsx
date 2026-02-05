import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CalendarView({ completionHistory, onClose, categories, theme = 'dark' }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // 'day', 'week', 'month'

  // Навигация
  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Получить дни месяца
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Добавить пустые дни в начале
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Добавить дни месяца
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  // Получить дни недели
  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diff);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }

    return days;
  };

  // Форматирование даты
  const formatDateKey = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const formatMonthYear = () => {
    const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const formatDayDate = () => {
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                   'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${days[currentDate.getDay()]}, ${currentDate.getDate()} ${months[currentDate.getMonth()]}`;
  };

  // Проверка на сегодняшний день
  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Получить квесты для даты
  const getQuestsForDate = (date) => {
    if (!date) return [];
    const dateKey = formatDateKey(date);
    return completionHistory[dateKey] || [];
  };

  // Рендер дня в календаре
  const renderCalendarDay = (date) => {
    if (!date) {
      return <div className="aspect-square" />;
    }

    const quests = getQuestsForDate(date);
    const hasQuests = quests.length > 0;
    const today = isToday(date);

    return (
      <div
        className={`
          aspect-square p-2 rounded-xl cursor-pointer
          transition-all duration-200
          ${today 
            ? theme === 'light'
              ? 'bg-purple-100 border-2 border-purple-500'
              : 'bg-purple-500/20 border-2 border-purple-500'
            : ''
          }
          ${hasQuests && !today 
            ? theme === 'light'
              ? 'bg-gray-100 hover:bg-gray-200'
              : 'bg-white/5 hover:bg-white/10'
            : ''
          }
          ${!hasQuests && !today 
            ? theme === 'light'
              ? 'hover:bg-gray-50'
              : 'hover:bg-white/5'
            : ''
          }
        `}
      >
        <div className="flex flex-col h-full">
          <span className={`
            text-xs font-medium mb-1
            ${today 
              ? 'text-purple-600' 
              : hasQuests 
                ? theme === 'light' ? 'text-gray-900' : 'text-white'
                : theme === 'light' ? 'text-gray-400' : 'text-gray-500'
            }
          `}>
            {date.getDate()}
          </span>
          {hasQuests && (
            <div className="flex flex-wrap gap-0.5 mt-auto">
              {quests.slice(0, 3).map((quest, idx) => {
                const categoryInfo = categories[quest.category];
                return (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full ${categoryInfo?.bgColor || 'bg-white/20'}`}
                    style={{ backgroundColor: categoryInfo?.color }}
                  />
                );
              })}
              {quests.length > 3 && (
                <span className="text-xs text-gray-500">+{quests.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Рендер деталей дня
  const renderDayDetails = () => {
    const quests = getQuestsForDate(currentDate);

    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            {formatDayDate()}
          </h3>
          <p className={`mt-1 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            {quests.length === 0 ? 'Нет выполненных квестов' : `${quests.length} квест${quests.length === 1 ? '' : quests.length < 5 ? 'а' : 'ов'}`}
          </p>
        </div>

        {quests.length > 0 ? (
          <div className="space-y-3">
            {quests.map((quest, idx) => {
              const categoryInfo = categories[quest.category];
              const Icon = categoryInfo?.icon;

              return (
                <div
                  key={idx}
                  className={`
                    p-4 rounded-xl border
                    ${categoryInfo?.bgColor || 'bg-white/5'}
                    ${categoryInfo?.borderColor || 'border-white/10'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {Icon && (
                      <div className={`p-2 rounded-lg ${categoryInfo.bgColor}`}>
                        <Icon className={`w-5 h-5 ${categoryInfo.textColor}`} />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{quest.emoji}</span>
                        <span className="font-medium">{quest.questName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${categoryInfo?.textColor || 'text-gray-400'}`}>
                          {categoryInfo?.name || quest.category}
                        </span>
                        <span className="text-xs text-gray-500">• Lvl {quest.level}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              theme === 'light' ? 'bg-gray-100' : 'bg-white/5'
            }`}>
              <CalendarIcon className={`w-8 h-8 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
            <p className={theme === 'light' ? 'text-gray-600' : 'text-gray-500'}>
              В этот день квесты не выполнялись
            </p>
          </div>
        )}
      </div>
    );
  };

  // Рендер недели
  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    return (
      <div className="space-y-3">
        {weekDays.map((date, idx) => {
          const quests = getQuestsForDate(date);
          const today = isToday(date);

          return (
            <div
              key={idx}
              className={`
                p-4 rounded-xl border transition-all
                ${today 
                  ? theme === 'light'
                    ? 'bg-purple-50 border-purple-200'
                    : 'bg-purple-500/10 border-purple-500/30'
                  : theme === 'light'
                    ? 'bg-white border-gray-200'
                    : 'bg-white/5 border-white/10'
                }
                ${quests.length > 0 
                  ? theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-white/10'
                  : ''
                }
              `}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className={`font-medium ${
                    today 
                      ? 'text-purple-600'
                      : theme === 'light' ? 'text-gray-900' : 'text-white'
                  }`}>
                    {dayNames[idx]}
                  </span>
                  <span className={theme === 'light' ? 'text-gray-600 ml-2' : 'text-gray-400 ml-2'}>
                    {date.getDate()}.{String(date.getMonth() + 1).padStart(2, '0')}
                  </span>
                </div>
                <span className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-500'}`}>
                  {quests.length} квест{quests.length === 1 ? '' : quests.length < 5 ? 'а' : 'ов'}
                </span>
              </div>

              {quests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {quests.map((quest, qIdx) => {
                    const categoryInfo = categories[quest.category];
                    return (
                      <div
                        key={qIdx}
                        className={`
                          px-3 py-1.5 rounded-lg text-sm flex items-center gap-2
                          ${categoryInfo?.bgColor || 'bg-white/5'}
                        `}
                      >
                        <span>{quest.emoji}</span>
                        <span className={categoryInfo?.textColor || 'text-white'}>
                          {quest.questName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`min-h-screen pb-8 ${
      theme === 'light'
        ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50 text-gray-900'
        : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419] text-white'
    }`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-lg border-b ${
        theme === 'light'
          ? 'bg-white/90 border-gray-200'
          : 'bg-[#0f1419]/90 border-white/5'
      }`}>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">История квестов</h1>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-full ${
                theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'
              }`}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className={`w-full ${
              theme === 'light' ? 'bg-black/5' : 'bg-white/5'
            }`}>
              <TabsTrigger value="day" className="flex-1">День</TabsTrigger>
              <TabsTrigger value="week" className="flex-1">Неделя</TabsTrigger>
              <TabsTrigger value="month" className="flex-1">Месяц</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            onClick={navigatePrevious}
            variant="ghost"
            size="icon"
            className={`h-10 w-10 rounded-full ${
              theme === 'light'
                ? 'bg-black/5 hover:bg-black/10'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div className="text-center">
            <h2 className="text-lg font-semibold">
              {viewMode === 'day' ? formatDayDate() : formatMonthYear()}
            </h2>
          </div>

          <Button
            onClick={navigateNext}
            variant="ghost"
            size="icon"
            className={`h-10 w-10 rounded-full ${
              theme === 'light'
                ? 'bg-black/5 hover:bg-black/10'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Stats Summary */}
        <div className={`rounded-xl p-3 border mb-4 ${
          theme === 'light'
            ? 'bg-white border-gray-200'
            : 'bg-white/5 border-white/5'
        }`}>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-purple-400">
                {Object.keys(completionHistory).length}
              </div>
              <div className={`text-xs mt-0.5 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-500'
              }`}>
                Активных дней
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-cyan-400">
                {Object.values(completionHistory).reduce((sum, quests) => sum + quests.length, 0)}
              </div>
              <div className={`text-xs mt-0.5 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-500'
              }`}>
                Всего квестов
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-400">
                {Object.keys(completionHistory).length > 0
                  ? Math.round(Object.values(completionHistory).reduce((sum, quests) => sum + quests.length, 0) / Object.keys(completionHistory).length)
                  : 0}
              </div>
              <div className={`text-xs mt-0.5 ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-500'
              }`}>
                В среднем/день
              </div>
            </div>
          </div>
        </div>

        {/* Today Button */}
        {!isToday(currentDate) && (
          <div className="flex justify-center mb-4">
            <Button
              onClick={goToToday}
              variant="outline"
              size="sm"
              className={
                theme === 'light'
                  ? 'border-purple-400 text-purple-600 hover:bg-purple-50'
                  : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
              }
            >
              Сегодня
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5">
        {viewMode === 'month' && (
          <div>
            {/* Day Names */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="text-center text-xs text-gray-500 font-medium py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {getMonthDays().map((date, idx) => (
                <div key={idx}>
                  {renderCalendarDay(date)}
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayDetails()}
      </div>
    </div>
  );
}