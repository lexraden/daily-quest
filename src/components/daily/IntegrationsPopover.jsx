import React, { useState } from 'react';
import { Plug, X, Heart, Activity, Watch } from 'lucide-react';
import { Button } from '@/components/ui/button';

const INTEGRATIONS = [
  { icon: Heart, name: 'Apple Health', color: 'text-red-500' },
  { icon: Activity, name: 'Google Fit', color: 'text-blue-500' },
  { icon: Watch, name: 'Fitbit', color: 'text-teal-500' },
];

export default function IntegrationsPopover({ theme = 'light' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Integrations"
        className={`ml-auto flex items-center justify-center w-7 h-7 rounded-full transition-all active:scale-95 ${
          theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-white/5 hover:bg-white/10'
        }`}
      >
        <Plug className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`} />
      </button>

      {open && (
        <div
          className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${
            theme === 'light' ? 'bg-black/60' : 'bg-black/80'
          } backdrop-blur-sm`}
          onClick={() => setOpen(false)}
        >
          <div
            className={`rounded-t-3xl sm:rounded-3xl max-w-md w-full border overflow-hidden ${
              theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'
            }`}
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-5 border-b ${
              theme === 'light' ? 'border-gray-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <Plug className={`w-5 h-5 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} />
                <h2 className={`text-lg font-bold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  Integrations
                </h2>
              </div>
              <Button
                onClick={() => setOpen(false)}
                variant="ghost"
                size="icon"
                aria-label="Close"
                className={`h-11 w-11 rounded-full ${theme === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-3">
              <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                Auto-sync steps and calories from your favorite health apps.
              </p>

              {INTEGRATIONS.map((it, idx) => {
                const Icon = it.icon;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-4 rounded-2xl border ${
                      theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${theme === 'light' ? 'bg-white' : 'bg-white/5'}`}>
                      <Icon className={`w-5 h-5 ${it.color}`} />
                    </div>
                    <span className={`flex-1 font-semibold ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                      {it.name}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      theme === 'light' ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      Coming soon
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}