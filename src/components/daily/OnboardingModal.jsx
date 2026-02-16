import React, { useState } from 'react';
import { ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const ONBOARDING_QUESTIONS = [
  {
    category: 'health',
    emoji: '💪',
    title: 'Здоровье и спорт',
    question: 'Расскажите о вашей физической форме. Занимаетесь ли спортом? Какие цели по здоровью?',
    placeholder: 'Например: хожу в зал 2 раза в неделю, хочу похудеть на 5кг...'
  },
  {
    category: 'mind',
    emoji: '🧠',
    title: 'Разум и обучение',
    question: 'Чем вы интересуетесь? Есть ли практика медитации или обучения?',
    placeholder: 'Например: учу английский, читаю книги по психологии...'
  },
  {
    category: 'work',
    emoji: '💼',
    title: 'Работа и карьера',
    question: 'Кем вы работаете? Какие профессиональные цели?',
    placeholder: 'Например: разработчик, хочу получить повышение...'
  },
  {
    category: 'money',
    emoji: '💰',
    title: 'Финансы',
    question: 'Какие у вас финансовые цели? Инвестируете ли?',
    placeholder: 'Например: копить на квартиру, начать инвестировать...'
  },
  {
    category: 'love',
    emoji: '❤️',
    title: 'Любовь и отношения',
    question: 'Как ваша личная жизнь? Что хотите улучшить?',
    placeholder: 'Например: в отношениях, хочу больше времени вместе...'
  },
  {
    category: 'friends',
    emoji: '👥',
    title: 'Друзья и социум',
    question: 'Как часто общаетесь с друзьями? Хватает ли социализации?',
    placeholder: 'Например: мало общаюсь, хочу найти новых друзей...'
  }
];

export default function OnboardingModal({ onComplete, theme = 'dark' }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);

  const currentQuestion = ONBOARDING_QUESTIONS[currentStep];
  const progress = ((currentStep + 1) / ONBOARDING_QUESTIONS.length) * 100;

  const handleAnswer = (answer) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.category]: answer
    }));
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsGenerating(true);
    await onComplete(answers);
  };

  const canProceed = answers[currentQuestion?.category]?.trim().length > 0;

  if (isGenerating) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${
        theme === 'light' ? 'bg-white' : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419]'
      }`}>
        <div className="text-center px-6">
          <div className="mb-6">
            <Loader2 className={`w-16 h-16 mx-auto animate-spin ${
              theme === 'light' ? 'text-purple-600' : 'text-purple-400'
            }`} />
          </div>
          <h2 className={`text-2xl font-bold mb-3 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
            AI создаёт ваши квесты
          </h2>
          <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            Персонализируем задания специально для вас...
          </p>
          <div className="mt-6 flex gap-2 justify-center">
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${
      theme === 'light' 
        ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50'
        : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419]'
    }`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' 
          ? 'bg-white/90 border-gray-200' 
          : 'bg-[#0f1419]/90 border-white/10'
      }`}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className={`w-6 h-6 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
            <div>
              <h1 className={`text-xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                Знакомство
              </h1>
              <p className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Шаг {currentStep + 1} из {ONBOARDING_QUESTIONS.length}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className={`h-2 rounded-full overflow-hidden ${
            theme === 'light' ? 'bg-gray-200' : 'bg-white/10'
          }`}>
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-cyan-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Question Card */}
          <div className={`rounded-3xl p-6 border mb-6 ${
            theme === 'light' 
              ? 'bg-white border-gray-200 shadow-lg' 
              : 'bg-[#1e2836] border-white/10'
          }`}>
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">{currentQuestion.emoji}</div>
              <h2 className={`text-2xl font-bold mb-2 ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                {currentQuestion.title}
              </h2>
              <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                {currentQuestion.question}
              </p>
            </div>

            <Textarea
              value={answers[currentQuestion.category] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder={currentQuestion.placeholder}
              className={`min-h-32 text-base ${
                theme === 'light' 
                  ? 'bg-gray-50 border-gray-300 text-gray-900' 
                  : 'bg-white/5 border-white/10 text-white'
              }`}
              autoFocus
            />
          </div>

          {/* Dots indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {ONBOARDING_QUESTIONS.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep 
                    ? 'w-8 bg-gradient-to-r from-purple-600 to-cyan-600' 
                    : idx < currentStep
                      ? 'w-2 bg-purple-500'
                      : theme === 'light' 
                        ? 'w-2 bg-gray-300' 
                        : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`sticky bottom-0 p-5 border-t backdrop-blur-xl ${
        theme === 'light' 
          ? 'bg-white/90 border-gray-200' 
          : 'bg-[#0f1419]/90 border-white/10'
      }`}>
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 disabled:opacity-50"
          >
            {currentStep === ONBOARDING_QUESTIONS.length - 1 ? (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Создать мои квесты
              </>
            ) : (
              <>
                Далее
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}