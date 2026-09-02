import { useState, useEffect } from 'react';

let globalSpeechRecognition = null;

export function useSpeechRecognition() {
  const [recognition, setRecognition] = useState(globalSpeechRecognition);

  useEffect(() => {
    if (!globalSpeechRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        globalSpeechRecognition = new SpeechRecognition();
      }
    }
    if (globalSpeechRecognition && !recognition) {
      setRecognition(globalSpeechRecognition);
    }
  }, []);

  return { recognition };
}