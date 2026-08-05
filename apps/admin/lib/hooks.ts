'use client';

import type { PaymentStatus } from '@prime-kicks/types';
import type {
  CreateOrderSchema,
  CreateProductSchema,
  CreateSizeSchema,
  CreateSizeTypeSchema,
  UpdateProductSchema,
  UpdateSizeSchema,
  UpdateSizeTypeSchema,
} from '@prime-kicks/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  api,
  type AuditLogListParams,
  type OrderListParams,
  type ProductListParams,
  type UserListParams,
} from './api';

/* ---------------------------------- Utilities --------------------------------- */

/**
 * Debounce a rapidly-changing value (e.g. a search box). The input stays
 * responsive while the returned value only settles `delay`ms after the last
 * change — so list queries fire once the user pauses, not on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ---------------------------------- Products ---------------------------------- */

export function useProducts(params?: ProductListParams) {
  return useQuery({
    queryKey: ['products', params ?? {}],
    queryFn: () => api.listProducts(params),
    placeholderData: (prev) => prev,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.getProduct(id),
    enabled: Boolean(id),
  });
}

export const useBrands = () => useQuery({ queryKey: ['brands'], queryFn: api.listBrands });
export const useProductTypes = () =>
  useQuery({ queryKey: ['product-types'], queryFn: api.listProductTypes });
export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: api.listCategories });

export function useMasterMutations(resource: 'brands' | 'product-types' | 'categories') {
  const qc = useQueryClient();
  const key =
    resource === 'brands'
      ? ['brands']
      : resource === 'product-types'
        ? ['product-types']
        : ['categories'];
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  return {
    create: useMutation({
      mutationFn: (name: string) => api.createMaster(resource, name),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: { name?: string; isActive?: boolean } }) =>
        api.updateMaster(resource, id, body),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteMaster(resource, id),
      onSuccess: refresh,
    }),
  };
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductSchema) => api.createProduct(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProductSchema) => api.updateProduct(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product', id] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

/* ----------------------------------- Users ------------------------------------ */

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: ['users', params ?? {}],
    queryFn: () => api.listUsers(params),
    placeholderData: (prev) => prev,
  });
}

export function useResellers() {
  return useQuery({
    queryKey: ['resellers'],
    queryFn: () => api.listResellers(),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive ? api.enableUser(id) : api.disableUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useMakeReseller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.makeReseller(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['resellers'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

/* -------------------------------- Sizes master -------------------------------- */

export function useSizeTypes(includeInactive = false) {
  return useQuery({
    queryKey: ['size-types', { includeInactive }],
    queryFn: () => api.listSizeTypes(includeInactive),
  });
}

function useSizeMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['size-types'] }),
  });
}

export const useCreateSizeType = () =>
  useSizeMutation((body: CreateSizeTypeSchema) => api.createSizeType(body));

export const useUpdateSizeType = () =>
  useSizeMutation(({ id, body }: { id: string; body: UpdateSizeTypeSchema }) =>
    api.updateSizeType(id, body),
  );

export const useDeleteSizeType = () => useSizeMutation((id: string) => api.deleteSizeType(id));

export const useAddSize = () =>
  useSizeMutation(({ sizeTypeId, body }: { sizeTypeId: string; body: CreateSizeSchema }) =>
    api.addSize(sizeTypeId, body),
  );

export const useUpdateSize = () =>
  useSizeMutation(({ id, body }: { id: string; body: UpdateSizeSchema }) =>
    api.updateSize(id, body),
  );

export const useDeleteSize = () => useSizeMutation((id: string) => api.deleteSize(id));

/* ----------------------------------- Orders ------------------------------------ */

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    placeholderData: (prev) => prev,
  });
}

export function useInsights(days: number) {
  return useQuery({
    queryKey: ['insights', days],
    queryFn: () => api.getInsights(days),
    placeholderData: (prev) => prev,
  });
}

export function useOrders(params?: OrderListParams) {
  return useQuery({
    queryKey: ['orders', params ?? {}],
    queryFn: () => api.listOrders(params),
    placeholderData: (prev) => prev,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => api.getOrder(id),
    enabled: Boolean(id),
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderSchema) => api.createOrder(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/* ------------------------------ Payment pending -------------------------------- */

export function usePaymentPending() {
  return useQuery({
    queryKey: ['payment-pending'],
    queryFn: () => api.listPaymentPending(),
  });
}

export function usePaymentPendingUser(userId: string) {
  return useQuery({
    queryKey: ['payment-pending', userId],
    queryFn: () => api.getPaymentPending(userId),
    enabled: Boolean(userId),
  });
}

export function useSettlePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.settlePayment(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-pending'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/* ---------------------------------- Audit log --------------------------------- */

export function useAuditLogs(params?: AuditLogListParams) {
  return useQuery({
    queryKey: ['audit-logs', params ?? {}],
    queryFn: () => api.listAuditLogs(params),
    placeholderData: (prev) => prev,
  });
}

export function useApproveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentStatus }: { id: string; paymentStatus: PaymentStatus }) =>
      api.approveOrder(id, paymentStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order'] });
    },
  });
}

export function useRejectOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.rejectOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order'] });
    },
  });
}

export function useUndoOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.undoOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order'] });
    },
  });
}
