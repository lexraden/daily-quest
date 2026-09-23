import React from 'react';
import { Crown, Lock, Sparkles } from 'lucide-react';
import { t } from '@/lib/i18n';

/**
 * What the account is actually entitled to, said out loud.
 *
 * Until now `is_premium` was invisible: the flag decided whether the AI
 * endpoints keep working past the trial, and nothing in the app ever mentioned
 * it. Granting Pro to someone therefore looked identical to not granting it,
 * which is how a working grant gets reported as broken.
 *
 * The four states are the four the gate distinguishes (see lib/access.ts), in
 * the same order a user moves through them: no trial yet, in trial, trial over,
 * paid.
 */
export default function PlanCard({ premiumStatus, theme, onOpen }) {
  const i = t();
  const p = i.premium || {};
  const light = theme === 'light';
  const status = premiumStatus || {};

  const state = status.isPremium
    ? {
        Icon: Crown,
        title: p.proActive || 'Pro',
        detail: p.proActiveDesc || '',
        accent: light ? 'text-amber-600' : 'text-amber-400',
        badge: light ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-300',
        label: 'PRO',
      }
    : status.inTrial
      ? {
          Icon: Sparkles,
          title: p.trialActive || 'Free trial',
          // `daysLeft` is whole days rounded up, so 1 means "today is the last".
          detail: `${p.trialDaysLeft || 'Days left:'} ${status.daysLeft}`,
          accent: light ? 'text-purple-600' : 'text-purple-400',
          badge: light ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300',
          label: 'TRIAL',
        }
      : status.trialExpired
        ? {
            Icon: Lock,
            title: p.trialExpired || 'Free trial ended',
            detail: p.trialUpgradeMsg || '',
            accent: light ? 'text-red-600' : 'text-red-400',
            badge: light ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-300',
            label: 'FREE',
          }
        : {
            Icon: Sparkles,
            title: p.noPlan || 'Free',
            detail: p.noPlanDesc || '',
            accent: light ? 'text-gray-500' : 'text-gray-400',
            badge: light ? 'bg-gray-100 text-gray-600' : 'bg-white/10 text-gray-300',
            label: 'FREE',
          };

  const { Icon } = state;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left rounded-2xl p-4 border transition-colors ${
        light
          ? 'bg-white border-gray-200 hover:bg-gray-50'
          : 'bg-[#1e2836] border-white/10 hover:bg-[#232e3e]'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 ${state.accent}`} />

        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-semibold ${light ? 'text-gray-900' : 'text-white'}`}>
            {p.planTitle || 'Plan'}
          </span>
          <span className={`block text-xs mt-0.5 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
            {state.detail ? `${state.title} · ${state.detail}` : state.title}
          </span>
        </span>

        <span
          className={`flex-shrink-0 text-[11px] font-bold tracking-wider px-2 py-1 rounded-full ${state.badge}`}
        >
          {state.label}
        </span>
      </div>
    </button>
  );
}
