import React from 'react';
import { X, Lock, Camera, Footprints, TrendingUp, History, Sparkles, Shield, FileText, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PremiumModal({ onClose }) {
  const premiumFeatures = [
    {
      icon: Camera,
      title: "AI Калории по фото",
      description: "Сфотографируй еду и получи точный подсчет калорий",
      status: "coming_soon"
    },
    {
      icon: Footprints,
      title: "Автопроверка шагов",
      description: "Автоматическая синхронизация с Apple Health / Google Fit",
      status: "unavailable"
    },
    {
      icon: TrendingUp,
      title: "Аналитика питания",
      description: "Отслеживание дефицита/профицита калорий",
      status: "coming_soon"
    },
    {
      icon: History,
      title: "История тела",
      description: "Трекинг веса, объемов и прогресса",
      status: "coming_soon"
    },
    {
      icon: Sparkles,
      title: "Умные рекомендации",
      description: "Персональные советы от AI на основе твоих данных",
      status: "coming_soon"
    },
    {
      icon: Shield,
      title: "Защита стрика",
      description: "1 бесплатная защита, +3 с Premium",
      status: "active"
    },
    {
      icon: FileText,
      title: "Экспорт данных",
      description: "Выгрузка всей истории в JSON формате",
      status: "free"
    },
    {
      icon: Bot,
      title: "Coach Mode",
      description: "Личный AI тренер для мотивации и советов",
      status: "coming_soon"
    }
  ];

  const getStatusBadge = (status) => {
    switch(status) {
      case 'free':
        return <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">Бесплатно</span>;
      case 'active':
        return <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400">1 freeze</span>;
      case 'coming_soon':
        return <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">Скоро</span>;
      case 'unavailable':
        return <span className="text-xs px-2 py-1 rounded-full bg-gray-500/20 text-gray-500">Web ограничен</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#1e2836] to-[#151c28] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-cyan-500/10 to-purple-600/20 blur-3xl" />
          <div className="relative flex items-center justify-between p-5 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Premium Features
              </h2>
              <p className="text-sm text-gray-400 mt-1">Расширенные возможности трекера</p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {premiumFeatures.map((feature, idx) => {
            const Icon = feature.icon;
            const isAvailable = feature.status === 'free' || feature.status === 'active';
            
            return (
              <div
                key={idx}
                className={`
                  rounded-xl p-4 border transition-all
                  ${isAvailable 
                    ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                    : 'bg-white/[0.02] border-white/5 opacity-60'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2.5 rounded-lg flex-shrink-0
                    ${isAvailable ? 'bg-purple-500/20' : 'bg-white/5'}
                  `}>
                    <Icon className={`w-5 h-5 ${isAvailable ? 'text-purple-400' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-white">{feature.title}</h3>
                      {getStatusBadge(feature.status)}
                    </div>
                    <p className="text-sm text-gray-400">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 space-y-3">
          <div className="text-center text-sm text-gray-400">
            <p>Premium функции будут доступны после релиза 🚀</p>
            <p className="text-xs mt-1">Telegram Mini Apps пока имеют технические ограничения</p>
          </div>
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            Понятно
          </Button>
        </div>
      </div>
    </div>
  );
}