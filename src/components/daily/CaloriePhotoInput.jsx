import React, { useState, useRef } from 'react';
import { Camera, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function CaloriePhotoInput({ onMealAnalyzed, theme = 'dark' }) {
  const [photos, setPhotos] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newPhotos = files.slice(0, 2 - photos.length).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setPhotos(prev => [...prev, ...newPhotos].slice(0, 2));
    e.target.value = '';
  };

  const removePhoto = (index) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const analyzeMeal = async () => {
    if (photos.length === 0) return;
    setIsAnalyzing(true);

    try {
      // Upload photos
      const uploadedUrls = [];
      for (const photo of photos) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: photo.file });
        uploadedUrls.push(file_url);
      }

      // Analyze with AI
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Ты — эксперт-нутрициолог. Проанализируй фото еды и определи:
1. Что это за блюдо/продукты (название)
2. Примерную порцию
3. Калорийность (ккал)
4. Белки (г)
5. Жиры (г)
6. Углеводы (г)

Если на фото несколько блюд — суммируй всё вместе.
Будь реалистичен в оценках. Если не можешь точно определить — дай наиболее вероятную оценку.
Название блюда — коротко, до 40 символов.`,
        file_urls: uploadedUrls,
        response_json_schema: {
          type: "object",
          properties: {
            meal_name: { type: "string" },
            calories: { type: "number" },
            protein: { type: "number" },
            fat: { type: "number" },
            carbs: { type: "number" },
            description: { type: "string" }
          },
          required: ["meal_name", "calories", "protein", "fat", "carbs"]
        },
        model: "gemini_3_flash"
      });

      onMealAnalyzed({
        ...result,
        photo_urls: uploadedUrls,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0]
      });

      // Cleanup
      photos.forEach(p => URL.revokeObjectURL(p.preview));
      setPhotos([]);

      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error analyzing meal:', error);
      toast.error('Ошибка анализа фото');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isAnalyzing) {
    return (
      <div className={`h-12 rounded-2xl flex items-center justify-center gap-3 ${
        theme === 'light'
          ? 'bg-gradient-to-r from-orange-100 to-yellow-100'
          : 'bg-gradient-to-r from-orange-500/20 to-yellow-500/20'
      }`}>
        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
        <span className={`text-sm font-medium ${theme === 'light' ? 'text-orange-700' : 'text-orange-300'}`}>
          Анализирую еду...
        </span>
      </div>
    );
  }

  // No photos — show button
  if (photos.length === 0) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          size="icon"
          aria-label="Сфотографировать еду"
          className={`h-12 w-12 rounded-2xl flex-shrink-0 transition-all bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600`}
        >
          <Camera className="w-5 h-5" />
        </Button>
      </>
    );
  }

  // Has photos — show preview + send
  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2">
        {photos.map((photo, idx) => (
          <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
            <img src={photo.preview} alt="meal" className="w-full h-full object-cover" />
            <button
              onClick={() => removePhoto(idx)}
              aria-label="Удалить фото"
              className="absolute -top-1 -right-1 w-7 h-7 min-w-[44px] min-h-[44px] bg-black/60 rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}
        {photos.length < 2 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Добавить фото"
            className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center ${
              theme === 'light' ? 'border-gray-300 text-gray-400' : 'border-white/20 text-gray-500'
            }`}
          >
            <Camera className="w-6 h-6" />
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
      </div>
      <Button
        onClick={analyzeMeal}
        aria-label="Анализировать еду"
        className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 font-medium"
      >
        <Send className="w-4 h-4 mr-2" />
        Анализировать
      </Button>
    </div>
  );
}