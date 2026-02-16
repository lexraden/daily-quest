import React, { useState, useRef } from 'react';
import { ChevronRight, Sparkles, Loader2, Mic, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const ONBOARDING_QUESTIONS = [
  {
    category: 'health',
    emoji: '💪',
    title: 'Здоровье',
    question: 'Какие ежедневные активности помогут вам быть здоровее?',
    placeholder: 'Например: хожу в зал, бегаю по утрам, делаю зарядку...'
  },
  {
    category: 'mind',
    emoji: '🧠',
    title: 'Разум и обучение',
    question: 'Что вы делаете каждый день для саморазвития?',
    placeholder: 'Например: читаю книги, учу языки, медитирую...'
  },
  {
    category: 'work',
    emoji: '💼',
    title: 'Работа и карьера',
    question: 'Кем работаете? Какие задачи выполняете ежедневно?',
    placeholder: 'Например: разработчик, пишу код, провожу встречи...'
  },
  {
    category: 'money',
    emoji: '💰',
    title: 'Финансы',
    question: 'Какие финансовые привычки хотите развить?',
    placeholder: 'Например: откладываю 10%, веду учет расходов...'
  },
  {
    category: 'love',
    emoji: '❤️',
    title: 'Любовь и отношения',
    question: 'Есть ли партнер? Что делаете для укрепления отношений?',
    placeholder: 'Например: в отношениях, хочу больше времени с любимой...'
  },
  {
    category: 'friends',
    emoji: '👥',
    title: 'Друзья и социум',
    question: 'Как часто общаетесь с друзьями? Хватает ли общения?',
    placeholder: 'Например: встречаюсь с друзьями раз в неделю...'
  }
];

export default function OnboardingModal({ onComplete, theme = 'dark' }) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen
  const [answers, setAnswers] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const isStoppingRef = useRef(false);
  const accumulatedTextRef = useRef('');

  const currentQuestion = currentStep >= 0 ? ONBOARDING_QUESTIONS[currentStep] : null;
  const progress = currentStep >= 0 ? ((currentStep + 1) / ONBOARDING_QUESTIONS.length) * 100 : 0;

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

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Голосовой ввод не поддерживается');
      return;
    }

    // Reuse existing recognition instance if available
    if (!recognitionRef.current) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        accumulatedTextRef.current = '';
        
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
      };

      recognition.onresult = (event) => {
        const result = event.results[0][0].transcript;
        accumulatedTextRef.current = result;
      };

      recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          console.error('Speech error:', event.error);
          setIsRecording(false);
          toast.error('Ошибка распознавания');
        }
      };

      recognition.onend = () => {
        if (!isStoppingRef.current && isRecording) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.log('Restart failed');
          }
        } else {
          setIsRecording(false);
          const finalText = accumulatedTextRef.current.trim();
          if (finalText) {
            handleAnswer(finalText);
            toast.success('Текст распознан!');
          }
        }
      };
    }

    isStoppingRef.current = false;
    accumulatedTextRef.current = '';

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error('Failed to start recording:', e);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      isStoppingRef.current = true;
      recognitionRef.current.stop();
    }
  };

  const canProceed = currentStep === -1 || answers[currentQuestion?.category]?.trim().length > 0;

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

  // Welcome Screen
  if (currentStep === -1) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col ${
        theme === 'light' 
          ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50'
          : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419]'
      }`}>
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="max-w-md text-center">
            {/* Icon */}
            <div className="mb-6">
              <div className={`inline-flex p-6 rounded-3xl ${
                theme === 'light'
                  ? 'bg-gradient-to-br from-purple-100 to-cyan-100'
                  : 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20'
              }`}>
                <Sparkles className={`w-16 h-16 ${
                  theme === 'light' ? 'text-purple-600' : 'text-purple-400'
                }`} />
              </div>
            </div>

            {/* Title */}
            <h1 className={`text-4xl font-bold mb-4 ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              Welcome to<br />Daily Quests
            </h1>

            {/* Description */}
            <p className={`text-lg mb-8 ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              Мы создадим персональные задания, которые помогут тебе прокачивать все аспекты жизни каждый день
            </p>

            {/* CTA */}
            <Button
              onClick={() => setCurrentStep(0)}
              className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
            >
              Start Leveling Up Today
              <ChevronRight className="w-6 h-6 ml-2" />
            </Button>
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
              <p className={`text-base font-semibold ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
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
            />

            {/* Voice Input */}
            <div className="mt-4">
              <Button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`w-full h-14 text-base transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
                }`}
              >
                <Mic className="w-5 h-5 mr-2" />
                {isRecording ? 'Отпустите для остановки' : 'Запись голосом'}
              </Button>
            </div>
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