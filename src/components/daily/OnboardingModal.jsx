import React, { useState, useRef, useMemo } from 'react';
import { ChevronRight, Sparkles, Loader2, Mic, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const TRANSLATIONS = {
  ru: {
    welcome: {
      title: 'Прокачай свою жизнь',
      subtitle: 'с Daily Quests ⚡',
      description: 'Персональные ежедневные задания для здоровья, работы, отношений и финансов',
      features: ['🎯 AI создаёт твои квесты', '📈 Отслеживай прогресс', '🔥 Строй серии побед'],
      button: '🚀 Начать прямо сейчас',
      time: 'Всего 2 минуты настройки'
    },
    header: {
      title: 'Знакомство',
      step: 'Шаг'
    },
    questions: [
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
        title: 'Разум',
        question: 'Что вы делаете каждый день для саморазвития?',
        placeholder: 'Например: читаю книги, учу языки, медитирую...'
      },
      {
        category: 'work',
        emoji: '💼',
        title: 'Работа',
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
        title: 'Любовь',
        question: 'Есть ли партнер? Что делаете для укрепления отношений?',
        placeholder: 'Например: в отношениях, хочу больше времени с любимой...'
      },
      {
        category: 'friends',
        emoji: '👥',
        title: 'Друзья',
        question: 'Как часто общаетесь с друзьями? Хватает ли общения?',
        placeholder: 'Например: встречаюсь с друзьями раз в неделю...'
      }
    ],
    voice: {
      recording: 'Отпустите для остановки',
      record: 'Запись голосом',
      success: 'Текст распознан!'
    },
    buttons: {
      next: 'Далее',
      complete: 'Создать мои квесты'
    },
    loading: {
      title: 'AI создаёт ваши квесты',
      subtitle: 'Персонализируем задания специально для вас...'
    }
  },
  en: {
    welcome: {
      title: 'Level Up Your Life',
      subtitle: 'with Daily Quests ⚡',
      description: 'Personalized daily quests for health, work, relationships, and finances',
      features: ['🎯 AI creates your quests', '📈 Track your progress', '🔥 Build win streaks'],
      button: '🚀 Start Now',
      time: 'Just 2 minutes to set up'
    },
    header: {
      title: 'Getting Started',
      step: 'Step'
    },
    questions: [
      {
        category: 'health',
        emoji: '💪',
        title: 'Health',
        question: 'What daily activities will help you be healthier?',
        placeholder: 'Example: go to gym, run in the morning, do exercises...'
      },
      {
        category: 'mind',
        emoji: '🧠',
        title: 'Mind',
        question: 'What do you do every day for self-development?',
        placeholder: 'Example: read books, learn languages, meditate...'
      },
      {
        category: 'work',
        emoji: '💼',
        title: 'Work',
        question: 'What do you do? What tasks do you complete daily?',
        placeholder: 'Example: developer, write code, conduct meetings...'
      },
      {
        category: 'money',
        emoji: '💰',
        title: 'Money',
        question: 'What financial habits do you want to develop?',
        placeholder: 'Example: save 10%, track expenses...'
      },
      {
        category: 'love',
        emoji: '❤️',
        title: 'Love',
        question: 'Do you have a partner? What do you do to strengthen relationships?',
        placeholder: 'Example: in a relationship, want more time with loved one...'
      },
      {
        category: 'friends',
        emoji: '👥',
        title: 'Friends',
        question: 'How often do you communicate with friends? Is it enough?',
        placeholder: 'Example: meet friends once a week...'
      }
    ],
    voice: {
      recording: 'Release to stop',
      record: 'Voice recording',
      success: 'Text recognized!'
    },
    buttons: {
      next: 'Next',
      complete: 'Create my quests'
    },
    loading: {
      title: 'AI is creating your quests',
      subtitle: 'Personalizing quests especially for you...'
    }
  }
};

export default function OnboardingModal({ onComplete, theme = 'dark' }) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen
  const [answers, setAnswers] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const isStoppingRef = useRef(false);
  const accumulatedTextRef = useRef('');
  const currentStepRef = useRef(-1);

  // Detect user language
  const userLang = useMemo(() => {
    const lang = navigator.language || navigator.userLanguage || 'en';
    return lang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  }, []);

  const t = TRANSLATIONS[userLang];
  const ONBOARDING_QUESTIONS = t.questions;

  // Keep currentStepRef in sync with currentStep
  React.useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Request microphone permission once on mount
  React.useEffect(() => {
    const requestMicPermission = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        console.log('Microphone permission denied:', error);
      }
    };
    
    requestMicPermission();
  }, []);

  // Initialize speech recognition once on mount
  React.useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = userLang === 'ru' ? 'ru-RU' : 'en-US';
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
        if (finalText && currentStepRef.current >= 0) {
          const question = ONBOARDING_QUESTIONS[currentStepRef.current];
          setAnswers(prev => ({
            ...prev,
            [question.category]: finalText
          }));
          toast.success(t.voice.success);
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [userLang]);

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
    if (!recognitionRef.current) {
      toast.error('Голосовой ввод не поддерживается');
      return;
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
            {t.loading.title}
          </h2>
          <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            {t.loading.subtitle}
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
      <div className={`fixed inset-0 z-50 flex flex-col overflow-y-auto ${
        theme === 'light' 
          ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50'
          : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419]'
      }`}>
        <div className="flex-1 flex items-center justify-center px-5 py-8 min-h-full">
          <div className="max-w-md w-full my-auto">
            {/* Hero Icon */}
            <div className="mb-6 text-center">
              <div className={`inline-flex p-5 rounded-3xl ${
                theme === 'light'
                  ? 'bg-gradient-to-br from-purple-100 to-cyan-100'
                  : 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20'
              }`}>
                <Sparkles className={`w-12 h-12 ${
                  theme === 'light' ? 'text-purple-600' : 'text-purple-400'
                }`} />
              </div>
            </div>

            {/* Title */}
            <h1 className={`text-3xl font-bold mb-3 text-center ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              {t.welcome.title}
              <br />
              <span className="text-2xl">{t.welcome.subtitle}</span>
            </h1>

            {/* Description */}
            <p className={`text-base mb-6 text-center ${
              theme === 'light' ? 'text-gray-600' : 'text-gray-400'
            }`}>
              {t.welcome.description}
            </p>

            {/* Features - compact */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {t.welcome.features.map((feature, idx) => (
                <div 
                  key={idx}
                  className={`text-center p-3 rounded-xl ${
                    theme === 'light'
                      ? 'bg-white border border-gray-200'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="text-2xl mb-1">{feature.split(' ')[0]}</div>
                  <div className={`text-xs font-medium ${
                    theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                  }`}>
                    {feature.substring(feature.indexOf(' ') + 1)}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Button
              onClick={() => setCurrentStep(0)}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 shadow-lg"
            >
              {t.welcome.button}
              <ChevronRight className="w-6 h-6 ml-2" />
            </Button>

            {/* Time indicator */}
            <p className={`text-center mt-3 text-xs ${
              theme === 'light' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              ⏱️ {t.welcome.time}
            </p>
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
                {t.header.title}
              </h1>
              <p className={`text-xs ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                {t.header.step} {currentStep + 1} {userLang === 'ru' ? 'из' : 'of'} {ONBOARDING_QUESTIONS.length}
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
                {isRecording ? t.voice.recording : t.voice.record}
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
                {t.buttons.complete}
              </>
            ) : (
              <>
                {t.buttons.next}
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}