import type {
  AdminOrderRow,
  AdminUserRow,
  AuthResponse,
  CourierConfig,
  CreditCustomer,
  Dimension,
  DimensionCombination,
  Order,
  Paginated,
  PaymentStatus,
  Product,
  PublicUser,
  ShipmozoSetting,
  SizeType,
} from '@prime-kicks/types';
import type {
  CreateCreditCustomerSchema,
  CreateDimensionCombinationSchema,
  CreateDimensionSchema,
  CreateOrderSchema,
  CreateProductSchema,
  CreateSizeSchema,
  CreateSizeTypeSchema,
  LoginSchema,
  UpdateCreditCustomerSchema,
  UpdateDimensionCombinationSchema,
  UpdateDimensionSchema,
  UpdateProductSchema,
  UpdateShipmozoSettingSchema,
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

/** Decode a JWT's `exp` (seconds) without verifying — for client-side staleness checks only. */
function jwtExpirySeconds(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

/** True when the access token is expired (or within a 10s skew of expiring). */
function accessTokenExpired(token: string): boolean {
  const exp = jwtExpirySeconds(token);
  if (exp === null) return false; // Unparseable — let the server be the judge.
  return Date.now() >= exp * 1000 - 10_000;
}

/**
 * Refresh the access token BEFORE sending when it has already expired. Optional-
 * auth endpoints (e.g. GET /products) answer an expired token as *anonymous* with
 * a 200 — no 401 to trigger the reactive refresh — so admin-only fields (product
 * pricing) silently come back stripped/zeroed. Refreshing up front keeps every
 * request authenticated. If the session can't be recovered, surface a logout.
 */
async function ensureFreshAccessToken(): Promise<void> {
  const access = tokenStore.access();
  if (!access || !accessTokenExpired(access)) return;
  if (!tokenStore.refresh()) {
    emitLogout();
    return;
  }
  const refreshed = await tryRefresh();
  if (!refreshed) emitLogout();
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

// The API rotates the refresh token on every use, so two concurrent 401s must
// not each fire their own refresh — the second would present an already-rotated
// (now invalid) token and get the admin logged out. Concurrent callers share one
// in-flight refresh.
let refreshInFlight: Promise<boolean> | null = null;

/** Attempt a token refresh with the stored refresh token. Returns true on success. */
function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = tokenStore.refresh();
      if (!refreshToken) return false;
      try {
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
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(path: string, init?: RequestInit, allowRetry = true): Promise<T> {
  if (allowRetry) await ensureFreshAccessToken();
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
    throw new Error(await extractMessage(res));
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Pull the API's human-readable `message` out of an error response. */
async function extractMessage(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const body = JSON.parse(raw) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    if (message) return message;
  } catch {
    // non-JSON body — fall through
  }
  return raw || `Request failed (${res.status})`;
}

/** Multipart upload — sends FormData with auth, letting the browser set the boundary. */
async function uploadFile<T>(path: string, file: File): Promise<T> {
  const send = () => {
    const body = new FormData();
    body.append('file', file);
    const access = tokenStore.access();
    return fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body,
    });
  };

  await ensureFreshAccessToken();
  let res = await send();
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await send();
    else emitLogout();
  }
  if (!res.ok) {
    // Surface the API's message (e.g. unsupported type / too large) when present.
    let detail = await res.text();
    try {
      detail = (JSON.parse(detail) as { message?: string }).message ?? detail;
    } catch {
      /* plain text */
    }
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return (await res.json()) as T;
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
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'oldest';
};

/** A hero-carousel slide as edited in the admin. */
export type HeroSlideInput = {
  imageUrl: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
};

export type HeroSlide = HeroSlideInput & {
  id: string;
  sortOrder: number;
  isActive: boolean;
};

/** Lean payload backing the admin dashboard home. */
export type DashboardData = {
  today: {
    date: string;
    count: number;
    totalValue: number;
    profit: number;
    orders: AdminOrderRow[];
  };
  totals: { orders: number; revenue: number; profit: number };
  pendingPayment: { customers: number; orders: number; outstanding: number };
};

/** Rich payload backing the Analytics page. */
export type InsightsData = {
  rangeDays: number;
  period: {
    current: { orders: number; revenue: number; profit: number };
    previous: { orders: number; revenue: number; profit: number };
  };
  customers: { active: number; new: number; returning: number; repeatRate: number };
  trend: Array<{ date: string; orders: number; revenue: number }>;
  topProducts: Array<{
    productId: string;
    title: string;
    sku: string;
    brand: string;
    units: number;
    revenue: number;
  }>;
  topBrands: Array<{ brand: string; units: number; revenue: number }>;
  profitByBrand: Array<{ brand: string; profit: number; revenue: number }>;
  sizes: Array<{ sizeLabel: string; units: number }>;
  sizesByProduct: Array<{
    productId: string;
    title: string;
    units: number;
    sizes: Array<{ sizeLabel: string; units: number }>;
  }>;
  locations: Array<{ city: string; state: string; orders: number; revenue: number }>;
  channel: Array<{ type: string; orders: number; revenue: number }>;
  topCustomers: Array<{ userId: string; name: string; orders: number; spend: number }>;
  receivablesAging: Array<{ bucket: string; label: string; orders: number; amount: number }>;
  stock: {
    outOfStockCount: number;
    lowStockCount: number;
    low: Array<{
      productId: string;
      title: string;
      brand: string;
      sizeLabel: string;
      stock: number;
    }>;
    dead: Array<{ productId: string; title: string; brand: string; stock: number }>;
  };
};

/** One product's row in the Inventory table. */
export type InventoryProductRow = {
  productId: string;
  sku: string;
  title: string;
  brand: string;
  isActive: boolean;
  variants: number;
  units: number;
  lowVariants: number;
  outOfStockVariants: number;
  inhouseCost: number;
  customerPrice: number;
  resellerPrice: number;
  inhouseValue: number;
  retailValue: number;
  status: 'out' | 'low' | 'ok';
  isDead: boolean;
  sizes: Array<{ sizeLabel: string; stock: number }>;
};

/** Payload backing the Inventory page — a current stock snapshot. */
export type InventoryData = {
  generatedAt: string;
  lowStockThreshold: number;
  deadStockDays: number;
  summary: {
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    totalVariants: number;
    totalUnits: number;
    inhouseValue: number;
    retailValue: number;
    resellerValue: number;
    potentialProfit: number;
    outOfStockProducts: number;
    deadStockProducts: number;
    outOfStockVariants: number;
    lowStockVariants: number;
  };
  byBrand: Array<{
    brand: string;
    products: number;
    units: number;
    inhouseValue: number;
    retailValue: number;
  }>;
  products: InventoryProductRow[];
};

/** One customer's outstanding receivable (approved orders awaiting payment). */
export type PaymentPendingUser = {
  userId: string;
  userName: string;
  orderCount: number;
  totalPending: number;
};

export type PaymentPendingRow = {
  id: string;
  orderNumber: string;
  itemsCount: number;
  total: number;
  currency: string;
  createdAt: string;
};

export type PaymentPendingDetail = {
  userId: string;
  userName: string;
  totalPending: number;
  orders: PaymentPendingRow[];
};

/* --------------------------------- Audit log ---------------------------------- */

export const AUDIT_MODULES = [
  'PRODUCTS',
  'ORDERS',
  'USERS',
  'CART',
  'SIZE_TYPES',
  'SIZES',
  'BRANDS',
  'CATEGORIES',
  'PRODUCT_TYPES',
  'DIMENSIONS',
  'AUTH',
] as const;
export type AuditModule = (typeof AUDIT_MODULES)[number];

export const AUDIT_EVENTS = ['CREATION', 'UPDATION', 'DELETION'] as const;
export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export type AuditLogRow = {
  id: string;
  referenceNumber: string | null;
  module: AuditModule;
  moduleId: string | null;
  subModule: string | null;
  event: AuditEvent;
  action: string;
  formData: Record<string, unknown> | null;
  auditedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogList = {
  data: AuditLogRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AuditLogListParams = {
  page?: number;
  limit?: number;
  module?: string;
  event?: string;
  auditedBy?: string;
  referenceNumber?: string;
  from?: string;
  to?: string;
};

export const api = {
  listBrands: () => request<{ id: string; name: string; isActive: boolean }[]>('/brands'),
  listProductTypes: () =>
    request<{ id: string; name: string; isActive: boolean }[]>('/product-types'),
  listCategories: () => request<{ id: string; name: string; isActive: boolean }[]>('/categories'),
  listTags: () => request<{ id: string; name: string; isActive: boolean }[]>('/tags'),
  createMaster: (resource: 'brands' | 'product-types' | 'categories' | 'tags', name: string) =>
    request<{ id: string; name: string; isActive: boolean }>(`/${resource}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateMaster: (
    resource: 'brands' | 'product-types' | 'categories' | 'tags',
    id: string,
    body: { name?: string; isActive?: boolean },
  ) =>
    request<{ id: string; name: string; isActive: boolean }>(`/${resource}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteMaster: (resource: 'brands' | 'product-types' | 'categories' | 'tags', id: string) =>
    request<{ id: string; deleted: boolean }>(`/${resource}/${id}`, { method: 'DELETE' }),
  // Auth
  login: (body: LoginSchema) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }, false),
  me: () => request<PublicUser>('/auth/me'),
  logout: () =>
    request<{ success: boolean }>(
      '/auth/logout',
      { method: 'POST', body: JSON.stringify({ refreshToken: tokenStore.refresh() ?? undefined }) },
      false,
    ),

  // Products
  listProducts: (params?: ProductListParams) =>
    request<Paginated<Product>>(`/products${toQuery(params)}`),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  listProductModels: (brandId?: string) =>
    request<string[]>(`/products/models${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`),
  createProduct: (body: CreateProductSchema) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id: string, body: UpdateProductSchema) =>
    request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProduct: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/products/${id}`, { method: 'DELETE' }),

  // Hero carousel
  getHeroSlides: () => request<HeroSlide[]>('/hero/admin'),
  updateHeroSlides: (slides: HeroSlideInput[]) =>
    request<HeroSlide[]>('/hero', { method: 'PUT', body: JSON.stringify({ slides }) }),

  // Media uploads (→ Cloudflare R2, returns a public CDN URL)
  uploadImage: (file: File) => uploadFile<{ url: string }>('/uploads/image', file),
  uploadVideo: (file: File) => uploadFile<{ url: string }>('/uploads/video', file),
  deleteUpload: (url: string) =>
    request<{ deleted: boolean }>('/uploads', { method: 'DELETE', body: JSON.stringify({ url }) }),

  // Users
  listUsers: (params?: UserListParams) =>
    request<Paginated<AdminUserRow>>(`/users${toQuery(params)}`),
  listResellers: () => request<Paginated<AdminUserRow>>(`/users?role=RESELLER&pageSize=100`),
  disableUser: (id: string) => request<AdminUserRow>(`/users/${id}/disable`, { method: 'PATCH' }),
  enableUser: (id: string) => request<AdminUserRow>(`/users/${id}/enable`, { method: 'PATCH' }),
  makeReseller: (id: string) => request<AdminUserRow>(`/users/${id}/reseller`, { method: 'PATCH' }),
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

  // Dimensions master
  listDimensions: (includeInactive = false) =>
    request<Dimension[]>(`/dimensions${includeInactive ? '?includeInactive=true' : ''}`),
  createDimension: (body: CreateDimensionSchema) =>
    request<Dimension>('/dimensions', { method: 'POST', body: JSON.stringify(body) }),
  updateDimension: (id: string, body: UpdateDimensionSchema) =>
    request<Dimension>(`/dimensions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDimension: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/dimensions/${id}`, { method: 'DELETE' }),

  // Orders
  getDashboard: () => request<DashboardData>('/analytics/dashboard'),
  getInsights: (days: number) => request<InsightsData>(`/analytics/insights?days=${days}`),
  getInventory: () => request<InventoryData>('/analytics/inventory'),
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
  undoOrder: (id: string) => request<Order>(`/orders/${id}/undo`, { method: 'POST' }),

  // Payment-pending receivables (approved orders awaiting payment), grouped by customer
  listPaymentPending: () => request<PaymentPendingUser[]>('/orders/payment-pending'),
  getPaymentPending: (userId: string) =>
    request<PaymentPendingDetail>(`/orders/payment-pending/${userId}`),
  settlePayment: (userId: string) =>
    request<{ settled: number }>(`/orders/payment-pending/${userId}/settle`, { method: 'POST' }),
  createOrder: (body: CreateOrderSchema) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  deleteOrder: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/orders/${id}`, { method: 'DELETE' }),

  // Shipmozo shipments
  shipmozoInfo: () =>
    request<{ result: string; message: string; data: { Info?: string } }>('/shipmozo/info'),
  pushShipment: (orderId: string) =>
    request<{
      shipmentStatus: string;
      shipmozoOrderId: string | null;
      shipmozoReferenceId: string | null;
      courierPartner: string | null;
      trackingId: string | null;
      shipmentError: string | null;
      shipmentPushedAt: string | null;
    }>(`/shipmozo/orders/${orderId}/push`, { method: 'POST' }),
  markManualShipment: (orderId: string, body: { courierPartner: string; trackingId: string }) =>
    request<{
      shipmentStatus: string;
      shipmozoOrderId: string | null;
      shipmozoReferenceId: string | null;
      courierPartner: string | null;
      trackingId: string | null;
      shipmentError: string | null;
      shipmentPushedAt: string | null;
    }>(`/shipmozo/orders/${orderId}/manual-ship`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  attachShipmozoOrder: (orderId: string, body: { shipmozoOrderId: string }) =>
    request<{
      shipmentStatus: string;
      shipmozoOrderId: string | null;
      shipmozoReferenceId: string | null;
      courierPartner: string | null;
      trackingId: string | null;
      shipmentError: string | null;
      shipmentPushedAt: string | null;
    }>(`/shipmozo/orders/${orderId}/attach-shipmozo`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  dropShipment: (orderId: string) =>
    request<{
      shipmentStatus: string;
      shipmozoOrderId: string | null;
      shipmozoReferenceId: string | null;
      courierPartner: string | null;
      trackingId: string | null;
      shipmentError: string | null;
      shipmentPushedAt: string | null;
    }>(`/shipmozo/orders/${orderId}/drop`, { method: 'POST' }),
  // Retry courier assignment on an already-pushed order — never re-pushes, so no
  // duplicate Shipmozo order; tries configured couriers in priority order.
  assignCourier: (orderId: string) =>
    request<{
      shipmentStatus: string;
      shipmozoOrderId: string | null;
      shipmozoReferenceId: string | null;
      courierPartner: string | null;
      trackingId: string | null;
      shipmentError: string | null;
      shipmentPushedAt: string | null;
    }>(`/shipmozo/orders/${orderId}/assign-courier`, { method: 'POST' }),

  // Dimension combinations
  listCombinations: (includeInactive = false) =>
    request<DimensionCombination[]>(
      `/dimension-combinations${includeInactive ? '?includeInactive=true' : ''}`,
    ),
  createCombination: (body: CreateDimensionCombinationSchema) =>
    request<DimensionCombination>('/dimension-combinations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCombination: (id: string, body: UpdateDimensionCombinationSchema) =>
    request<DimensionCombination>(`/dimension-combinations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteCombination: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/dimension-combinations/${id}`, {
      method: 'DELETE',
    }),

  // Credit customers (non-login bulk/credit accounts)
  listCreditCustomers: (params: { page?: number; pageSize?: number; search?: string } = {}) =>
    request<Paginated<CreditCustomer>>(`/credit-customers${toQuery(params)}`),
  getCreditCustomer: (id: string) => request<CreditCustomer>(`/credit-customers/${id}`),
  createCreditCustomer: (body: CreateCreditCustomerSchema) =>
    request<CreditCustomer>('/credit-customers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCreditCustomer: (id: string, body: UpdateCreditCustomerSchema) =>
    request<CreditCustomer>(`/credit-customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteCreditCustomer: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/credit-customers/${id}`, { method: 'DELETE' }),

  // Settings — Shipmozo config
  getShipmozoSettings: () => request<ShipmozoSetting>('/settings/shipmozo'),
  updateShipmozoSettings: (body: UpdateShipmozoSettingSchema) =>
    request<ShipmozoSetting>('/settings/shipmozo', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // Courier config
  listCourierConfigs: () => request<CourierConfig[]>('/courier-config'),
  getCourierConfig: (id: string) => request<CourierConfig>(`/courier-config/${id}`),
  getCourierConfigByWeightSlab: (weightSlab: string) =>
    request<CourierConfig>(`/courier-config/weight-slab/${weightSlab}`),
  createCourierConfig: (body: {
    weightSlab: string;
    courierCompanyId: string;
    courierCompanyServiceTypeId: string;
    label?: string | null;
    priority?: number;
  }) =>
    request<CourierConfig>('/courier-config', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCourierConfig: (
    id: string,
    body: {
      courierCompanyId?: string;
      courierCompanyServiceTypeId?: string;
      label?: string | null;
      priority?: number;
    },
  ) =>
    request<CourierConfig>(`/courier-config/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteCourierConfig: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/courier-config/${id}`, { method: 'DELETE' }),

  // Audit log
  listAuditLogs: (params?: AuditLogListParams) =>
    request<AuditLogList>(`/audit-logs${toQuery(params)}`),
  getAuditLog: (id: string) => request<AuditLogRow>(`/audit-logs/${id}`),
};
