import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Back button that uses the navigation stack for reliable back behavior.
 * Falls back to /DailyTracker if no stack history is available.
 */
export default function BackButton({ theme = 'light', getBackPath }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (getBackPath) {
      const path = getBackPath();
      navigate(path, { replace: true });
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/DailyTracker', { replace: true });
    }
  };

  return (
    <Button
      onClick={handleBack}
      variant="ghost"
      size="icon"
      aria-label="Назад"
      className={`h-11 w-11 rounded-full flex-shrink-0 ${
        theme === 'light' ? 'hover:bg-black/5 text-gray-700' : 'hover:bg-white/10 text-gray-300'
      }`}
    >
      <ChevronLeft className="w-5 h-5" />
    </Button>
  );
}