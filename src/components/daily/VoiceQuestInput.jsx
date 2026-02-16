import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/components/useSpeechRecognition';

export default function VoiceQuestInput({ onQuestSuggestion, theme = 'dark' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { recognition } = useSpeechRecognition();
  const isStoppingRef = useRef(false);
  const accumulatedTextRef = useRef('');

  useEffect(() => {
    if (!recognition) return;

    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const handleStart = () => {
      setIsRecording(true);
      accumulatedTextRef.current = '';
      toast.info('Говорите...', { duration: 1000 });
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    };

    const handleResult = (event) => {
      const result = event.results[0][0].transcript;
      accumulatedTextRef.current = result;
    };

    const handleError = (event) => {
      console.error('Speech error:', event.error);
      setIsRecording(false);
      if (event.error !== 'aborted') {
        toast.error('Ошибка распознавания');
      }
    };

    const handleEnd = () => {
      setIsRecording(false);
      const finalText = accumulatedTextRef.current.trim();
      if (finalText && !isStoppingRef.current) {
        processVoiceInput(finalText);
      }
    };

    recognition.onstart = handleStart;
    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, [recognition]);

  const startRecording = () => {
    if (!recognition) {
      toast.error('Голосовой ввод не поддерживается');
      return;
    }

    isStoppingRef.current = false;
    accumulatedTextRef.current = '';

    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Ошибка при запуске микрофона');
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      isStoppingRef.current = true;
      recognition.stop();
    }
  };

  const processVoiceInput = async (text) => {
    setIsProcessing(true);

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Ты - ассистент для трекера задач и достижений. Пользователь сказал: "${text}"

Определи, что именно хочет пользователь:
1. COMPLETED_QUEST - сообщает о выполнении какого-то квеста/задачи (например: "я сегодня пробежал 5 км", "закончил проект", "помедитировал")
2. ADD_QUEST - хочет добавить новый квест в трекер (например: "добавь квест пробежать 5 км", "хочу добавить медитацию")
3. JOURNAL - просто делится заметкой/мыслями о дне (например: "сегодня был хороший день", "устал на работе")

Для каждого типа действия определи:
- Категория: health (здоровье/спорт), mind (обучение/медитация), work (работа/проекты), money (финансы/инвестиции), love (семья/отношения), friends (друзья/общение)
- Краткое описание (до 30 символов для квеста)
- Подходящий эмодзи
- Дружелюбное сообщение для пользователя

Верни результат в JSON формате.`,
        response_json_schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["COMPLETED_QUEST", "ADD_QUEST", "JOURNAL"]
            },
            category: {
              type: "string",
              enum: ["health", "mind", "work", "money", "love", "friends"]
            },
            emoji: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            level: { type: "number" },
            action: { 
              type: "string",
              enum: ["add", "replace", "edit", "complete", "journal"]
            },
            message: { type: "string" }
          },
          required: ["intent", "category", "emoji", "name", "action", "message"]
        }
      });

      onQuestSuggestion({
        ...result,
        userInput: text
      });
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast.error('Ошибка обработки');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="px-5 mb-4">
        <div className={`w-full h-12 rounded-2xl flex items-center justify-center gap-3 ${
          theme === 'light'
            ? 'bg-gradient-to-r from-purple-100 to-cyan-100'
            : 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20'
        }`}>
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className={`text-sm font-medium ${theme === 'light' ? 'text-purple-700' : 'text-purple-300'}`}>
            Обрабатываю...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 mb-4">
      <Button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        className={`w-full h-12 rounded-2xl font-medium transition-all ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
        }`}
      >
        {isRecording ? (
          <>
            <Mic className="w-5 h-5 mr-2 animate-pulse" />
            Говорите...
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 mr-2" />
            Голосовой ввод
          </>
        )}
      </Button>
    </div>
  );
}