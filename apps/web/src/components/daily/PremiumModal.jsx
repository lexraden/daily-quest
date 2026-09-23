import React, { useEffect, useState } from 'react';
import { X, Lock, Mic, Camera, Crown, Check, Snowflake, Bell, Target, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { t } from '@/lib/i18n';

/**
 * What Pro is, and how to buy it.
 *
 * The screen this replaces was a showroom: eight features, six of them labelled
 * "coming soon", two of them already free, dead "Connect" buttons against three
 * fitness integrations that do not exist, and an "Upgrade" button whose entire
 * implementation was `onClose`. It promised a product that was not there, which
 * is worse than promising nothing.
 *
 * What is actually true is small enough to say plainly: two AI features are
 * gated — voice capture and photo calories, the two the API refuses once the
 * trial is over — and the rest of the tracker is free. So the page says that,
 * separates what is real from what is planned, and the button does something.
 *
 * Payment runs through Telegram Stars: tapping mints an invoice link and hands
 * it to Telegram, which owns the checkout. Nothing here touches a card.
 */
export default function PremiumModal({ onClose, theme = 'dark', premiumStatus }) {
  const i = t();
  const p = i.premium;
  const light = theme === 'light';

  const status = premiumStatus || { isPremium: false, inTrial: false, daysLeft: 0, trialExpired: false };

  const [plan, setPlan] = useState(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState(null);

  // The price comes from the server so it can change without a deploy of the
  // app; until it arrives there is no button to press.
  useEffect(() => {
    let cancelled = false;
    api.billing
      .plan()
      .then((data) => { if (!cancelled) setPlan(data); })
      .catch(() => { if (!cancelled) setPlan({ enabled: false }); });
    return () => { cancelled = true; };
  }, []);

  const buy = async () => {
    setBuying(true);
    setError(null);
    try {
      const { url } = await api.billing.invoice();
      // Telegram's own sheet. Same tab on a phone, where a popup blocker would
      // otherwise eat it, and the app is still here when they come back.
      window.location.href = url;
    } catch {
      setError(p.buyFailed);
      setBuying(false);
    }
  };

  const included = [
    { icon: Mic, title: p.voiceFeature, description: p.voiceFeatureDesc },
    { icon: Camera, title: p.photoFeature, description: p.photoFeatureDesc },
  ];

  const alwaysFree = [
    { icon: Target, title: p.freeQuests, description: p.freeQuestsDesc },
    { icon: Snowflake, title: p.freeFreeze, description: p.freeFreezeDesc },
    { icon: Bell, title: p.freeReminders, description: p.freeRemindersDesc },
  ];

  const later = [
    { title: p.nutritionAnalytics, description: p.nutritionAnalyticsDesc },
    { title: p.bodyHistory, description: p.bodyHistoryDesc },
    { title: p.coachMode, description: p.coachModeDesc },
  ];

  const sectionTitle = (text) => (
    <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
      {text}
    </h2>
  );

  const row = ({ icon: Icon, title, description }, idx, accent) => (
    <div
      key={idx}
      className={`rounded-xl p-4 border flex items-start gap-3 ${
        light ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'
      }`}
    >
      <div className={`p-2.5 rounded-lg flex-shrink-0 ${light ? 'bg-purple-100' : 'bg-purple-500/20'}`}>
        <Icon className={`w-5 h-5 ${accent}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold ${light ? 'text-gray-900' : 'text-white'}`}>{title}</h3>
        <p className={`text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>{description}</p>
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${
      light
        ? 'bg-gradient-to-b from-gray-50 via-purple-50 to-cyan-50'
        : 'bg-gradient-to-b from-[#0f1419] via-[#1a1f2e] to-[#0f1419]'
    }`}>
      <div className={`sticky top-0 z-10 backdrop-blur-xl border-b ${
        light ? 'bg-white/90 border-gray-200' : 'bg-[#0f1419]/90 border-white/10'
      }`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
              {p.proHeading}
            </h1>
            <p className={`text-sm mt-1 ${light ? 'text-gray-600' : 'text-gray-400'}`}>
              {p.proSubtitle}
            </p>
          </div>
          <Button onClick={onClose} variant="ghost" size="icon" aria-label={p.understood}
            className={`h-11 w-11 rounded-full ${light ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}>
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

        {/* Where this account stands. Four states, the same four the API gate
            distinguishes, so the screen never contradicts what a call does. */}
        <div className={`rounded-2xl p-4 border ${
          status.isPremium
            ? light ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/30'
            : status.trialExpired
              ? light ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/30'
              : light ? 'bg-gradient-to-br from-purple-50 to-cyan-50 border-purple-200'
                      : 'bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${light ? 'bg-white' : 'bg-white/10'}`}>
              {status.isPremium ? (
                <Crown className={`w-5 h-5 ${light ? 'text-amber-600' : 'text-amber-400'}`} />
              ) : status.trialExpired ? (
                <Lock className={`w-5 h-5 ${light ? 'text-red-600' : 'text-red-400'}`} />
              ) : (
                <Sparkles className={`w-5 h-5 ${light ? 'text-purple-600' : 'text-purple-400'}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
                {status.isPremium
                  ? status.lifetime ? p.proForever : p.proActive
                  : status.inTrial ? p.trialActive
                  : status.trialExpired ? p.trialExpired
                  : p.noPlan}
              </h3>
              <p className={`text-sm ${light ? 'text-gray-600' : 'text-gray-400'}`}>
                {status.isPremium
                  ? status.paidUntil
                    ? `${p.proUntil} ${status.paidUntil.toLocaleDateString()}`
                    : p.proActiveDesc
                  : status.inTrial ? `${p.trialDaysLeft} ${status.daysLeft}`
                  : status.trialExpired ? p.trialUpgradeMsg
                  : p.noPlanDesc}
              </p>
            </div>
          </div>
        </div>

        <div>
          {sectionTitle(p.includedTitle)}
          <div className="space-y-2">
            {included.map((f, idx) => row(f, idx, light ? 'text-purple-600' : 'text-purple-400'))}
          </div>
        </div>

        <div>
          {sectionTitle(p.alwaysFreeTitle)}
          <div className="space-y-2">
            {alwaysFree.map((f, idx) => row(f, idx, light ? 'text-green-600' : 'text-green-400'))}
          </div>
        </div>

        {/* Named as plans rather than dressed up as features with a badge: none
            of these exist, and a row that looks like the ones above reads as
            something that is merely switched off. */}
        <div>
          {sectionTitle(p.laterTitle)}
          <ul className="space-y-2">
            {later.map((f, idx) => (
              <li key={idx} className={`flex items-start gap-2 text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-50" />
                <span><span className="font-medium">{f.title}</span> — {f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Nothing to sell someone who already has Pro with no end date. */}
      {!status.lifetime && (
        <div className={`sticky bottom-0 p-5 border-t space-y-2 backdrop-blur-xl ${
          light ? 'bg-white/90 border-gray-200' : 'bg-[#0f1419]/90 border-white/10'
        }`} style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <Button
            onClick={buy}
            disabled={!plan?.enabled || buying}
            className="w-full min-h-[48px] bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-base font-semibold disabled:opacity-50"
          >
            <Star className="w-4 h-4 mr-2" />
            {buying
              ? p.buying
              : plan?.enabled
                ? `${status.isPremium ? p.extend : p.buyFor} · ${plan.price} ⭐`
                : p.billingOff}
          </Button>

          {plan?.enabled && (
            <p className={`text-xs text-center ${light ? 'text-gray-500' : 'text-gray-500'}`}>
              {(p.perDays || '').replace('{days}', plan.days)} · {p.payHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
