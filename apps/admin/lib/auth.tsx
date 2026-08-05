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
    return <AdminSkeleton />;
  }
  return <>{children}</>;
}

const shimmer = 'animate-pulse rounded bg-neutral-200';

/** Full-shell placeholder shown while the session is resolving. */
function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50" aria-hidden="true">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-neutral-200 bg-white p-6 lg:flex">
        <div className={`${shimmer} mb-8 h-6 w-32`} />
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${shimmer} h-8 w-full`} />
          ))}
        </div>
        <div className="mt-6 border-t border-neutral-200 pt-4">
          <div className={`${shimmer} mb-2 h-4 w-28`} />
          <div className={`${shimmer} mb-3 h-3 w-16`} />
          <div className={`${shimmer} h-8 w-full`} />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-neutral-200 bg-white px-4 lg:hidden">
        <div className={`${shimmer} h-8 w-8`} />
        <div className={`${shimmer} ml-3 h-5 w-28`} />
      </header>

      {/* Content */}
      <div className="min-w-0 lg:pl-56">
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className={`${shimmer} mb-6 h-8 w-48`} />
          <div className="mb-6 flex gap-3">
            <div className={`${shimmer} h-10 w-full max-w-xs`} />
            <div className={`${shimmer} h-10 w-28`} />
          </div>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-neutral-100 p-4 last:border-0"
              >
                <div className={`${shimmer} h-10 w-10 shrink-0`} />
                <div className={`${shimmer} h-4 flex-1`} />
                <div className={`${shimmer} h-4 w-24`} />
                <div className={`${shimmer} h-8 w-16`} />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
