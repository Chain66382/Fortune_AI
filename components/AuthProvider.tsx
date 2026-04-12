'use client';

import { createContext, startTransition, useEffect, useMemo, useState } from 'react';
import type { AuthenticatedUser, LoginInput } from '@/types/auth';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthenticatedUser | null>;
}

interface AuthResponse {
  user: AuthenticatedUser | null;
}

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  return payload as T;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({
  children
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async (): Promise<AuthenticatedUser | null> => {
    try {
      const payload = await fetchJson<AuthResponse>('/api/auth/me');
      startTransition(() => {
        setUser(payload.user);
      });
      return payload.user;
    } catch {
      startTransition(() => {
        setUser(null);
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const login = async (input: LoginInput): Promise<AuthenticatedUser> => {
    const payload = await fetchJson<AuthResponse>('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });

    if (!payload.user) {
      throw new Error('Unable to log in.');
    }

    startTransition(() => {
      setUser(payload.user);
    });

    return payload.user;
  };

  const logout = async () => {
    await fetchJson<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST'
    });

    startTransition(() => {
      setUser(null);
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login,
      logout,
      refreshSession
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
