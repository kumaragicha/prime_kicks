import type { AuthResponse, Order, Paginated, Product } from '@prime-kicks/types';

export type FilterOption = { id: string; name: string };
export type StoreFilters = { brands: FilterOption[]; categories: FilterOption[] };

export type StoreCart = { id: string; items: StoreCartItem[] };
export type StoreCartItem = {
  id: string;
  quantity: number;
  product: Pick<Product, 'id' | 'name' | 'brand' | 'photoUrls' | 'price' | 'currency'>;
  variant: { id: string; size: { label: string } };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/** Error carrying the API's HTTP status and its human-readable message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Pull the message out of a NestJS error body ({ message, error, statusCode }); fall back to raw text. */
async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    if (message) return new ApiError(res.status, message);
  } catch {
    // non-JSON body — fall through to raw text
  }
  return new ApiError(res.status, text || `Request failed (${res.status})`);
}

const ACCESS_TOKEN_KEY = 'prime-kicks-access-token';
const REFRESH_TOKEN_KEY = 'prime-kicks-refresh-token';

function readStored(key: string): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
}

function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await rawFetch(path, init);
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json() as Promise<T>;
}

// Like `request`, but attaches the stored access token when the visitor is
// signed in. The API's optional-auth guard reads the token to decide which
// price to return (reseller vs customer) and falls back to customer pricing
// for anonymous visitors — so no token is required, but one is used if present.
async function optionalAuthRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readStored(ACCESS_TOKEN_KEY);
  const res = await rawFetch(path, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json() as Promise<T>;
}

// Access tokens expire after ~15m. When one lapses, transparently exchange the
// stored refresh token for a fresh pair and retry — instead of bouncing the user
// to the login screen. Concurrent 401s share a single in-flight refresh.
let refreshInFlight: Promise<string | null> | null = null;

function clearTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = readStored(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await rawFetch('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as AuthResponse;
        window.localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
        window.localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function authenticatedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let token = readStored(ACCESS_TOKEN_KEY);
  if (!token) throw new Error('AUTH_REQUIRED');

  let res = await rawFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (!token) {
      clearTokens();
      throw new Error('AUTH_REQUIRED');
    }
    res = await rawFetch(path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init?.headers },
    });
  }

  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => authenticatedRequest<AuthResponse['user']>('/auth/me'),
  register: (body: {
    firstName: string;
    lastName: string;
    email: string;
    mobileNo: string;
    city: string;
    state: string;
    password: string;
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listProducts: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return optionalAuthRequest<Paginated<Product>>(`/products${qs}`);
  },
  getProduct: (id: string) => optionalAuthRequest<Product>(`/products/${id}`),
  getFilters: () => request<StoreFilters>('/filters'),
  addToCart: (productId: string, variantId: string) =>
    authenticatedRequest('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, variantId, quantity: 1 }),
    }),
  getCart: () => authenticatedRequest<StoreCart>('/cart'),
  updateCartItem: (itemId: string, quantity: number) =>
    authenticatedRequest<StoreCart>(`/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  removeCartItem: (itemId: string) =>
    authenticatedRequest<StoreCart>(`/cart/items/${itemId}`, { method: 'DELETE' }),
  createOrder: (body: {
    items: Array<{ productId: string; variantId: string; quantity: number }>;
    address: {
      name: string;
      email?: string;
      altMobileNo?: string;
      mobileNo: string;
      line1: string;
      line2?: string;
      landmark?: string;
      pincode: string;
      city: string;
      state: string;
    };
  }) =>
    authenticatedRequest<{ id: string; orderNumber: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Get the current user's order history (for the profile page). */
  getMyOrders: () => authenticatedRequest<Order[]>('/orders/my'),
  parseAddress: (addressBlock: string) =>
    authenticatedRequest<{
      parsed: {
        name: string;
        email: string;
        altMobileNo: string;
        mobileNo: string;
        line1: string;
        line2: string;
        landmark: string;
        pincode: string;
        city: string;
        state: string;
      };
    }>('/address/parse', {
      method: 'POST',
      body: JSON.stringify({ addressBlock }),
    }),
};
