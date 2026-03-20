import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/components/useSpeechRecognition';
import CaloriePhotoInput from './CaloriePhotoInput';

const VoiceQuestInput = React.memo(function VoiceQuestInput({ onQuestSuggestion, onMealAnalyzed, theme = 'dark' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { recognition } = useSpeechRecognition();
  const accumulatedTextRef = useRef('');
  const silenceTimerRef = useRef(null);
  const SILENCE_TIMEOUT = 2500; // 2.5 seconds of silence before sending

  useEffect(() => {
    if (!recognition) return;

    recognition.lang = 'ru-RU';
    recognition.continuous = true;
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

      // Reset silence timer on each new result
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // 2.5s of silence — stop and send
        try { recognition.stop(); } catch (e) {}
      }, SILENCE_TIMEOUT);
    };

    const handleEnd = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setIsRecording(false);
      const finalText = accumulatedTextRef.current.trim();
      if (finalText) {
        processVoiceInput(finalText);
      }
    };

    const handleError = (event) => {
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error('Разрешите доступ к микрофону');
        setIsRecording(false);
      } else if (event.error === 'no-speech') {
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
  }, [recognition]);

  const startRecording = useCallback(() => {
    if (!recognition) {
      toast.error('Голосовой ввод не поддерживается');
      return;
    }
    if (isRecording || isProcessing) return;

    accumulatedTextRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Не удалось запустить микрофон');
    }
  }, [recognition, isRecording, isProcessing]);

  const processVoiceInput = async (text) => {
    setIsProcessing(true);

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Ты - ассистент для трекера задач и достижений. Пользователь сказал: "${text}"

      Определи, что именно хочет пользователь:
      1. COMPLETED_QUEST - сообщает о выполнении какого-то квеста/задачи (например: "я сегодня пробежал 5 км", "закончил проект", "помедитировал")
      2. ADD_QUEST - хочет добавить новый квест в трекер (например: "добавь квест пробежать 5 км", "хочу добавить медитацию")
      3. DELETE_QUEST - хочет удалить существующий квест (например: "удали квест про бег", "убери медитацию", "удалить задачу про чтение")
      4. EDIT_QUEST - хочет изменить/переименовать существующий квест (например: "измени квест бег на плавание", "переименуй медитацию в йогу", "замени квест про чтение на изучение языка")
      5. JOURNAL - просто делится заметкой/мыслями о дне (например: "сегодня был хороший день", "устал на работе")

      Для каждого типа действия определи:
      - Категория: health (здоровье/спорт), mind (обучение/медитация), work (работа/проекты), money (финансы/инвестиции), love (семья/отношения), friends (друзья/общение)
      - Краткое описание (до 30 символов для квеста)
      - Подходящий эмодзи
      - Дружелюбное сообщение для пользователя
      - Для DELETE_QUEST: определи, какой именно квест пользователь хочет удалить (уровень 1, 2 или 3)
      - Для EDIT_QUEST: в поле "name" укажи НОВОЕ название квеста, в поле "old_name" укажи СТАРОЕ название квеста которое нужно заменить, в поле "level" укажи уровень квеста который нужно изменить

      Верни результат в JSON формате.`,
        response_json_schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["COMPLETED_QUEST", "ADD_QUEST", "DELETE_QUEST", "EDIT_QUEST", "JOURNAL"]
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
            message: { type: "string" },
            old_name: { type: "string" }
          },
          required: ["intent", "category", "emoji", "name", "action", "message"]
        }
      });

      onQuestSuggestion({
        ...result,
        userInput: text
      });
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
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
      <div className="flex gap-2">
        <Button
          onClick={startRecording}
          disabled={isProcessing}
          aria-label={isRecording ? 'Остановить запись' : 'Голосовой ввод'}
          className={`h-12 rounded-2xl font-medium transition-all flex-1 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
          }`}
        >
          {isRecording ? (
            <>
              <Mic className="w-5 h-5 mr-2 animate-pulse" />
              Слушаю...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 mr-2" />
              Голос
            </>
          )}
        </Button>
        <CaloriePhotoInput onMealAnalyzed={onMealAnalyzed} theme={theme} />
      </div>
    </div>
  );
});

export default VoiceQuestInput;