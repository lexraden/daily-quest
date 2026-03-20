import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BackButton({ theme = 'light', fallbackPath = '/DailyTracker' }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  };

  return (
    <Button
      onClick={handleBack}
      variant="ghost"
      size="icon"
      className={`h-9 w-9 rounded-full flex-shrink-0 ${
        theme === 'light' ? 'hover:bg-black/5 text-gray-700' : 'hover:bg-white/10 text-gray-300'
      }`}
    >
      <ChevronLeft className="w-5 h-5" />
    </Button>
  );
}