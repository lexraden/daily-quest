import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { toast } from 'sonner';
import { t, getLang } from '@/lib/i18n';

const MAX_PHOTOS = 3;
const MAX_DIMENSION = 1280; // px — max width/height after compression
const JPEG_QUALITY = 0.85;

// Compress image client-side: resize to fit MAX_DIMENSION and re-encode as JPEG.
// Falls back to original file on any failure.
async function compressImage(file) {
  try {
    if (!file.type.startsWith('image/')) return file;

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;

    let { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) return file;

    // Use original blob if compression made it bigger
    if (blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export default function CaloriePhotoInput({ onMealAnalyzed, onStateChange, theme = 'dark', hasAccess = true, onLocked }) {
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
      // Compress + upload all photos in parallel. The upload returns both a
      // signed URL to display and an id the analysis endpoint reads from disk.
      const uploaded = await Promise.all(
        photos.map(async (photo) => {
          const compressed = await compressImage(photo.file);
          return api.files.upload(compressed);
        })
      );

      // The prompt now lives on the server; the client sends only the language.
      const result = await api.ai.mealFromPhoto(uploaded.map((u) => u.id), getLang());

      onMealAnalyzed({
        ...result,
        photo_urls: uploaded.map((u) => u.file_url),
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
          onClick={() => {
            if (!hasAccess) {
              onLocked?.();
              return;
            }
            fileInputRef.current?.click();
          }}
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