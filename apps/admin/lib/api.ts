import type {
  AdminOrderRow,
  AdminUserRow,
  AuthResponse,
  Order,
  Paginated,
  PaymentStatus,
  Product,
  PublicUser,
  SizeType,
} from '@prime-kicks/types';
import type {
  CreateOrderSchema,
  CreateProductSchema,
  CreateSizeSchema,
  CreateSizeTypeSchema,
  LoginSchema,
  UpdateProductSchema,
  UpdateSizeSchema,
  UpdateSizeTypeSchema,
} from '@prime-kicks/validation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const ACCESS_KEY = 'pk_admin_token';
const REFRESH_KEY = 'pk_admin_refresh';

/* -------------------------------- token storage ------------------------------- */

export const tokenStore = {
  access: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(ACCESS_KEY)),
  refresh: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(REFRESH_KEY)),
  set(accessToken: string, refreshToken: string) {
    window.localStorage.setItem(ACCESS_KEY, accessToken);
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

/** Fired when the session can no longer be recovered (refresh failed / logout). */
export const AUTH_LOGOUT_EVENT = 'pk-auth-logout';
function emitLogout() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
  }
}

/* ---------------------------------- requests ---------------------------------- */

function toQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '' && v !== null,
  );
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  const access = tokenStore.access();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...init?.headers,
    },
  });
}

/** Attempt a token refresh with the stored refresh token. Returns true on success. */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refresh();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    tokenStore.clear();
    return false;
  }
  const data = (await res.json()) as AuthResponse;
  tokenStore.set(data.accessToken, data.refreshToken);
  return true;
}

async function request<T>(path: string, init?: RequestInit, allowRetry = true): Promise<T> {
  let res = await rawFetch(path, init);

  if (res.status === 401 && allowRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, init);
    } else {
      emitLogout();
    }
  }

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type ProductListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  brand?: string;
  sizeTypeId?: string;
};

export type UserListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  status?: string;
};

export type OrderListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sort?: 'newest' | 'oldest';
};

export const api = {
  listBrands: () => request<{ id: string; name: string; isActive: boolean }[]>('/brands'),
  listProductTypes: () =>
    request<{ id: string; name: string; isActive: boolean }[]>('/product-types'),
  listCategories: () => request<{ id: string; name: string; isActive: boolean }[]>('/categories'),
  createMaster: (resource: 'brands' | 'product-types' | 'categories', name: string) =>
    request<{ id: string; name: string; isActive: boolean }>(`/${resource}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateMaster: (
    resource: 'brands' | 'product-types' | 'categories',
    id: string,
    body: { name?: string; isActive?: boolean },
  ) =>
    request<{ id: string; name: string; isActive: boolean }>(`/${resource}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteMaster: (resource: 'brands' | 'product-types' | 'categories', id: string) =>
    request<{ id: string; deleted: boolean }>(`/${resource}/${id}`, { method: 'DELETE' }),
  // Auth
  login: (body: LoginSchema) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }, false),
  me: () => request<PublicUser>('/auth/me'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }, false),

  // Products
  listProducts: (params?: ProductListParams) =>
    request<Paginated<Product>>(`/products${toQuery(params)}`),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  createProduct: (body: CreateProductSchema) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id: string, body: UpdateProductSchema) =>
    request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProduct: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/products/${id}`, { method: 'DELETE' }),

  // Users
  listUsers: (params?: UserListParams) =>
    request<Paginated<AdminUserRow>>(`/users${toQuery(params)}`),
  listResellers: () => request<Paginated<AdminUserRow>>(`/users?role=RESELLER&pageSize=100`),
  disableUser: (id: string) => request<AdminUserRow>(`/users/${id}/disable`, { method: 'PATCH' }),
  enableUser: (id: string) => request<AdminUserRow>(`/users/${id}/enable`, { method: 'PATCH' }),
  deleteUser: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/users/${id}`, { method: 'DELETE' }),

  // Sizes master
  listSizeTypes: (includeInactive = false) =>
    request<SizeType[]>(`/size-types${includeInactive ? '?includeInactive=true' : ''}`),
  createSizeType: (body: CreateSizeTypeSchema) =>
    request<SizeType>('/size-types', { method: 'POST', body: JSON.stringify(body) }),
  updateSizeType: (id: string, body: UpdateSizeTypeSchema) =>
    request<SizeType>(`/size-types/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSizeType: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/size-types/${id}`, { method: 'DELETE' }),
  addSize: (sizeTypeId: string, body: CreateSizeSchema) =>
    request<unknown>(`/size-types/${sizeTypeId}/sizes`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSize: (id: string, body: UpdateSizeSchema) =>
    request<unknown>(`/sizes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSize: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/sizes/${id}`, { method: 'DELETE' }),

  // Orders
  listOrders: (params?: OrderListParams) =>
    request<Paginated<AdminOrderRow>>(`/orders${toQuery(params)}`),
  getOrder: (id: string) => request<Order>(`/orders/${id}`),
  updateOrderStatus: (id: string, status: string) =>
    request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  approveOrder: (id: string, paymentStatus: PaymentStatus) =>
    request<Order>(`/orders/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ paymentStatus }),
    }),
  rejectOrder: (id: string) => request<Order>(`/orders/${id}/reject`, { method: 'POST' }),
  createOrder: (body: CreateOrderSchema) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  deleteOrder: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/orders/${id}`, { method: 'DELETE' }),
};
