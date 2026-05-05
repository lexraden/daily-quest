import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/components/useSpeechRecognition';
import CaloriePhotoInput from './CaloriePhotoInput';
import { t, getLang, getSpeechLang } from '@/lib/i18n';

const VoiceQuestInput = React.memo(function VoiceQuestInput({ onQuestSuggestion, onMealAnalyzed, theme = 'dark', questData, hasAccess = true, onLocked }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoState, setPhotoState] = useState({ hasPhotos: false, isAnalyzing: false });
  const { recognition } = useSpeechRecognition();
  const accumulatedTextRef = useRef('');
  const silenceTimerRef = useRef(null);
  const SILENCE_TIMEOUT = 2500; // 2.5 seconds of silence before sending

  useEffect(() => {
    if (!recognition) return;

    recognition.lang = getSpeechLang();
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
        toast.error(t().voice.micPermission);
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
    if (!hasAccess) {
      onLocked?.();
      return;
    }
    if (!recognition) {
      toast.error(t().voice.notSupported);
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
      toast.error(t().voice.micFailed);
    }
  }, [recognition, isRecording, isProcessing]);

  const analyzeMealFromText = async (text) => {
    const isRu = getLang() === 'ru';
    const prompt = isRu
      ? `Ты — эксперт-нутрициолог. Пользователь рассказал, что он съел/выпил: "${text}"

Оцени калорийность и нутриенты этого приёма пищи. Если порция не указана — прикинь среднюю/стандартную.
Будь реалистичен в оценках.

ВАЖНО: Поле meal_name должно быть СТРОГО на РУССКОМ языке, кратко (например: "Шаверма с курицей 500г").`
      : `You are an expert nutritionist. The user described what they ate/drank: "${text}"

Estimate the calories and nutrients of this meal. If the portion is not specified — assume an average/standard portion.
Be realistic in your estimates.

IMPORTANT: The meal_name field MUST be STRICTLY in ENGLISH, short (e.g.: "Chicken shawarma 500g").`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          meal_name: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          fat: { type: "number" },
          carbs: { type: "number" }
        },
        required: ["meal_name", "calories", "protein", "fat", "carbs"]
      },
      model: "gemini_3_flash"
    });

    onMealAnalyzed({
      meal_name: result.meal_name,
      calories: result.calories,
      protein: result.protein,
      fat: result.fat,
      carbs: result.carbs,
      photo_urls: [],
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString()
    });
  };

  const processVoiceInput = async (text) => {
    setIsProcessing(true);

    try {
      const lang = getLang();
      const isRu = lang === 'ru';

      // Build existing quests list for better matching
      const existingQuestsList = questData ? Object.entries(questData).map(([cat, quests]) =>
        `${cat}: ${quests.map(q => `"${q.emoji} ${q.name}" (level ${q.level})`).join(', ')}`
      ).join('\n') : '';

      const prompt = isRu
        ? `Ты - ассистент для трекера задач и достижений. Пользователь сказал: "${text}"

      Вот существующие квесты пользователя:
      ${existingQuestsList}

      Определи, что именно хочет пользователь:
      1. COMPLETED_QUEST - сообщает о выполнении какого-то квеста/задачи
      2. ADD_QUEST - хочет добавить новый квест в трекер
      3. DELETE_QUEST - хочет удалить существующий квест
      4. EDIT_QUEST - хочет изменить/переименовать существующий квест
      5. MEAL_LOG - сообщает о приёме пищи (что-то съел, выпил, перекусил). Например: "съел шаверму с курицей 500 грамм", "выпил кофе с молоком", "обед: борщ и хлеб"
      6. JOURNAL - просто делится заметкой/мыслями о дне

      Для DELETE_QUEST, EDIT_QUEST и COMPLETED_QUEST:
      - ОБЯЗАТЕЛЬНО найди ТОЧНОЕ совпадение с существующим квестом из списка выше
      - В поле "name" укажи ТОЧНОЕ название существующего квеста (как оно написано в списке)
      - В поле "emoji" укажи ТОЧНЫЙ эмодзи существующего квеста
      - В поле "level" укажи ТОЧНЫЙ уровень существующего квеста
      - В поле "category" укажи ТОЧНУЮ категорию существующего квеста

      Для EDIT_QUEST дополнительно:
      - В поле "old_name" укажи ТОЧНОЕ старое название квеста
      - В поле "name" укажи НОВОЕ название

      Для ADD_QUEST и JOURNAL:
      - Подбери подходящую категорию, эмодзи и краткое описание

      Дружелюбное сообщение для пользователя.

      ВАЖНО: Все ответы (name, description, message) должны быть на РУССКОМ языке.
      Верни результат в JSON формате.`
        : `You are an assistant for a daily quest and achievement tracker. The user said: "${text}"

      Here are the user's existing quests:
      ${existingQuestsList}

      Determine what the user wants:
      1. COMPLETED_QUEST - reporting completion of a quest/task
      2. ADD_QUEST - wants to add a new quest to the tracker
      3. DELETE_QUEST - wants to delete an existing quest
      4. EDIT_QUEST - wants to change/rename an existing quest
      5. MEAL_LOG - reporting a meal/food/drink intake. Example: "ate chicken shawarma 500g", "had coffee with milk", "lunch: borscht and bread"
      6. JOURNAL - just sharing a note/thought about the day

      For DELETE_QUEST, EDIT_QUEST and COMPLETED_QUEST:
      - You MUST find an EXACT match from the existing quests list above
      - In "name" field put the EXACT name of the existing quest (as written in the list)
      - In "emoji" field put the EXACT emoji of the existing quest
      - In "level" field put the EXACT level of the existing quest
      - In "category" field put the EXACT category of the existing quest

      For EDIT_QUEST additionally:
      - In "old_name" put the EXACT old quest name
      - In "name" put the NEW name

      For ADD_QUEST and JOURNAL:
      - Pick appropriate category, emoji and short description

      Friendly message for the user.

      IMPORTANT: All responses (name, description, message) MUST be in ENGLISH.
      Return the result in JSON format.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["COMPLETED_QUEST", "ADD_QUEST", "DELETE_QUEST", "EDIT_QUEST", "MEAL_LOG", "JOURNAL"]
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

      // If user described a meal — analyze it as nutrition (same workflow as photo)
      if (result.intent === 'MEAL_LOG') {
        await analyzeMealFromText(text);
        if (navigator.vibrate) navigator.vibrate(50);
        return;
      }

      onQuestSuggestion({
        ...result,
        userInput: text
      });
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast.error(t().voice.processError);
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
            {t().common.processing}
          </span>
        </div>
      </div>
    );
  }

  // Hide Voice button when user is working with photos (selected or analyzing)
  const hideVoice = photoState.hasPhotos || photoState.isAnalyzing;

  return (
    <div className="px-5 mb-4">
      <div className="flex gap-2">
        {!hideVoice && (
          <Button
            onClick={startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? t().voice.listening : t().voice.voiceInput}
            className={`h-12 rounded-2xl font-medium transition-all flex-1 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
            }`}
          >
            {isRecording ? (
              <>
                <Mic className="w-5 h-5 mr-2 animate-pulse" />
                {t().voice.listening}
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                {t().voice.voice}
              </>
            )}
          </Button>
        )}
        <div className={hideVoice ? 'flex-1' : ''}>
          <CaloriePhotoInput
            onMealAnalyzed={onMealAnalyzed}
            onStateChange={setPhotoState}
            theme={theme}
            hasAccess={hasAccess}
            onLocked={onLocked}
          />
        </div>
      </div>
    </div>
  );
});

export default VoiceQuestInput;