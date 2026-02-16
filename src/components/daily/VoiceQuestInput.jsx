import React, { useState } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function VoiceQuestInput({ onQuestSuggestion, theme = 'dark' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Голосовой ввод не поддерживается в этом браузере');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info('Слушаю...', { duration: 1000 });
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    };

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      setIsProcessing(true);
      
      toast.info('AI анализирует...', { duration: 2000 });

      try {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Ты - ассистент для трекера задач и достижений. Пользователь сказал: "${transcript}"

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
          userInput: transcript
        });
        toast.success('AI обработал сообщение! 🎯');
        
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
      } catch (error) {
        console.error('Error processing voice input:', error);
        toast.error(`Ошибка: ${error.message || 'Не удалось обработать'}`);
      } finally {
        setIsProcessing(false);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      setIsProcessing(false);
      toast.error('Ошибка распознавания речи');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  return (
    <div className="px-5 mb-4">
      <Button
        onClick={handleVoiceInput}
        disabled={isRecording || isProcessing}
        className={`w-full h-12 rounded-2xl font-medium transition-all ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : isProcessing
            ? 'bg-gray-500'
            : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            AI обрабатывает...
          </>
        ) : isRecording ? (
          <>
            <Mic className="w-5 h-5 mr-2 animate-pulse" />
            Слушаю...
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