import { useRef, useEffect } from 'react';

let globalSpeechRecognition = null;

export function useSpeechRecognition() {
  const recognitionRef = useRef(null);

  // Просто инициализируем SpeechRecognition один раз
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