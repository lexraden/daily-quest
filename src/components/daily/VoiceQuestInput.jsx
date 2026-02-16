import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function VoiceQuestInput({ onQuestSuggestion, theme = 'dark' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processVoiceInput(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Не удалось получить доступ к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceInput = async (audioBlob) => {
    setIsProcessing(true);
    toast.info('Обрабатываю запись...', { duration: 2000 });
    
    try {
      // Upload audio file
      const uploadResult = await base44.integrations.Core.UploadFile({
        file: audioBlob
      });

      toast.info('Анализирую задачу...', { duration: 3000 });

      // Use LLM to transcribe and analyze intent
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Ты - ассистент для трекера задач и достижений. Пользователь записал голосовое сообщение.

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
        file_urls: [uploadResult.file_url],
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
      onQuestSuggestion(result);
      toast.success('Квест готов! 🎯');
      
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

  return (
    <div className="px-5 mb-4">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
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
            Обработка...
          </>
        ) : isRecording ? (
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