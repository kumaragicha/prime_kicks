'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

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
    if (!window.localStorage.getItem('prime-kicks-access-token')) {
      setUser(null);
      setCartCount(0);
      return;
    }
    // Identity (including role) comes fresh from the API on each load rather than
    // a cached localStorage copy — so an admin-side role change takes effect here
    // without the user having to log out and back in.
    try {
      const me = await api.me();
      setUser({ name: me.name, email: me.email, role: me.role });
    } catch {
      setUser(null);
    }
    try {
      const current = await api.getCart();
      setCartCount(current.items.reduce((total, item) => total + item.quantity, 0));
    } catch {
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

export function useProducts(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['products', params ?? {}],
    queryFn: () => api.listProducts(params),
  });
}

/** Live paginated catalogue for the storefront. Refreshes in the background as stock changes. */
export function useInfiniteProducts() {
  return useInfiniteQuery({
    queryKey: ['products', 'storefront'],
    queryFn: ({ pageParam }) => api.listProducts({ page: String(pageParam), pageSize: '8' }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    refetchInterval: 20_000,
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

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.getProduct(id),
    enabled: Boolean(id),
  });
}

/** The current user's order history, shown on the orders page. */
export function useMyOrders() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(
      typeof window !== 'undefined' && !!window.localStorage.getItem('prime-kicks-access-token'),
    );
  }, []);

  return useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.getMyOrders(),
    enabled,
    refetchOnWindowFocus: true,
  });
}
