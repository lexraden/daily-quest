import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/components/useSpeechRecognition';
import CaloriePhotoInput from './CaloriePhotoInput';
import { t, getLang, getSpeechLang } from '@/lib/i18n';
import { todayKey } from '@/lib/dates';
import { aiErrorMessage } from '@/lib/aiErrors';

/**
 * How long one dictation may run before it is sent anyway.
 *
 * Not a guess about how much anyone says: a recogniser left open holds the
 * microphone, and a button that was tapped by accident in a pocket would
 * otherwise sit there until the tab was closed. Five minutes is far past a
 * real sentence and well short of a problem.
 */
const MAX_RECORDING_MS = 5 * 60 * 1000;

const mmss = (ms) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const VoiceQuestInput = React.memo(function VoiceQuestInput({ onQuestSuggestion, onMealAnalyzed, theme = 'dark', questData, hasAccess = true, onLocked }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [photoState, setPhotoState] = useState({ hasPhotos: false, isAnalyzing: false });
  const { recognition } = useSpeechRecognition();

  /**
   * Recording now ends when the user says so, not when they pause.
   *
   * It used to stop after 2.5 seconds of silence, which made thinking
   * mid-sentence indistinguishable from being finished: half a thought was
   * sent and the rest was typed into a recogniser that had already closed.
   *
   * That turns the browser's own behaviour into a problem to solve. Chrome
   * ends a recognition session on its own after a pause whatever `continuous`
   * says, so `onend` arrives for two completely different reasons — the user
   * asked, or the browser gave up. `stoppingRef` is what tells them apart: it
   * is set only by a deliberate stop, and any other `onend` restarts the
   * session and keeps going.
   *
   * Restarting means the transcript arrives in pieces, hence two refs: what
   * previous sessions produced, and what this one has so far. `event.results`
   * is rebuilt from scratch by each new session, so keeping one string would
   * lose everything said before the last pause.
   */
  const stoppingRef = useRef(false);
  const committedRef = useRef('');
  const sessionRef = useRef('');
  const startedAtRef = useRef(0);
  const tickRef = useRef(null);

  /**
   * The handlers below are wired once per recogniser, so anything they call
   * directly is frozen at that moment — including `questData`, which the
   * intent call sends so the model can match against the quests by name.
   *
   * That was survivable when a recording lasted a sentence. It is not now that
   * one can run for five minutes, during which quests are completed, added and
   * regenerated: the transcript would be matched against the set as it was
   * before the user started talking. The ref is re-pointed on every render, so
   * `onend` calls the current one.
   */
  const processRef = useRef(null);

  const fullTranscript = () => `${committedRef.current} ${sessionRef.current}`.trim();

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  /** Ends the session for good, as opposed to the browser ending one of them. */
  const stopRecording = useCallback(() => {
    stoppingRef.current = true;
    try {
      recognition?.stop();
    } catch {
      // Already stopped, or never started. `onend` has run or will not.
    }
  }, [recognition]);

  useEffect(() => {
    if (!recognition) return undefined;

    recognition.lang = getSpeechLang();
    recognition.continuous = true;
    recognition.interimResults = false;

    const handleStart = () => {
      setIsRecording(true);
      if (navigator.vibrate) navigator.vibrate(30);
    };

    const handleResult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += `${event.results[i][0].transcript} `;
      }
      sessionRef.current = transcript.trim();
    };

    const handleEnd = () => {
      // Whatever this session heard belongs to the transcript either way.
      committedRef.current = fullTranscript();
      sessionRef.current = '';

      const overrun = Date.now() - startedAtRef.current >= MAX_RECORDING_MS;

      if (!stoppingRef.current && !overrun) {
        // The browser gave up on its own. Carry on where it left off.
        try {
          recognition.start();
          return;
        } catch {
          // It refused to restart; fall through and send what we have.
        }
      }

      stoppingRef.current = false;
      clearTick();
      setIsRecording(false);
      setElapsed(0);

      const finalText = committedRef.current.trim();
      committedRef.current = '';
      if (finalText) processRef.current?.(finalText);
    };

    const handleError = (event) => {
      // A pause long enough to count as silence is not an error worth ending
      // on — `onend` follows this and will restart the session.
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error(t().voice.micPermission);
      } else {
        console.error('Speech error:', event.error);
      }

      // Anything else is final: stop rather than restart into the same failure.
      stoppingRef.current = true;
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
      clearTick();
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

    stoppingRef.current = false;
    committedRef.current = '';
    sessionRef.current = '';
    startedAtRef.current = Date.now();
    setElapsed(0);

    /**
     * One timer drives both the readout and the cap. Checking the clock here
     * rather than with a separate timeout means a phone that suspended the tab
     * mid-recording notices on the next tick instead of running past the limit.
     */
    clearTick();
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) stopRecording();
    }, 250);

    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      clearTick();
      toast.error(t().voice.micFailed);
    }
  }, [recognition, isRecording, isProcessing, hasAccess, onLocked, stopRecording]);

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
      date: todayKey(),
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
      toast.error(aiErrorMessage(error, t().voice.processError));
    } finally {
      setIsProcessing(false);
    }
  };

  processRef.current = processVoiceInput;

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
            /* One button, two jobs: start, then stop and send. A separate stop
               control would be dead weight whenever nothing is recording. */
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            aria-label={isRecording ? t().voice.tapToStop : t().voice.voiceInput}
            className={`h-12 rounded-2xl font-medium transition-all flex-1 ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 mr-2" fill="currentColor" />
                {t().voice.tapToStop}
                {/* The clock is what says it is still running: the label alone
                    looks the same at one second and at four minutes. */}
                <span className="ml-2 font-mono text-sm tabular-nums opacity-90">
                  {mmss(elapsed)}
                </span>
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