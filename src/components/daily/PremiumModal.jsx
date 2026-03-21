import React from 'react';
import { X, Lock, Camera, Footprints, TrendingUp, History, Sparkles, Shield, FileText, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

export default function PremiumModal({ onClose, theme = 'dark' }) {
  const i = t();
  const p = i.premium;
  const premiumFeatures = [
    { icon: Camera, title: p.caloriePhoto, description: p.caloriePhotoDesc, status: "coming_soon" },
    { icon: Footprints, title: p.autoSteps, description: p.autoStepsDesc, status: "unavailable" },
    { icon: TrendingUp, title: p.nutritionAnalytics, description: p.nutritionAnalyticsDesc, status: "coming_soon" },
    { icon: History, title: p.bodyHistory, description: p.bodyHistoryDesc, status: "coming_soon" },
    { icon: Sparkles, title: p.smartRecommendations, description: p.smartRecommendationsDesc, status: "coming_soon" },
    { icon: Shield, title: p.streakProtection, description: p.streakProtectionDesc, status: "active" },
    { icon: FileText, title: p.dataExport, description: p.dataExportDesc, status: "free" },
    { icon: Bot, title: p.coachMode, description: p.coachModeDesc, status: "coming_soon" }
  ];

  const getStatusBadge = (status) => {
    switch(status) {
      case 'free':
        return <span className={`text-xs px-2 py-1 rounded-full ${
          theme === 'light' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-green-500/20 text-green-400'
        }`}>{p.free}</span>;
      case 'active':
        return <span className={`text-xs px-2 py-1 rounded-full ${
          theme === 'light' 
            ? 'bg-cyan-100 text-cyan-700' 
            : 'bg-cyan-500/20 text-cyan-400'
        }`}>{p.freeze1}</span>;
      case 'coming_soon':
        return <span className={`text-xs px-2 py-1 rounded-full ${
          theme === 'light' 
            ? 'bg-purple-100 text-purple-700' 
            : 'bg-purple-500/20 text-purple-400'
        }`}>{p.soon}</span>;
      case 'unavailable':
        return <span className={`text-xs px-2 py-1 rounded-full ${
          theme === 'light' 
            ? 'bg-gray-200 text-gray-600' 
            : 'bg-gray-500/20 text-gray-500'
        }`}>{p.webLimited}</span>;
      default:
        return null;
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${
      theme === 'light' 
        ? 'bg-gradient-to-br from-gray-50 via-purple-50 to-cyan-50'
        : 'bg-gradient-to-br from-[#0f1419] via-[#1a1f2e] to-[#0f1419]'
    }`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        theme === 'light' 
          ? 'bg-white/90 border-gray-200' 
          : 'bg-[#0f1419]/90 border-white/10'
      }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                Premium Features
              </h1>
              <p className={`text-sm mt-1 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                {p.subtitle}
              </p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              aria-label="Закрыть"
              className={`h-11 w-11 rounded-full ${
                theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'
              }`}
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3">
          {premiumFeatures.map((feature, idx) => {
            const Icon = feature.icon;
            const isAvailable = feature.status === 'free' || feature.status === 'active';
            
            return (
              <div
                key={idx}
                className={`
                  rounded-xl p-4 border transition-all
                  ${theme === 'light'
                    ? isAvailable 
                      ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                      : 'bg-gray-50/50 border-gray-200 opacity-60'
                    : isAvailable 
                      ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                      : 'bg-white/[0.02] border-white/5 opacity-60'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2.5 rounded-lg flex-shrink-0
                    ${theme === 'light'
                      ? isAvailable ? 'bg-purple-100' : 'bg-gray-100'
                      : isAvailable ? 'bg-purple-500/20' : 'bg-white/5'
                    }
                  `}>
                    <Icon className={`w-5 h-5 ${
                      theme === 'light'
                        ? isAvailable ? 'text-purple-600' : 'text-gray-400'
                        : isAvailable ? 'text-purple-400' : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className={`font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                        {feature.title}
                      </h3>
                      {getStatusBadge(feature.status)}
                    </div>
                    <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 p-5 border-t space-y-3 backdrop-blur-xl ${
          theme === 'light' 
            ? 'bg-white/90 border-gray-200' 
            : 'bg-[#0f1419]/90 border-white/10'
        }`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
        >
          <div className={`text-center text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
            <p>{p.afterRelease}</p>
            <p className={`text-xs mt-1 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              {p.tgLimit}
            </p>
          </div>
          <Button
            onClick={onClose}
            aria-label={i.common.close}
            className="w-full min-h-[44px] bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            {p.understood}
          </Button>
        </div>
      </div>
    );
  }