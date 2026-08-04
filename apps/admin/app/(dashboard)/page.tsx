'use client';

import { DeleteIcon, EditIcon, IconButton, IconLink } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { controlClass, DataTable, Pagination } from '@/components/table-controls';
import { useDebouncedValue, useDeleteProduct, useProducts, useSizeTypes } from '@/lib/hooks';
import type { Product } from '@prime-kicks/types';
import { Button } from '@prime-kicks/ui';
import { formatCurrency } from '@prime-kicks/utils';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const columnHelper = createColumnHelper<Product>();
const PAGE_SIZE = 10;

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sizeTypeId, setSizeTypeId] = useState('');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const debouncedSearch = useDebouncedValue(search);
  const { data: sizeTypes } = useSizeTypes();
  const { data, isLoading, isError, isFetching } = useProducts({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    sizeTypeId: sizeTypeId || undefined,
  });
  const deleteProduct = useDeleteProduct();

  const resetTo =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

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
                <img src={src} alt={c.row.original.name} className="h-full w-full object-cover" />
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
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Action</div>,
        cell: (c) => (
          <div className="flex justify-end gap-1 items-center">
            <IconLink
              href={`/products/${c.row.original.id}/edit`}
              label={`Edit ${c.row.original.name}`}
            >
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
    [],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/products/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">+ Add product</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          className={`${controlClass} w-full sm:min-w-56 sm:flex-1`}
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => resetTo(setSearch)(e.target.value)}
        />
        <select
          className={`${controlClass} w-full sm:w-auto`}
          value={sizeTypeId}
          onChange={(e) => resetTo(setSizeTypeId)(e.target.value)}
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
          />

          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            onPage={setPage}
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
