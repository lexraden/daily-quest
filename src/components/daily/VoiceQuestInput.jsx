import React, { useState, useRef } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/components/useSpeechRecognition';

export default function VoiceQuestInput({ onQuestSuggestion, theme = 'dark' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const { recognition } = useSpeechRecognition();
  const isStoppingRef = useRef(false);
  const accumulatedTextRef = useRef('');
  const permissionAskedRef = useRef(false);

  const requestMicrophonePermission = async () => {
    try {
      const cachedPermission = localStorage.getItem('voicePermissionGranted');
      if (cachedPermission === 'true') {
        return true;
      }

      await navigator.mediaDevices.getUserMedia({ audio: true });
      localStorage.setItem('voicePermissionGranted', 'true');
      permissionAskedRef.current = true;
      return true;
    } catch (error) {
      console.log('Microphone permission denied:', error);
      toast.error('Доступ к микрофону запрещен. Проверьте настройки браузера.');
      return false;
    }
  };

  const startRecording = async () => {
    if (!recognition) {
      toast.error('Голосовой ввод не поддерживается');
      return;
    }

    // Запрашиваем разрешение один раз
    if (!permissionAskedRef.current) {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }

    isStoppingRef.current = false;
    accumulatedTextRef.current = '';

    // Настройки для русского языка
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

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
      setIsRecording(false);
      // Обработка после остановки
      const finalText = accumulatedTextRef.current.trim();
      if (finalText) {
        processVoiceInput(finalText);
      }
    };

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
      setTranscript('');
      setIsProcessing(false);
      
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      setIsProcessing(false);
      console.error('Error processing voice input:', error);
      toast.error('Ошибка обработки');
    }
  };

  if (isRecording || transcript) {
    return (
      <div className="px-5 mb-4 space-y-2">
        {transcript && (
          <div className={`p-3 rounded-2xl text-sm ${
            theme === 'light'
              ? 'bg-purple-100 text-purple-900'
              : 'bg-purple-500/20 text-purple-200'
          }`}>
            {transcript}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={stopRecording}
            className="flex-1 h-12 bg-red-500 hover:bg-red-600"
          >
            <Square className="w-4 h-4 mr-2" />
            {isProcessing ? 'Отправляю...' : 'Отправить'}
          </Button>
          <Button
            onClick={() => {
              setTranscript('');
              setIsRecording(false);
            }}
            variant="outline"
            className={`flex-1 h-12 ${theme === 'light' ? 'border-gray-300' : 'border-white/10'}`}
          >
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 mb-4">
      <Button
        onClick={startRecording}
        className="w-full h-12 rounded-2xl font-medium bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
      >
        <Mic className="w-5 h-5 mr-2" />
        Голосовой ввод
      </Button>
    </div>
  );
}