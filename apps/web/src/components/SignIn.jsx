import React, { useEffect, useRef, useState } from 'react';
import { Swords, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/lib/AuthContext';
import { initGoogleSignIn, fetchAuthConfig } from '@/lib/googleAuth';
import { t } from '@/lib/i18n';

export default function SignIn() {
  const { signInWithGoogleCredential, signInAsGuest, authError } = useAuth();
  const buttonRef = useRef(null);
  // Held until the container is actually visible — see the second effect.
  const renderButtonRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | signing-in
  const [error, setError] = useState('');
  const [guestAllowed, setGuestAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

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
        renderButtonRef.current = renderButton;
        setStatus('ready');
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

  // The same config call the Google init already makes, deduplicated behind
  // one promise — the button only appears where the server allows guests.
  useEffect(() => {
    let cancelled = false;
    fetchAuthConfig()
      .then((c) => { if (!cancelled) setGuestAllowed(Boolean(c.guest_login)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleGuest = async () => {
    setStatus('signing-in');
    setError('');
    try {
      await signInAsGuest();
    } catch (err) {
      setError(err.message || 'Could not start a guest session.');
      setStatus('ready');
    }
  };

  // Google's renderButton measures its container, so it must run only once the
  // container is on screen. Calling it right after setStatus('ready') drew into
  // a still-hidden element and produced an empty sign-in card with no error.
  useEffect(() => {
    if (status !== 'ready' || !renderButtonRef.current || !buttonRef.current) return;
    renderButtonRef.current(buttonRef.current);
  }, [status]);

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

        {guestAllowed && status === 'ready' && (
          <button
            type="button"
            onClick={handleGuest}
            className="text-sm underline text-muted-foreground hover:text-foreground min-h-[44px]"
          >
            {t().auth?.guest || 'Continue as guest'}
          </button>
        )}

        {message && (
          <p className="text-sm text-destructive text-center" role="alert">
            {message}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
