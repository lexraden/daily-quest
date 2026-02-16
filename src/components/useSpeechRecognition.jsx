import { useRef, useEffect } from 'react';

let globalSpeechRecognition = null;

export function useSpeechRecognition() {
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!globalSpeechRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        globalSpeechRecognition = new SpeechRecognition();
      }
    }
    recognitionRef.current = globalSpeechRecognition;
  }, []);

  return { recognition: recognitionRef.current };
}