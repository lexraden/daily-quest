import React from 'react';
import { X, Lock, Camera, Footprints, TrendingUp, History, Sparkles, Shield, FileText, Bot, Heart, Activity, Watch, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

export default function PremiumModal({ onClose, theme = 'dark', premiumStatus }) {
  const i = t();
  const p = i.premium;

  const status = premiumStatus || { isPremium: false, inTrial: false, daysLeft: 0, trialExpired: false };

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

  const integrations = [
    { icon: Heart, title: p.appleHealth, description: p.appleHealthDesc, color: 'text-red-500' },
    { icon: Activity, title: p.googleFit, description: p.googleFitDesc, color: 'text-blue-500' },
    { icon: Watch, title: p.fitbit, description: p.fitbitDesc, color: 'text-teal-500' },
  ];

  const getStatusBadge = (s) => {
    switch(s) {
      case 'free':
        return <span className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400'}`}>{p.free}</span>;
      case 'active':
        return <span className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-500/20 text-cyan-400'}`}>{p.freeze1}</span>;
      case 'coming_soon':
        return <span className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-400'}`}>{p.soon}</span>;
      case 'unavailable':
        return <span className={`text-xs px-2 py-1 rounded-full ${theme === 'light' ? 'bg-gray-200 text-gray-600' : 'bg-gray-500/20 text-gray-500'}`}>{p.webLimited}</span>;
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
        theme === 'light' ? 'bg-white/90 border-gray-200' : 'bg-[#0f1419]/90 border-white/10'
      }`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
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
            <Button onClick={onClose} variant="ghost" size="icon" aria-label="Закрыть"
              className={`h-11 w-11 rounded-full ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

        {/* Trial Status Banner */}
        {(status.inTrial || status.trialExpired) && !status.isPremium && (
          <div className={`rounded-2xl p-4 border ${
            status.trialExpired
              ? theme === 'light' ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/30'
              : theme === 'light' ? 'bg-gradient-to-br from-purple-50 to-cyan-50 border-purple-200' : 'bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                status.trialExpired
                  ? theme === 'light' ? 'bg-red-100' : 'bg-red-500/20'
                  : theme === 'light' ? 'bg-white' : 'bg-white/10'
              }`}>
                {status.trialExpired ? (
                  <Lock className={`w-5 h-5 ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`} />
                ) : (
                  <Crown className={`w-5 h-5 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
                )}
              </div>
              <div className="flex-1">
                <h3 className={`font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  {status.trialExpired ? p.trialExpired : p.trialActive}
                </h3>
                <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                  {status.trialExpired
                    ? p.trialUpgradeMsg
                    : `${p.trialDaysLeft} ${status.daysLeft}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Integrations Section */}
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
            {p.integrations}
          </h2>
          <p className={`text-xs mb-3 ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
            {p.integrationsDesc}
          </p>
          <div className="space-y-2">
            {integrations.map((integration, idx) => {
              const Icon = integration.icon;
              return (
                <div key={idx} className={`rounded-xl p-4 border flex items-center gap-3 ${
                  theme === 'light' ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'
                }`}>
                  <div className={`p-2.5 rounded-lg flex-shrink-0 ${theme === 'light' ? 'bg-gray-50' : 'bg-white/5'}`}>
                    <Icon className={`w-5 h-5 ${integration.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                      {integration.title}
                    </h3>
                    <p className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                      {integration.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`${p.connect} ${integration.title}`}
                    className={`flex-shrink-0 ${theme === 'light' ? 'border-gray-300' : 'border-white/20'}`}
                    onClick={() => {/* TODO: integration logic */}}
                  >
                    {p.connect}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Features Section */}
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
            Features
          </h2>
          <div className="space-y-2">
            {premiumFeatures.map((feature, idx) => {
              const Icon = feature.icon;
              const isAvailable = feature.status === 'free' || feature.status === 'active';
              return (
                <div key={idx} className={`rounded-xl p-4 border transition-all ${
                  theme === 'light'
                    ? isAvailable ? 'bg-gray-50 border-gray-200' : 'bg-gray-50/50 border-gray-200 opacity-60'
                    : isAvailable ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/5 opacity-60'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                      theme === 'light'
                        ? isAvailable ? 'bg-purple-100' : 'bg-gray-100'
                        : isAvailable ? 'bg-purple-500/20' : 'bg-white/5'
                    }`}>
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
        </div>
      </div>

      {/* Footer */}
      <div className={`sticky bottom-0 p-5 border-t space-y-3 backdrop-blur-xl ${
        theme === 'light' ? 'bg-white/90 border-gray-200' : 'bg-[#0f1419]/90 border-white/10'
      }`} style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>
        <Button
          onClick={onClose}
          aria-label={p.upgradeToPremium}
          className="w-full min-h-[48px] bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-base font-semibold"
        >
          <Crown className="w-4 h-4 mr-2" />
          {p.upgradeToPremium}
        </Button>
      </div>
    </div>
  );
}