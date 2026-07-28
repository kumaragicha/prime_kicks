'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { LoginSchema } from '@prime-kicks/validation';
import type { PublicUser } from '@prime-kicks/types';
import { api, AUTH_LOGOUT_EVENT, tokenStore } from './api';

const USER_KEY = 'pk_admin_user';

/** Roles permitted to use the admin panel. */
const ADMIN_ROLES: PublicUser['role'][] = ['ADMIN', 'RESELLER'];

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginSchema) => Promise<PublicUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from storage on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(USER_KEY);
    if (stored && tokenStore.access()) {
      try {
        setUser(JSON.parse(stored) as PublicUser);
      } catch {
        window.localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // React to an unrecoverable session (refresh failed) from the API layer.
  useEffect(() => {
    const handler = () => {
      clearSession();
      router.replace('/login');
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, handler);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handler);
  }, [clearSession, router]);

  const login = useCallback(async (credentials: LoginSchema) => {
    const res = await api.login(credentials);
    if (!ADMIN_ROLES.includes(res.user.role)) {
      throw new Error('This account is not permitted to access the admin panel.');
    }
    tokenStore.set(res.accessToken, res.refreshToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // best effort — clear locally regardless
    }
    clearSession();
    router.replace('/login');
  }, [clearSession, router]);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: Boolean(user), isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/** Redirects to /login when there is no authenticated admin. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="p-8 text-sm text-neutral-500">Loading…</div>;
  }
  return <>{children}</>;
}
