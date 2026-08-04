'use client';

import { DeleteIcon, EditIcon, IconButton, Toggle } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { controlClass } from '@/components/table-controls';
import {
  useAddSize,
  useCreateSizeType,
  useDeleteSize,
  useDeleteSizeType,
  useSizeTypes,
  useUpdateSize,
  useUpdateSizeType,
} from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { Size, SizeType } from '@prime-kicks/types';
import { Badge, Button, Card, CardContent, CardHeader } from '@prime-kicks/ui';
import { useState } from 'react';

export default function SizeTypesPage() {
  const { data: sizeTypes, isLoading, isError } = useSizeTypes(true);
  const createType = useCreateSizeType();
  const { error: toastError } = useToast();
  const [newName, setNewName] = useState('');

  const addType = () => {
    const name = newName.trim();
    if (!name) return;
    createType.mutate(
      { name, isActive: true, sizes: [] },
      { onSuccess: () => setNewName(''), onError: (e: Error) => toastError(e.message) },
    );
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Sizes master</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Manage size systems (Nike, Adidas, Crocs…) and the sizes within each. Products pick one size
        type and hold stock per size.
      </p>

      <div className="mb-8 flex flex-col gap-2 sm:flex-row">
        <input
          className={`${controlClass} flex-1`}
          placeholder="New size type name, e.g. New Balance"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addType()}
        />
        <Button className="w-full sm:w-auto" onClick={addType} disabled={createType.isPending}>
          Add size type
        </Button>
      </div>

      {isLoading && <p className="text-neutral-500">Loading…</p>}
      {isError && <p className="text-red-600">Failed to load. ADMIN access required.</p>}

      <div className="flex flex-col gap-4">
        {sizeTypes?.map((type) => (
          <SizeTypeCard key={type.id} type={type} />
        ))}
        {sizeTypes?.length === 0 && (
          <p className="text-sm text-neutral-500">No size types yet — add one above.</p>
        )}
      </div>
    </div>
  );
}

function SizeTypeCard({ type }: { type: SizeType }) {
  const updateType = useUpdateSizeType();
  const deleteType = useDeleteSizeType();
  const addSize = useAddSize();
  const { error: toastError } = useToast();

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(type.name);
  const [label, setLabel] = useState('');
  const [conversion, setConversion] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const onError = (e: Error) => toastError(e.message);

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== type.name) {
      updateType.mutate({ id: type.id, body: { name: trimmed } }, { onError });
    }
    setRenaming(false);
  };

  const submitSize = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    addSize.mutate(
      {
        sizeTypeId: type.id,
        body: {
          label: trimmed,
          conversion: conversion.trim() || null,
          sortOrder: type.sizes.length + 1,
          isActive: true,
        },
      },
      {
        onSuccess: () => {
          setLabel('');
          setConversion('');
        },
        onError,
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {renaming ? (
            <>
              <input
                className={`${controlClass} w-48`}
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') {
                    setName(type.name);
                    setRenaming(false);
                  }
                }}
              />
              <Button size="sm" onClick={saveName}>
                Save
              </Button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="text-lg font-semibold hover:underline"
                onClick={() => setRenaming(true)}
                title="Rename"
              >
                {type.name}
              </button>
              <Badge tone={type.isActive ? 'success' : 'neutral'}>
                {type.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <span className="text-sm text-neutral-500">{type.sizes.length} sizes</span>
            </>
          )}
        </div>
        <div className="flex gap-1 items-center self-end sm:self-auto">
          <Toggle
            checked={type.isActive}
            label={`${type.isActive ? 'Disable' : 'Enable'} ${type.name}`}
            disabled={updateType.isPending}
            onCheckedChange={(isActive) =>
              updateType.mutate({ id: type.id, body: { isActive } }, { onError })
            }
          />
          <IconButton
            label={`Delete ${type.name}`}
            tone="danger"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <DeleteIcon />
          </IconButton>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="min-w-[440px] w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Conversion</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {type.sizes.map((size) => (
                <SizeRow key={size.id} size={size} />
              ))}
              {type.sizes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-neutral-500">
                    No sizes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className={`${controlClass} w-28`}
            placeholder="Label (36)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSize()}
          />
          <input
            className={`${controlClass} w-36`}
            placeholder="Conversion (UK 3)"
            value={conversion}
            onChange={(e) => setConversion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSize()}
          />
          <Button variant="secondary" size="sm" onClick={submitSize} disabled={addSize.isPending}>
            Add size
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete size type?"
        description={`“${type.name}” and its sizes will be permanently deleted.`}
        error={deleteType.error instanceof Error ? deleteType.error.message : undefined}
        isConfirming={deleteType.isPending}
        onClose={() => {
          setDeleteDialogOpen(false);
          deleteType.reset();
        }}
        onConfirm={() =>
          deleteType.mutate(type.id, { onSuccess: () => setDeleteDialogOpen(false) })
        }
      />
    </Card>
  );
}

function SizeRow({ size }: { size: Size }) {
  const updateSize = useUpdateSize();
  const deleteSize = useDeleteSize();
  const { error: toastError } = useToast();

  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(size.label);
  const [conversion, setConversion] = useState(size.conversion ?? '');
  const [sortOrder, setSortOrder] = useState(String(size.sortOrder));
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const save = () => {
    updateSize.mutate(
      {
        id: size.id,
        body: {
          label: label.trim() || size.label,
          conversion: conversion.trim() || null,
          sortOrder: Number(sortOrder) || 0,
        },
      },
      { onSuccess: () => setEditing(false), onError: (e: Error) => toastError(e.message) },
    );
  };

  if (editing) {
    return (
      <tr className="border-b border-neutral-100 last:border-0">
        <td className="px-3 py-2">
          <input
            className={`${controlClass} w-20`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </td>
        <td className="px-3 py-2">
          <input
            className={`${controlClass} w-28`}
            value={conversion}
            onChange={(e) => setConversion(e.target.value)}
          />
        </td>
        <td className="px-3 py-2">
          <input
            type="number"
            className={`${controlClass} w-16`}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1 items-center">
            <Button size="sm" onClick={save} disabled={updateSize.isPending}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-neutral-100 last:border-0">
        <td className="px-3 py-2 font-medium">{size.label}</td>
        <td className="px-3 py-2 text-neutral-500">{size.conversion ?? '—'}</td>
        <td className="px-3 py-2 text-neutral-500">{size.sortOrder}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1 items-center">
            <IconButton label={`Edit size ${size.label}`} onClick={() => setEditing(true)}>
              <EditIcon />
            </IconButton>
            <IconButton
              label={`Delete size ${size.label}`}
              tone="danger"
              onClick={() => setDeleteDialogOpen(true)}
              title={deleteSize.isError ? 'Size is used by a product' : undefined}
            >
              <DeleteIcon />
            </IconButton>
          </div>
        </td>
      </tr>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete size?"
        description={`“${size.label}” will be permanently deleted.`}
        error={deleteSize.error instanceof Error ? deleteSize.error.message : undefined}
        isConfirming={deleteSize.isPending}
        onClose={() => {
          setDeleteDialogOpen(false);
          deleteSize.reset();
        }}
        onConfirm={() =>
          deleteSize.mutate(size.id, { onSuccess: () => setDeleteDialogOpen(false) })
        }
      />
    </>
  );
}
