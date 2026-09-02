import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, onSessionLost } from '@/api/client';
import { disableGoogleAutoSelect } from '@/lib/googleAuth';
import { invalidateCache, setCachedUser } from '@/components/UserDataCache';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  // On load, try to trade the refresh cookie for a session. A signed-out
  // visitor simply gets null — that is the normal path, not an error.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const restored = await api.auth.restore();
        if (cancelled) return;
        if (restored) {
          setUser(restored);
          setCachedUser(restored);
          setIsAuthenticated(true);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError({ type: 'unknown', message: error.message || 'Could not sign you in' });
        }
      } finally {
        if (!cancelled) setIsLoadingAuth(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // A refresh that fails mid-session (revoked or expired) drops us to signed
  // out rather than leaving the UI in a half-authenticated state.
  useEffect(
    () =>
      onSessionLost(() => {
        setUser(null);
        setIsAuthenticated(false);
        invalidateCache();
      }),
    [],
  );

  const signInWithGoogleCredential = useCallback(async (idToken) => {
    setAuthError(null);
    try {
      const signedIn = await api.auth.signInWithGoogle(idToken);
      setUser(signedIn);
      setCachedUser(signedIn);
      setIsAuthenticated(true);
      return signedIn;
    } catch (error) {
      setAuthError({ type: 'sign_in_failed', message: error.message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    disableGoogleAutoSelect();
    invalidateCache();
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = '/';
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await api.auth.me();
    setUser(fresh);
    setCachedUser(fresh);
    return fresh;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authError,
        signInWithGoogleCredential,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
