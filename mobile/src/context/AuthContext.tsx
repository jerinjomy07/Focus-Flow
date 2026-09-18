// mobile/src/context/AuthContext.tsx
// FocusFlow Mobile — Authentication Context & Session Lifecycle
//
// Manages rotating refresh tokens strictly in Android Keystore via expo-secure-store,
// maintains short-lived access tokens exclusively in memory, auto-restores active
// sessions on launch, and invokes server-side session revocation on logout.

import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { authApi } from '../api/auth';
import {
  REFRESH_TOKEN_STORAGE_KEY,
  setAccessToken,
  setUnauthorizedHandler,
} from '../api/client';
import { offlineCache } from '../cache/offlineCache';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (payload: { name: string; email: string; password: string }) => Promise<void>;
  completeOnboarding: (data: {
    timezone: string;
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    dailyGoal: number;
    firstProjectName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from SecureStore on startup
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
        if (storedRefreshToken) {
          // Exchange refresh token for fresh short-lived access token
          const refreshRes = await authApi.refresh(storedRefreshToken);
          setAccessToken(refreshRes.accessToken);
          await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, refreshRes.refreshToken);

          const sessionRes = await authApi.restoreSession();
          if (isMounted && sessionRes?.user) {
            setUser(sessionRes.user);
          }
        }
      } catch {
        // Token invalid, revoked, or expired — purge from storage
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(() => {});
        setAccessToken(null);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    restoreSession();

    // Register 401 callback from API client (when refresh fails)
    setUnauthorizedHandler(() => {
      SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(() => {});
      setAccessToken(null);
      setUser(null);
    });

    return () => {
      isMounted = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await authApi.login(credentials);
    setAccessToken(res.accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, res.refreshToken);
    setUser(res.user);
  };

  const register = async (payload: { name: string; email: string; password: string }) => {
    await authApi.register(payload);
    // Auto-login after registration
    await login({ email: payload.email, password: payload.password });
  };

  const completeOnboarding = async (data: {
    timezone: string;
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    dailyGoal: number;
    firstProjectName?: string;
  }) => {
    const res = await authApi.completeOnboarding(data);
    if (res?.user) {
      setUser(res.user);
    } else {
      setUser((prev) =>
        prev
          ? {
              ...prev,
              onboardedAt: new Date().toISOString(),
              timezone: data.timezone,
            }
          : null
      );
    }
  };

  const logout = async () => {
    try {
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
      // Execute real server-side revocation
      await authApi.logout(storedRefreshToken ? { refreshToken: storedRefreshToken } : undefined);
    } catch {
      // Ignore network errors during logout; proceed with local clearance
    } finally {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(() => {});
      setAccessToken(null);
      await offlineCache.clearAllCache().catch(() => {});
      setUser(null);
    }
  };

  const isAuthenticated = !!user;
  const isOnboarded = !!user?.onboardedAt;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isOnboarded,
        login,
        register,
        completeOnboarding,
        logout,
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
