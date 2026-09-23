import React, { useState } from 'react';
import { RefreshCw, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { checkForUpdate, applyUpdate, currentBuild, shortBuild } from '@/lib/appVersion';

/**
 * "Am I running the latest version?", answered.
 *
 * Worth a button because the honest answer is not obvious from anywhere else:
 * installed on a phone, the app is resumed rather than reloaded for days at a
 * time, and the browser decides on its own schedule when to look for a new
 * service worker. Until now the only remedy was uninstalling it.
 *
 * Four states, and each says what is actually true rather than just spinning:
 * unchecked, checking, up to date, and an update waiting to be taken.
 */
export default function UpdateCheck({ theme }) {
  const i = t();
  const copy = i.update || {};
  const light = theme === 'light';

  const [state, setState] = useState('idle');

  const check = async () => {
    setState('checking');
    const { status } = await checkForUpdate();
    setState(status);
  };

  const label = {
    idle: copy.check || 'Check for updates',
    checking: copy.checking || 'Checking…',
    current: copy.upToDate || 'Up to date',
    unknown: copy.unknown || 'Could not check',
    update: copy.available || 'Update available',
  }[state];

  const Icon = state === 'current' ? Check : state === 'update' ? Download : RefreshCw;

  return (
    <div
      className={`rounded-2xl p-4 border ${
        light ? 'bg-white border-gray-200' : 'bg-[#1e2836] border-white/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`w-5 h-5 flex-shrink-0 ${
            state === 'checking' ? 'animate-spin' : ''
          } ${
            state === 'current'
              ? light ? 'text-green-600' : 'text-green-400'
              : state === 'update'
                ? light ? 'text-purple-600' : 'text-purple-400'
                : 'text-gray-500'
          }`}
        />

        <span className="flex-1 min-w-0">
          <span className={`block text-sm font-semibold ${light ? 'text-gray-900' : 'text-white'}`}>
            {label}
          </span>
          {/* The build id is the one detail that makes a bug report useful:
              "it is broken" and "it is broken on 7b3d9d3" are different
              messages. */}
          <span className={`block text-xs mt-0.5 font-mono ${light ? 'text-gray-500' : 'text-gray-500'}`}>
            {copy.version || 'Version'} {shortBuild(currentBuild())}
          </span>
        </span>

        {state === 'update' ? (
          <Button
            size="sm"
            onClick={applyUpdate}
            className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            {copy.reload || 'Update'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={check}
            disabled={state === 'checking'}
            className={`flex-shrink-0 ${light ? 'border-gray-300' : 'border-white/20'}`}
          >
            {copy.checkShort || 'Check'}
          </Button>
        )}
      </div>
    </div>
  );
}
