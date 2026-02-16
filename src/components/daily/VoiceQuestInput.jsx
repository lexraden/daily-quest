import React, { useState, useRef } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function VoiceQuestInput({ onQuestSuggestion, theme = 'dark' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const isStoppingRef = useRef(false);
  const accumulatedTextRef = useRef('');

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Голосовой ввод не поддерживается');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    isStoppingRef.current = false;
    accumulatedTextRef.current = '';

    // Автоопределение языка
    const userLang = navigator.language || navigator.userLanguage;
    recognition.lang = userLang.startsWith('ru') ? 'ru-RU' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
      accumulatedTextRef.current = '';
      toast.info('Говорите...', { duration: 1000 });
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    };

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript;
      accumulatedTextRef.current = result;
      setTranscript(result);
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
        // Автоперезапуск для продолжения записи
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.log('Restart failed');
        }
      } else {
        setIsRecording(false);
        // Обработка после остановки
        const finalText = accumulatedTextRef.current.trim();
        if (finalText) {
          processVoiceInput(finalText);
        } else {
          toast.error('Ничего не записано');
        }
      }
    };

    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      isStoppingRef.current = true;
      recognitionRef.current.stop();
    }
  };

  const processVoiceInput = async (text) => {
    toast.info('AI анализирует...', { duration: 2000 });

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

      console.log('AI Response:', result);
      onQuestSuggestion({
        ...result,
        userInput: text
      });
      setTranscript('');
      toast.dismiss();
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast.error(`Ошибка: ${error.message || 'Не удалось обработать'}`);
    }
  };

  return (
    <div className="px-5 mb-4">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-full h-12 rounded-2xl font-medium transition-all ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
        }`}
      >
        {isRecording ? (
          <>
            <Square className="w-5 h-5 mr-2" />
            Остановить запись
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 mr-2" />
            Добавить квест голосом
          </>
        )}
      </Button>
    </div>
  );
}