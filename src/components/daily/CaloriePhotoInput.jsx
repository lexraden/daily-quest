import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

const MAX_PHOTOS = 3;

export default function CaloriePhotoInput({ onMealAnalyzed, onStateChange, theme = 'dark' }) {
  const [photos, setPhotos] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Notify parent when state changes (so it can hide other controls like Voice)
  useEffect(() => {
    onStateChange?.({ hasPhotos: photos.length > 0, isAnalyzing });
  }, [photos.length, isAnalyzing, onStateChange]);

  // Cycle through analysis steps while analyzing
  useEffect(() => {
    if (!isAnalyzing) {
      setStepIndex(0);
      return;
    }
    const steps = t().calories.analyzeSteps || [];
    if (steps.length === 0) return;
    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newPhotos = files.slice(0, MAX_PHOTOS - photos.length).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setPhotos(prev => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
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
    setStepIndex(0);

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

      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      console.error('Error analyzing meal:', error);
      toast.error(t().calories.analysisError);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // No photos — show single camera button (Voice stays visible in parent)
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
          aria-label={t().calories.photoFood}
          className={`h-12 w-12 rounded-2xl flex-shrink-0 transition-all bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600`}
        >
          <Camera className="w-5 h-5" />
        </Button>
      </>
    );
  }

  // Has photos — show preview + analyze button (parent will hide Voice)
  const steps = t().calories.analyzeSteps || [];
  const currentStepText = steps[stepIndex] || t().calories.analyzing;

  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2">
        {photos.map((photo, idx) => (
          <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
            <img src={photo.preview} alt="meal" className="w-full h-full object-cover" />
            {!isAnalyzing && (
              <button
                onClick={() => removePhoto(idx)}
                aria-label={t().calories.removePhoto}
                className="absolute top-0 right-0 w-7 h-7 bg-black/60 rounded-bl-xl rounded-tr-xl flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
        ))}
        {photos.length < MAX_PHOTOS && !isAnalyzing && (
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label={t().calories.addPhoto}
            className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center flex-shrink-0 ${
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
        disabled={isAnalyzing}
        aria-label={t().calories.analyze}
        className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 font-medium disabled:opacity-100"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span
              key={stepIndex}
              className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {currentStepText}
            </span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            {t().calories.analyze}
          </>
        )}
      </Button>
    </div>
  );
}