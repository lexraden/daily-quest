import React, { useState, useRef } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function VoiceQuestInput({ onQuestSuggestion, theme = 'dark' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const recognitionRef = useRef(null);

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Голосовой ввод не поддерживается в этом браузере');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    // Определение языка браузера
    const userLang = navigator.language || navigator.userLanguage;
    recognition.lang = userLang.startsWith('ru') ? 'ru-RU' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    let fullTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
      fullTranscript = '';
      toast.info('Слушаю...', { duration: 1000 });
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          fullTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      setTranscript(fullTranscript + interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'aborted') {
        setIsRecording(false);
        toast.error('Ошибка распознавания речи');
      }
    };

    recognition.onend = () => {
      // Перезапуск если ещё записываем (автоматические паузы)
      if (isRecording && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Игнорируем ошибки перезапуска
        }
      }
    };

    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      setIsRecording(false);
      recognitionRef.current.stop();
      recognitionRef.current.onend = null; // Отключаем автоперезапуск
      
      if (transcript.trim()) {
        setShowConfirm(true);
      } else {
        toast.error('Ничего не записано');
      }
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setTranscript('');
  };

  const handleSend = async () => {
    setShowConfirm(false);
    toast.info('AI анализирует...', { duration: 2000 });

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Ты - ассистент для трекера задач и достижений. Пользователь сказал: "${transcript.trim()}"

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
        userInput: transcript.trim()
      });
      setTranscript('');
      toast.success('AI обработал сообщение! 🎯');
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast.error(`Ошибка: ${error.message || 'Не удалось обработать'}`);
    }
  };

  if (showConfirm) {
    return (
      <div className="px-5 mb-4 space-y-3">
        <div className={`p-4 rounded-xl border ${
          theme === 'light'
            ? 'bg-white border-gray-200'
            : 'bg-[#1e2836] border-white/10'
        }`}>
          <p className={`text-sm ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>
            {transcript.trim()}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleCancel}
            variant="outline"
            className={`rounded-xl ${
              theme === 'light'
                ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                : 'border-white/10 text-gray-300 hover:bg-white/5'
            }`}
          >
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button
            onClick={handleSend}
            className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 rounded-xl"
          >
            <Send className="w-4 h-4 mr-2" />
            Отправить
          </Button>
        </div>
      </div>
    );
  }

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