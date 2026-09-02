import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
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
    // The nutritionist prompt lives on the server now.
    const result = await api.ai.mealFromText(text, getLang());

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
      // The intent prompt is server-side; the client sends the transcript and
      // its current quests so the model can match against them by exact name.
      const result = await api.ai.voiceIntent(text, questData, getLang());

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