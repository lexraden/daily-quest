import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSpeechRecognition } from '@/components/useSpeechRecognition';
import { t, getSpeechLang } from '@/lib/i18n';

/**
 * How long one dictation may run before it is sent anyway.
 *
 * Not a guess about how much anyone says: a recogniser left open holds the
 * microphone, and a button tapped by accident in a pocket would otherwise sit
 * there until the tab was closed. Five minutes is far past a real sentence and
 * well short of a problem.
 */
export const MAX_RECORDING_MS = 5 * 60 * 1000;

export const mmss = (ms) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Tap to start, tap to stop, and the words come back once.
 *
 * Recording ends when the user says so, not when they pause. Chrome ends a
 * recognition session on its own after a pause whatever `continuous` says, so
 * `onend` arrives for two different reasons — the user asked, or the browser
 * gave up. `stopping` is set only by a deliberate stop; any other `onend`
 * restarts the session and keeps going. Restarting means the transcript
 * arrives in pieces, hence what earlier sessions produced (`committed`) and
 * what this one has so far (`session`): `event.results` starts from scratch in
 * each new session.
 *
 * The browser has one recogniser, shared by everything that dictates. So the
 * handlers are attached when a recording starts and removed when it ends, not
 * when a component mounts: two mounted users each wiring it on mount would
 * overwrite each other, and the first to unmount would unwire the other.
 *
 * `onText` is read through a ref at the end, so a five-minute recording is
 * delivered to the handler as it is then, not as it was when it began.
 */
export default function useDictation(onText) {
  const { recognition } = useSpeechRecognition();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stoppingRef = useRef(false);
  const committedRef = useRef('');
  const sessionRef = useRef('');
  const startedAtRef = useRef(0);
  const tickRef = useRef(null);
  const ownsRef = useRef(false);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const release = useCallback(() => {
    if (!recognition || !ownsRef.current) return;
    ownsRef.current = false;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
  }, [recognition]);

  /** Ends the recording for good, as opposed to the browser ending one session. */
  const stop = useCallback(() => {
    stoppingRef.current = true;
    try {
      recognition?.stop();
    } catch {
      // Already stopped, or never started. `onend` has run or will not.
    }
  }, [recognition]);

  const start = useCallback(() => {
    if (!recognition) {
      toast.error(t().voice.notSupported);
      return false;
    }
    if (recording) return false;

    stoppingRef.current = false;
    committedRef.current = '';
    sessionRef.current = '';
    startedAtRef.current = Date.now();
    setElapsed(0);

    const full = () => `${committedRef.current} ${sessionRef.current}`.trim();

    recognition.lang = getSpeechLang();
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setRecording(true);
      if (navigator.vibrate) navigator.vibrate(30);
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += `${event.results[i][0].transcript} `;
      }
      sessionRef.current = transcript.trim();
    };

    recognition.onend = () => {
      // Whatever this session heard belongs to the transcript either way.
      committedRef.current = full();
      sessionRef.current = '';

      const overrun = Date.now() - startedAtRef.current >= MAX_RECORDING_MS;
      if (!stoppingRef.current && !overrun) {
        // The browser gave up on its own. Carry on where it left off.
        try {
          recognition.start();
          return;
        } catch {
          // It refused to restart; fall through and deliver what we have.
        }
      }

      stoppingRef.current = false;
      clearTick();
      setRecording(false);
      setElapsed(0);
      release();

      const text = committedRef.current.trim();
      committedRef.current = '';
      if (text) onTextRef.current?.(text);
    };

    recognition.onerror = (event) => {
      // A pause long enough to count as silence is not worth ending on —
      // `onend` follows and restarts the session.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error(t().voice.micPermission);
      } else {
        console.error('Speech error:', event.error);
      }
      // Anything else is final: stop rather than restart into the same failure.
      stoppingRef.current = true;
    };
    ownsRef.current = true;

    // One timer drives both the readout and the cap, so a phone that suspended
    // the tab notices on the next tick instead of running past the limit.
    clearTick();
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) stop();
    }, 250);

    try {
      recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      clearTick();
      release();
      toast.error(t().voice.micFailed);
      return false;
    }
  }, [recognition, recording, release, stop]);

  // Leaving mid-recording stops it and lets go of the recogniser.
  useEffect(
    () => () => {
      clearTick();
      if (ownsRef.current) {
        stoppingRef.current = true;
        try {
          recognition?.abort();
        } catch {
          // Nothing running.
        }
        release();
      }
    },
    [recognition, release],
  );

  return { recording, elapsed, start, stop, supported: Boolean(recognition) };
}
