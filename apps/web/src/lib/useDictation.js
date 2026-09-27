import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { useSpeechRecognition } from '@/components/useSpeechRecognition';
import { t, getSpeechLang } from '@/lib/i18n';
import { aiErrorMessage } from '@/lib/aiErrors';

/**
 * How long one dictation may run before it is sent anyway.
 *
 * Not a guess about how much anyone says: an open microphone is held for as
 * long as it runs, and a button tapped by accident in a pocket would otherwise
 * sit there until the tab was closed. Five minutes is far past a real sentence
 * and well short of a problem.
 */
export const MAX_RECORDING_MS = 5 * 60 * 1000;

export const mmss = (ms) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** The container this browser records in, preferring what OpenAI reads best. */
function recorderType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) =>
    MediaRecorder.isTypeSupported(type),
  ) || '';
}

const canRecord = () =>
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Tap to start, tap to stop, and the words come back once — in whatever
 * language they were said.
 *
 * The browser's own recogniser listens for exactly one language, and it had
 * to be the app's: Russian said into an app set to English came back as
 * nonsense, and a sentence mixing the two lost half of itself. So the audio
 * is recorded here and transcribed on the server, which detects the language.
 * `transcribing` covers the few seconds that takes.
 *
 * Where recording is not available the browser's recogniser is still used,
 * as before, in the app's language. That path restarts the recogniser when
 * Chrome ends a session on a pause — `stopping` tells a deliberate stop from
 * the browser giving up — and attaches its handlers only while it runs,
 * because the browser has one recogniser shared by everything that dictates.
 *
 * `onText` is read through a ref at the end, so a five-minute recording is
 * delivered to the handler as it is then, not as it was when it began.
 */
export default function useDictation(onText) {
  const { recognition } = useSpeechRecognition();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const startedAtRef = useRef(0);
  const tickRef = useRef(null);
  const aliveRef = useRef(true);
  // Recorder path.
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  // Recogniser path.
  const stoppingRef = useRef(false);
  const committedRef = useRef('');
  const sessionRef = useRef('');
  const ownsRef = useRef(false);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const startTick = (stopFn) => {
    startedAtRef.current = Date.now();
    setElapsed(0);
    clearTick();
    // One timer drives both the readout and the cap, so a phone that suspended
    // the tab notices on the next tick instead of running past the limit.
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) stopFn();
    }, 250);
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const release = useCallback(() => {
    if (!recognition || !ownsRef.current) return;
    ownsRef.current = false;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
  }, [recognition]);

  /** Ends the recording for good. */
  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      if (recorder.state !== 'inactive') recorder.stop();
      return;
    }
    stoppingRef.current = true;
    try {
      recognition?.stop();
    } catch {
      // Already stopped, or never started. `onend` has run or will not.
    }
  }, [recognition]);

  const transcribe = async (blob) => {
    setTranscribing(true);
    try {
      const { text } = await api.ai.transcribe(blob);
      if (!aliveRef.current) return;
      if (text) onTextRef.current?.(text);
      else toast(t().voice?.nothingHeard || 'Nothing was heard — try again a little closer');
    } catch (error) {
      if (aliveRef.current) toast.error(aiErrorMessage(error, t().voice.processError));
    } finally {
      if (aliveRef.current) setTranscribing(false);
    }
  };

  const startRecorder = async () => {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      toast.error(
        error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
          ? t().voice.micPermission
          : t().voice.micFailed,
      );
      return false;
    }
    streamRef.current = stream;

    const type = recorderType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    } catch {
      releaseStream();
      toast.error(t().voice.micFailed);
      return false;
    }

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      recorderRef.current = null;
      releaseStream();
      clearTick();
      setRecording(false);
      setElapsed(0);
      if (!aliveRef.current) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' });
      // Under half a second is a tap, not something said.
      if (blob.size > 0 && Date.now() - startedAtRef.current > 500) transcribe(blob);
    };

    recorderRef.current = recorder;
    // A slice a second, so what was said survives a recorder that stops abruptly.
    recorder.start(1000);
    setRecording(true);
    if (navigator.vibrate) navigator.vibrate(30);
    startTick(stop);
    return true;
  };

  const startRecognition = () => {
    if (!recognition) {
      toast.error(t().voice.notSupported);
      return false;
    }

    stoppingRef.current = false;
    committedRef.current = '';
    sessionRef.current = '';
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
      // A pause long enough to count as silence is not worth ending on.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error(t().voice.micPermission);
      } else {
        console.error('Speech error:', event.error);
      }
      stoppingRef.current = true;
    };
    ownsRef.current = true;

    startTick(stop);
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
  };

  const start = useCallback(() => {
    if (recording || transcribing || recorderRef.current) return false;
    if (canRecord()) {
      startRecorder();
      return true;
    }
    return startRecognition();
    // startRecorder and startRecognition read refs and the current recogniser.
  }, [recording, transcribing, recognition, release, stop]);

  // Leaving mid-recording stops it and lets go of the microphone.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTick();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      releaseStream();
      if (ownsRef.current) {
        stoppingRef.current = true;
        try {
          recognition?.abort();
        } catch {
          // Nothing running.
        }
        release();
      }
    };
  }, [recognition, release]);

  return {
    recording,
    transcribing,
    elapsed,
    start,
    stop,
    supported: canRecord() || Boolean(recognition),
  };
}
