'use client';

import { DeleteIcon, IconButton, Toggle } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { controlClass, Pagination } from '@/components/table-controls';
import { useAuth } from '@/lib/auth';
import { useDeleteUser, useMakeReseller, useSetUserActive, useUsers } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { AdminUserRow } from '@prime-kicks/types';
import { Badge, Button } from '@prime-kicks/ui';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';

const columnHelper = createColumnHelper<AdminUserRow>();
const PAGE_SIZE = 10;

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [userToDelete, setUserToDelete] = useState<AdminUserRow | null>(null);

  const { data, isLoading, isError, isFetching } = useUsers({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    role: role || undefined,
    status: status || undefined,
  });
  const setActive = useSetUserActive();
  const deleteUser = useDeleteUser();
  const makeReseller = useMakeReseller();
  const handleMakeReseller = useCallback(
    (id: string, name: string) =>
      makeReseller.mutate(id, {
        onSuccess: () => toast.success(`${name} is now a reseller`),
        onError: (error: Error) => toast.error(error.message),
      }),
    [makeReseller, toast],
  );

  const resetTo =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('email', { header: 'Email' }),
      columnHelper.accessor('mobileNo', { header: 'Mobile' }),
      columnHelper.accessor((row) => `${row.city}, ${row.state}`, {
        id: 'location',
        header: 'Location',
      }),
      columnHelper.accessor('role', {
        header: 'Role',
        cell: (c) => <Badge>{c.getValue()}</Badge>,
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: (c) => (
          <Badge tone={c.getValue() ? 'success' : 'danger'}>
            {c.getValue() ? 'Active' : 'Disabled'}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Action</div>,
        cell: (c) => {
          const user = c.row.original;
          const isSelf = currentUser?.id === user.id;
          if (isSelf) {
            return (
              <div className="flex justify-end">
                <Badge tone="neutral">You</Badge>
              </div>
            );
          }
          return (
            <div className="flex justify-end gap-1 items-center">
              {user.role === 'CUSTOMER' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={makeReseller.isPending}
                  onClick={() => handleMakeReseller(user.id, user.name)}
                >
                  Reseller
                </Button>
              )}
              <Toggle
                checked={user.isActive}
                label={`${user.isActive ? 'Disable' : 'Enable'} ${user.name}`}
                disabled={setActive.isPending}
                onCheckedChange={(isActive) => setActive.mutate({ id: user.id, isActive })}
              />
              <IconButton
                label={`Delete ${user.name}`}
                tone="danger"
                onClick={() => setUserToDelete(user)}
              >
                <DeleteIcon />
              </IconButton>
            </div>
          );
        },
      }),
    ],
    [handleMakeReseller, setActive, currentUser?.id],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Users</h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          className={`${controlClass} w-full sm:min-w-56 sm:flex-1`}
          placeholder="Search name, email, mobile…"
          value={search}
          onChange={(e) => resetTo(setSearch)(e.target.value)}
        />
        <select
          className={`${controlClass} w-full sm:w-auto`}
          value={role}
          onChange={(e) => resetTo(setRole)(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="RESELLER">Reseller</option>
          <option value="CUSTOMER">Customer</option>
        </select>
        <select
          className={`${controlClass} w-full sm:w-auto`}
          value={status}
          onChange={(e) => resetTo(setStatus)(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {isLoading && <p className="text-neutral-500">Loading…</p>}
      {isError && (
        <p className="text-red-600">
          Failed to load. This section is restricted to ADMIN accounts.
        </p>
      )}

      {data && (
        <>
          <div
            className="overflow-x-auto rounded-lg border border-neutral-200 bg-white"
            style={{ opacity: isFetching ? 0.6 : 1 }}
          >
            <table className="min-w-[760px] w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3 font-medium text-neutral-600">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-neutral-500">
                      No users match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            onPage={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={userToDelete !== null}
        title="Delete user?"
        description={
          userToDelete
            ? `“${userToDelete.name}” will be permanently deleted. This cannot be undone.`
            : ''
        }
        isConfirming={deleteUser.isPending}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => {
          if (userToDelete) {
            deleteUser.mutate(userToDelete.id, { onSuccess: () => setUserToDelete(null) });
          }
        }}
      />
    </div>
  );
}
