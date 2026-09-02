import React, { useEffect, useRef, useState } from 'react';
import { Swords, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/lib/AuthContext';
import { initGoogleSignIn, googleClientId } from '@/lib/googleAuth';
import { t } from '@/lib/i18n';

export default function SignIn() {
  const { signInWithGoogleCredential, authError } = useAuth();
  const buttonRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | signing-in
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!googleClientId) {
      setStatus('ready');
      setError('Google sign-in is not configured for this deployment.');
      return undefined;
    }

    (async () => {
      try {
        const renderButton = await initGoogleSignIn(async (credential) => {
          setStatus('signing-in');
          setError('');
          try {
            await signInWithGoogleCredential(credential);
          } catch (err) {
            if (!cancelled) {
              setError(err.message || 'Sign-in failed. Try again.');
              setStatus('ready');
            }
          }
        });
        if (cancelled) return;
        setStatus('ready');
        renderButton(buttonRef.current);
      } catch (err) {
        if (!cancelled) {
          setStatus('ready');
          setError(err.message || 'Google sign-in is unavailable right now.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signInWithGoogleCredential]);

  const message = error || authError?.message;

  return (
    <AuthLayout
      icon={Swords}
      title="DailyQ"
      subtitle={t().auth?.subtitle || 'Level up, one day at a time'}
      footer={t().auth?.footer || 'Your quests, streaks and journal stay private to you.'}
    >
      <div className="flex flex-col items-center gap-4">
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-muted-foreground py-3">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span className="text-sm">{t().auth?.loading || 'Loading sign-in…'}</span>
          </div>
        )}

        {status === 'signing-in' && (
          <div className="flex items-center gap-2 text-muted-foreground py-3">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span className="text-sm">{t().auth?.signingIn || 'Signing you in…'}</span>
          </div>
        )}

        {/* Google renders its own button here; hidden while a sign-in is in flight. */}
        <div
          ref={buttonRef}
          className={`w-full flex justify-center ${status === 'ready' ? '' : 'hidden'}`}
        />

        {message && (
          <p className="text-sm text-destructive text-center" role="alert">
            {message}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
