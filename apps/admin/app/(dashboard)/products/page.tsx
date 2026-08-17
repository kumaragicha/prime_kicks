'use client';

import { DeleteIcon, EditIcon, IconButton, IconLink, Toggle } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { controlClass, DataTable, Pagination, selectClass } from '@/components/table-controls';
import {
  useDebouncedValue,
  useDeleteProduct,
  useProducts,
  useSetProductActive,
  useSizeTypes,
} from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { Product } from '@prime-kicks/types';
import { Badge, Button } from '@prime-kicks/ui';
import { formatCurrency } from '@prime-kicks/utils';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

const columnHelper = createColumnHelper<Product>();
const PAGE_SIZE = 10;

/**
 * The list's page and filters live in the URL, not in component state: leaving
 * for an edit and coming back (or reloading, or sharing the link) has to land on
 * the same page of the same filtered set, and state would be lost on navigation.
 * Every edit link carries the current query as `from` so the edit page knows
 * where "back" is.
 */
function ProductsList() {
  const router = useRouter();
  const params = useSearchParams();

  const page = Math.max(1, Number(params.get('page')) || 1);
  const searchParam = params.get('q') ?? '';
  const sizeTypeId = params.get('sizeType') ?? '';

  // The input stays local and only reaches the URL once typing settles — one
  // history write per pause instead of one per keystroke.
  const [search, setSearch] = useState(searchParam);
  const debouncedSearch = useDebouncedValue(search);

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const { data: sizeTypes } = useSizeTypes();
  const { data, isLoading, isError, isFetching } = useProducts({
    page,
    pageSize: PAGE_SIZE,
    search: searchParam || undefined,
    sizeTypeId: sizeTypeId || undefined,
  });
  const deleteProduct = useDeleteProduct();
  const setActive = useSetProductActive();
  const toast = useToast();

  const setQuery = useCallback(
    (next: { page?: number; q?: string; sizeType?: string }) => {
      const merged = { page, q: searchParam, sizeType: sizeTypeId, ...next };
      const qs = new URLSearchParams();
      // Defaults stay out of the URL so page 1 unfiltered is just `/products`.
      if (merged.page > 1) qs.set('page', String(merged.page));
      if (merged.q) qs.set('q', merged.q);
      if (merged.sizeType) qs.set('sizeType', merged.sizeType);
      const query = qs.toString();
      router.replace(query ? `/products?${query}` : '/products', { scroll: false });
    },
    [page, searchParam, sizeTypeId, router],
  );

  // A new search or filter always restarts at page 1 — page 10 of the previous
  // result set means nothing for the new one.
  useEffect(() => {
    if (debouncedSearch !== searchParam) setQuery({ q: debouncedSearch, page: 1 });
  }, [debouncedSearch, searchParam, setQuery]);

  const listQuery = params.toString();
  const editHref = useCallback(
    (id: string) =>
      `/products/${id}/edit${listQuery ? `?from=${encodeURIComponent(listQuery)}` : ''}`,
    [listQuery],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'cover',
        header: '',
        cell: (c) => {
          const src = c.row.original.photoUrls?.[0];
          return (
            <div className="h-11 w-11 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={c.row.original.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[9px] font-medium text-neutral-400">
                  No image
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('brand', { header: 'Brand' }),
      columnHelper.accessor((row) => row.sizeType?.name ?? '—', {
        id: 'sizeType',
        header: 'Size type',
      }),
      columnHelper.accessor('totalStock', { header: 'Stock' }),
      columnHelper.accessor('inhouseCost', {
        header: 'Cost',
        cell: (c) => formatCurrency(c.getValue() ?? 0, c.row.original.currency),
      }),
      columnHelper.accessor('resellerPrice', {
        header: 'Reseller',
        cell: (c) => formatCurrency(c.getValue() ?? 0, c.row.original.currency),
      }),
      columnHelper.accessor('customerPrice', {
        header: 'Customer',
        cell: (c) => formatCurrency(c.getValue() ?? 0, c.row.original.currency),
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: (c) => (
          <Badge tone={c.getValue() ? 'success' : 'danger'}>
            {c.getValue() ? 'Active' : 'Inactive'}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Action</div>,
        cell: (c) => (
          // Stop propagation so acting on a product never triggers the row's
          // click-through to the edit page.
          <div
            className="flex justify-end gap-1 items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Toggle
              checked={c.row.original.isActive}
              label={`${c.row.original.isActive ? 'Deactivate' : 'Activate'} ${c.row.original.name}`}
              disabled={setActive.isPending}
              onCheckedChange={(isActive) =>
                setActive.mutate(
                  { id: c.row.original.id, isActive },
                  { onError: (e: Error) => toast.error(e.message) },
                )
              }
            />
            <IconLink href={editHref(c.row.original.id)} label={`Edit ${c.row.original.name}`}>
              <EditIcon />
            </IconLink>
            <IconButton
              label={`Delete ${c.row.original.name}`}
              tone="danger"
              onClick={() => setProductToDelete(c.row.original)}
            >
              <DeleteIcon />
            </IconButton>
          </div>
        ),
      }),
    ],
    [setActive, toast, editHref],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">
          Products
          {data && (
            <span className="ml-2 text-base font-medium text-neutral-500">
              ({data.meta.total})
            </span>
          )}
        </h1>
        <Link href="/products/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">+ Add product</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          className={`${controlClass} w-full sm:min-w-56 sm:flex-1`}
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${selectClass} w-full sm:w-auto`}
          value={sizeTypeId}
          onChange={(e) => setQuery({ sizeType: e.target.value, page: 1 })}
        >
          <option value="">All size types</option>
          {sizeTypes?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-neutral-500">Loading…</p>}
      {isError && <p className="text-red-600">Failed to load. Is the API running on port 4000?</p>}

      {data && (
        <>
          <DataTable
            table={table}
            isFetching={isFetching}
            emptyMessage="No products match your filters."
            onRowClick={(product) => router.push(editHref(product.id))}
          />

          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            onPage={(next) => setQuery({ page: next })}
          />
        </>
      )}

      <ConfirmDialog
        open={productToDelete !== null}
        title="Delete product?"
        description={
          productToDelete
            ? `“${productToDelete.name}” will be removed from your store. Past orders that include it stay intact.`
            : ''
        }
        error={deleteError}
        isConfirming={deleteProduct.isPending}
        onClose={() => {
          setProductToDelete(null);
          setDeleteError('');
        }}
        onConfirm={() => {
          if (productToDelete) {
            setDeleteError('');
            deleteProduct.mutate(productToDelete.id, {
              onSuccess: () => setProductToDelete(null),
              onError: (e) =>
                setDeleteError(e instanceof Error ? e.message : 'Could not delete this product.'),
            });
          }
        }}
      />
    </div>
  );
}

// `useSearchParams` needs a boundary to suspend against while the client shell
// hydrates.
export default function ProductsPage() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
      <ProductsList />
    </Suspense>
  );
}
