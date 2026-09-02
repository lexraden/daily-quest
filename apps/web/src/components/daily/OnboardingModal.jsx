import React, { useState, useRef, useMemo } from 'react';
import { ChevronRight, Sparkles, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { useSpeechRecognition } from '@/components/useSpeechRecognition';

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
        question: 'Каких целей вы хотите достичь в здоровье?',
        placeholder: 'Например: похудеть, набрать мышцы, улучшить сон, бегать 5 км, бросить курить...',
        examples: ['🏃 Похудеть', '💪 Набрать форму', '😴 Хороший сон', '🥗 Здоровое питание']
      },
      {
        category: 'mind',
        emoji: '🧠',
        title: 'Разум',
        question: 'Каких целей вы хотите достичь в саморазвитии?',
        placeholder: 'Например: выучить английский, читать 30 книг в год, снизить стресс...',
        examples: ['📖 Читать больше', '🧘 Меньше стресса', '🎓 Выучить язык', '🧩 Новый навык']
      },
      {
        category: 'work',
        emoji: '💼',
        title: 'Работа',
        question: 'Каких целей вы хотите достичь в работе?',
        placeholder: 'Например: получить повышение, запустить свой проект, стать продуктивнее...',
        examples: ['📈 Повышение', '🚀 Свой проект', '⏰ Продуктивность', '🎯 Новая работа']
      },
      {
        category: 'money',
        emoji: '💰',
        title: 'Финансы',
        question: 'Каких финансовых целей вы хотите достичь?',
        placeholder: 'Например: накопить подушку безопасности, начать инвестировать, закрыть долги...',
        examples: ['🏦 Накопления', '📊 Инвестиции', '💳 Закрыть долги', '📋 Вести бюджет']
      },
      {
        category: 'love',
        emoji: '❤️',
        title: 'Любовь',
        question: 'Каких целей вы хотите достичь в отношениях?',
        placeholder: 'Например: больше времени с партнёром, улучшить общение, найти пару...',
        examples: ['💑 Больше времени вместе', '💬 Улучшить общение', '🌹 Романтика', '🔍 Найти пару']
      },
      {
        category: 'friends',
        emoji: '👥',
        title: 'Друзья',
        question: 'Каких целей вы хотите достичь в дружбе?',
        placeholder: 'Например: чаще видеться с друзьями, найти новых друзей, организовать встречу...',
        examples: ['🤝 Видеться чаще', '🆕 Новые друзья', '🎉 Организовать встречу', '📞 Быть на связи']
      }
    ],
    voice: {
      recording: 'Отпустите для остановки',
      record: 'Голосовой ввод',
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
        question: 'What health goals do you want to achieve?',
        placeholder: 'Example: lose weight, build muscle, sleep better, run 5K, quit smoking...',
        examples: ['🏃 Lose weight', '💪 Get fit', '😴 Better sleep', '🥗 Eat healthy']
      },
      {
        category: 'mind',
        emoji: '🧠',
        title: 'Mind',
        question: 'What self-development goals do you want to achieve?',
        placeholder: 'Example: learn a language, read 30 books a year, reduce stress...',
        examples: ['📖 Read more', '🧘 Less stress', '🎓 Learn language', '🧩 New skill']
      },
      {
        category: 'work',
        emoji: '💼',
        title: 'Work',
        question: 'What career goals do you want to achieve?',
        placeholder: 'Example: get promoted, launch a project, be more productive...',
        examples: ['📈 Promotion', '🚀 Side project', '⏰ Productivity', '🎯 New job']
      },
      {
        category: 'money',
        emoji: '💰',
        title: 'Money',
        question: 'What financial goals do you want to achieve?',
        placeholder: 'Example: build savings, start investing, pay off debt...',
        examples: ['🏦 Savings', '📊 Investing', '💳 Pay off debt', '📋 Budget']
      },
      {
        category: 'love',
        emoji: '❤️',
        title: 'Love',
        question: 'What relationship goals do you want to achieve?',
        placeholder: 'Example: more quality time, better communication, find a partner...',
        examples: ['💑 Quality time', '💬 Communication', '🌹 Romance', '🔍 Find partner']
      },
      {
        category: 'friends',
        emoji: '👥',
        title: 'Friends',
        question: 'What friendship goals do you want to achieve?',
        placeholder: 'Example: see friends more often, make new friends, organize meetups...',
        examples: ['🤝 Meet more often', '🆕 New friends', '🎉 Organize events', '📞 Stay in touch']
      }
    ],
    voice: {
      recording: 'Release to stop',
      record: 'Voice input',
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
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const { recognition } = useSpeechRecognition();
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



  // Setup speech recognition callbacks
  React.useEffect(() => {
    if (!recognition) return;

    recognition.lang = userLang === 'ru' ? 'ru-RU' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    const handleStart = () => {
      setIsRecording(true);
      accumulatedTextRef.current = '';
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    };

    const handleResult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
      }
      accumulatedTextRef.current = transcript.trim();
    };

    const handleEnd = () => {
      // continuous=false: browser auto-stops after silence pause
      // Process whatever was captured
      setIsRecording(false);
      const rawText = accumulatedTextRef.current.trim();

      if (rawText && currentStepRef.current >= 0) {
        const question = ONBOARDING_QUESTIONS[currentStepRef.current];
        setIsProcessingVoice(true);

        // Prompt and schema moved server-side with the rest of the AI calls.
        api.ai
          .cleanupTranscript(question.question, rawText, userLang).then(result => {
          const cleanedText = result.cleaned_text || rawText;
          const cat = ONBOARDING_QUESTIONS[currentStepRef.current]?.category;
          if (cat) {
            setAnswers(prev => ({ ...prev, [cat]: cleanedText }));
          }
          toast.success(t.voice.success);
        }).catch(() => {
          const cat = ONBOARDING_QUESTIONS[currentStepRef.current]?.category;
          if (cat) {
            setAnswers(prev => ({ ...prev, [cat]: rawText }));
          }
          toast.success(t.voice.success);
        }).finally(() => {
          setIsProcessingVoice(false);
        });
      }
    };

    const handleError = (event) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error(userLang === 'ru' ? 'Разрешите доступ к микрофону' : 'Allow microphone access');
        setIsRecording(false);
      } else if (event.error === 'no-speech') {
        // Silence — just stop quietly
        setIsRecording(false);
      } else if (event.error !== 'aborted') {
        console.error('Speech error:', event.error);
        setIsRecording(false);
      }
    };

    recognition.onstart = handleStart;
    recognition.onresult = handleResult;
    recognition.onend = handleEnd;
    recognition.onerror = handleError;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
    };
  }, [recognition, userLang]);

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
    if (!recognition) {
      toast.error(userLang === 'ru' ? 'Голосовой ввод не поддерживается' : 'Voice input not supported');
      return;
    }
    if (isRecording || isProcessingVoice) return;

    accumulatedTextRef.current = '';
    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error(userLang === 'ru' ? 'Не удалось запустить микрофон' : 'Failed to start microphone');
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
              aria-label="Начать настройку"
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

            {/* Goal examples as chips */}
            {currentQuestion.examples && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {currentQuestion.examples.map((example, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const label = example.substring(example.indexOf(' ') + 1);
                      const current = answers[currentQuestion.category] || '';
                      const newVal = current ? `${current}, ${label.toLowerCase()}` : label;
                      handleAnswer(newVal);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                      theme === 'light'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                        : 'bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20'
                    }`}
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}

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
                onClick={startRecording}
                disabled={isProcessingVoice}
                aria-label={isRecording ? 'Остановить запись' : 'Голосовой ввод'}
                className={`w-full h-14 text-base transition-all ${
                  isProcessingVoice
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isRecording
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
                }`}
              >
                {isProcessingVoice ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {userLang === 'ru' ? 'Обработка...' : 'Processing...'}
                  </>
                ) : isRecording ? (
                  <>
                    <Mic className="w-5 h-5 mr-2 animate-pulse" />
                    {userLang === 'ru' ? 'Слушаю...' : 'Listening...'}
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2" />
                    {t.voice.record}
                  </>
                )}
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
      }`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
      >
        <div className="max-w-2xl mx-auto">
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            aria-label={currentStep === ONBOARDING_QUESTIONS.length - 1 ? 'Создать квесты' : 'Далее'}
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