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
    
    try {
      // Upload audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice.webm');
      
      const uploadResult = await base44.integrations.Core.UploadFile({
        file: audioBlob
      });

      // Use LLM to transcribe and generate quest
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Пользователь записал голосовое сообщение о новом квесте или задаче, которую он хочет добавить в свой ежедневный трекер.
        
Проанализируй аудио и определи:
1. Что именно пользователь хочет сделать (добавить новый квест, изменить существующий, заменить)
2. О какой сфере жизни идет речь: здоровье (health), разум/обучение (mind), работа (work), финансы (money), любовь/семья (love), друзья (friends)
3. Придумай краткое название квеста (максимум 25 символов)
4. Подбери подходящий эмодзи

Верни результат в JSON формате.`,
        file_urls: [uploadResult.file_url],
        response_json_schema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["health", "mind", "work", "money", "love", "friends"]
            },
            emoji: { type: "string" },
            name: { type: "string" },
            level: { type: "number" },
            action: { 
              type: "string",
              enum: ["add", "replace", "edit"]
            },
            message: { type: "string" }
          },
          required: ["category", "emoji", "name", "action", "message"]
        }
      });

      onQuestSuggestion(result);
      toast.success('Квест готов! 🎯');
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast.error('Не удалось обработать голосовое сообщение');
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