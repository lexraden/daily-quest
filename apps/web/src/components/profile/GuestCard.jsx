import React from 'react';
import { UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

/**
 * Says out loud that this is a throwaway account, and offers the way out.
 *
 * A guest session looks exactly like a real one: the refresh cookie is restored
 * on every load, so tapping "continue as guest" once quietly makes it the
 * account you keep opening. Nothing said so, and nothing said that signing out
 * ends it — a guest has no credential, so there is no way back into one.
 *
 * Hence both halves here: the warning, and a button that does not pretend to
 * migrate anything. Moving the progress across would mean merging two accounts,
 * which is a real feature and not this one.
 */
export default function GuestCard({ theme, onSignIn }) {
  const i = t();
  const copy = i.guestAccount || {};
  const light = theme === 'light';

  return (
    <div
      className={`rounded-2xl p-4 border ${
        light ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${light ? 'bg-white' : 'bg-white/10'}`}>
          <UserX className={`w-5 h-5 ${light ? 'text-amber-600' : 'text-amber-400'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`font-bold ${light ? 'text-gray-900' : 'text-white'}`}>
            {copy.title || 'Guest account'}
          </h3>
          <p className={`text-sm mt-0.5 ${light ? 'text-gray-600' : 'text-gray-300'}`}>
            {copy.body || 'This account has no sign-in. Signing out ends it for good.'}
          </p>

          <Button
            size="sm"
            onClick={onSignIn}
            className="mt-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          >
            {copy.signIn || 'Sign in with Google'}
          </Button>
        </div>
      </div>
    </div>
  );
}
