import { useRef, useEffect, useState } from 'react';

// Глобальное кэширование для микрофона
let globalSpeechRecognition = null;
let microphoneInitialized = false;
let microphonePermissionGranted = false;

export function useSpeechRecognition() {
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef(null);

  // Инициализация микрофона один раз при монтировании приложения
  useEffect(() => {
    const initMicrophone = async () => {
      if (microphoneInitialized) {
        recognitionRef.current = globalSpeechRecognition;
        setIsSupported(!!globalSpeechRecognition);
        return;
      }

      // Проверяем поддержку SpeechRecognition
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        setIsSupported(false);
        microphoneInitialized = true;
        return;
      }

      // Проверяем кэшированное разрешение
      const cachedPermission = localStorage.getItem('microphonePermissionGranted');
      if (cachedPermission === 'true') {
        microphonePermissionGranted = true;
      }

      // Инициализируем SpeechRecognition один раз
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      globalSpeechRecognition = new SpeechRecognition();
      recognitionRef.current = globalSpeechRecognition;

      // Если разрешение уже было дано, не запрашиваем заново
      if (!microphonePermissionGranted) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          microphonePermissionGranted = true;
          localStorage.setItem('microphonePermissionGranted', 'true');
        } catch (error) {
          console.log('Microphone permission denied:', error);
        }
      }

      microphoneInitialized = true;
      setIsSupported(true);
    };

    initMicrophone();
  }, []);

  return {
    recognition: recognitionRef.current,
    isSupported,
    permissionGranted: microphonePermissionGranted
  };
}