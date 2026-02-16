import { useRef, useEffect, useState } from 'react';

let globalSpeechRecognition = null;
let isInitialized = false;

export function useSpeechRecognition() {
  const [recognition, setRecognition] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Если уже инициализировано, используем кэш
    if (isInitialized && globalSpeechRecognition) {
      setRecognition(globalSpeechRecognition);
      setIsSupported(true);
      return;
    }

    const initSpeechRecognition = async () => {
      // Проверяем поддержку браузером
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setIsSupported(false);
        return;
      }

      setIsSupported(true);

      try {
        // Проверяем кэшированное разрешение
        const cachedPermission = localStorage.getItem('speechRecognitionPermission');
        
        if (cachedPermission === 'granted') {
          // Разрешение уже было дано, просто инициализируем
          globalSpeechRecognition = new SpeechRecognition();
        } else {
          // Запрашиваем разрешение
          await navigator.mediaDevices.getUserMedia({ audio: true });
          localStorage.setItem('speechRecognitionPermission', 'granted');
          globalSpeechRecognition = new SpeechRecognition();
        }
        
        setRecognition(globalSpeechRecognition);
        isInitialized = true;
      } catch (error) {
        console.log('Microphone permission denied:', error);
        localStorage.removeItem('speechRecognitionPermission');
      }
    };

    initSpeechRecognition();
  }, []);

  return { recognition, isSupported };
}