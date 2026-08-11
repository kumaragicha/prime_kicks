'use client';

import type { AuthResponse } from '@prime-kicks/types';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api, type HeroSlide } from './api';

const ACCESS_TOKEN_KEY = 'prime-kicks-access-token';

export type SignedInUser = {
  name: string;
  email: string;
  role: 'CUSTOMER' | 'RESELLER' | 'ADMIN';
};

const STORE_EVENT = 'pk:store';

/** Notify every mounted header/consumer that auth or cart state changed. */
export function notifyStore() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORE_EVENT));
}

/**
 * Shared storefront auth + cart-count state. Reads the signed-in user and cart quantity
 * from the API/localStorage, and re-reads whenever `notifyStore()` fires — so the header
 * stays in sync across pages after login, logout, or add-to-cart.
 */
export function useAuthCart() {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [cartCount, setCartCount] = useState(0);

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(ACCESS_TOKEN_KEY)) {
      setUser(null);
      setCartCount(0);
      return;
    }
    // Identity (including role) comes fresh from the API on each load rather than
    // a cached localStorage copy — so an admin-side role change takes effect here
    // without the user having to log out and back in. The two reads are
    // independent, so fetch them in parallel rather than one after the other.
    const [meResult, cartResult] = await Promise.allSettled([api.me(), api.getCart()]);

    if (meResult.status === 'fulfilled') {
      const me = meResult.value;
      setUser({ name: me.name, email: me.email, role: me.role });
    } else {
      setUser(null);
    }

    if (cartResult.status === 'fulfilled') {
      setCartCount(cartResult.value.items.reduce((total, item) => total + item.quantity, 0));
    } else {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener(STORE_EVENT, handler);
    return () => window.removeEventListener(STORE_EVENT, handler);
  }, [refresh]);

  return { user, cartCount, refresh };
}

/**
 * Load the signed-in user's full profile from the API (fresh, not a cached
 * localStorage copy). `hydrated` flips true once the client-side check has run,
 * so pages can distinguish "still loading" from "signed out". Shared by the
 * profile and orders pages.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(ACCESS_TOKEN_KEY)) {
      setHydrated(true);
      return;
    }
    api
      .me()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setHydrated(true));
  }, []);

  return { user, hydrated };
}

export function useProducts(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['products', params ?? {}],
    queryFn: () => api.listProducts(params),
  });
}

/** Live paginated catalogue for the storefront. A background poll re-fetched
 *  every loaded page on an interval — far too aggressive for a shoe catalogue
 *  that rarely changes mid-session. We refresh on window focus only (and treat
 *  data as fresh for a minute), which cuts steady-state API/bandwidth load. */
export function useInfiniteProducts() {
  return useInfiniteQuery({
    queryKey: ['products', 'storefront'],
    queryFn: ({ pageParam }) => api.listProducts({ page: String(pageParam), pageSize: '8' }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Brand + category facets for the storefront filter drawer. */
export function useFilters() {
  return useQuery({
    queryKey: ['filters'],
    queryFn: () => api.getFilters(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Homepage hero carousel slides (admin-managed). `initialData`, when provided,
 * comes from the server component's fetch — so the banner renders from the first
 * HTML with no loading flash, then this refreshes it in the background.
 */
export function useHeroSlides(initialData?: HeroSlide[]) {
  return useQuery({
    queryKey: ['hero-slides'],
    queryFn: () => api.getHeroSlides(),
    staleTime: 5 * 60 * 1000,
    initialData,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.getProduct(id),
    enabled: Boolean(id),
  });
}

/** Up to 8 similar products for the product page's "You may also like" rail. */
export function useSimilarProducts(id: string) {
  return useQuery({
    queryKey: ['product', id, 'similar'],
    queryFn: () => api.getSimilarProducts(id),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

/** The current user's order history, shown on the orders page. */
export function useMyOrders() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(
      typeof window !== 'undefined' && !!window.localStorage.getItem(ACCESS_TOKEN_KEY),
    );
  }, []);

  return useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.getMyOrders(),
    enabled,
    refetchOnWindowFocus: true,
  });
}
