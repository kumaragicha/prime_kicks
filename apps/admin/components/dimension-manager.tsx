'use client';

import { useState } from 'react';
import { Button } from '@prime-kicks/ui';
import { formatDimension, type Dimension } from '@prime-kicks/types';
import { useDimensionMutations } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { DeleteIcon, EditIcon, IconButton, Toggle } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

type Draft = { name: string; weight: string; length: string; width: string; height: string };
const emptyDraft: Draft = { name: '', weight: '', length: '', width: '', height: '' };

/** Parse a draft into a numeric payload, or return null if anything is invalid. */
function parseDraft(
  draft: Draft,
): { name: string; weight: number; length: number; width: number; height: number } | null {
  const name = draft.name.trim();
  const weight = Number(draft.weight);
  const length = Number(draft.length);
  const width = Number(draft.width);
  const height = Number(draft.height);
  if (!name || !(weight > 0) || !(length > 0) || !(width > 0) || !(height > 0)) return null;
  return { name, weight, length, width, height };
}

export function DimensionManager({ items, loading }: { items?: Dimension[]; loading: boolean }) {
  const [creating, setCreating] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [deleting, setDeleting] = useState<Dimension | null>(null);
  const { create, update, remove } = useDimensionMutations();
  const { error: toastError } = useToast();
  const onError = (e: Error) => toastError(e.message);

  const add = () => {
    const payload = parseDraft(creating);
    if (!payload) {
      toastError('Enter a name and positive weight, length, width and height.');
      return;
    }
    create.mutate({ ...payload, isActive: true }, { onSuccess: () => setCreating(emptyDraft), onError });
  };

  const saveEdit = (id: string) => {
    const payload = parseDraft(editDraft);
    if (!payload) {
      toastError('Enter a name and positive weight, length, width and height.');
      return;
    }
    update.mutate({ id, body: payload }, { onSuccess: () => setEditingId(null), onError });
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Dimensions</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Physical dimensions (in centimetres). One dimension can be selected for each product.
      </p>

      {/* Create row */}
      <div className="mt-6 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-600">Name</span>
          <input
            className={fieldClass}
            value={creating.name}
            onChange={(e) => setCreating((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Standard Box"
          />
        </label>
        <NumberField label="Weight" unit="kg" value={creating.weight} onChange={(v) => setCreating((d) => ({ ...d, weight: v }))} />
        <NumberField label="Length" value={creating.length} onChange={(v) => setCreating((d) => ({ ...d, length: v }))} />
        <NumberField label="Width" value={creating.width} onChange={(v) => setCreating((d) => ({ ...d, width: v }))} />
        <NumberField label="Height" value={creating.height} onChange={(v) => setCreating((d) => ({ ...d, height: v }))} />
        <Button onClick={add} disabled={create.isPending}>
          Add
        </Button>
      </div>

      {/* List */}
      <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {loading && <p className="p-5 text-sm text-neutral-500">Loading…</p>}
        {items?.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="grid gap-2 border-b border-neutral-100 p-3 last:border-0 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] sm:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-neutral-600">Name</span>
                <input
                  autoFocus
                  className={fieldClass}
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <NumberField label="Weight" unit="kg" value={editDraft.weight} onChange={(v) => setEditDraft((d) => ({ ...d, weight: v }))} />
              <NumberField label="Length" value={editDraft.length} onChange={(v) => setEditDraft((d) => ({ ...d, length: v }))} />
              <NumberField label="Width" value={editDraft.width} onChange={(v) => setEditDraft((d) => ({ ...d, width: v }))} />
              <NumberField label="Height" value={editDraft.height} onChange={(v) => setEditDraft((d) => ({ ...d, height: v }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEdit(item.id)} disabled={update.isPending}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div key={item.id} className="flex items-center gap-3 border-b border-neutral-100 p-3 last:border-0">
              <div className="flex-1">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {item.weight} kg · {formatDimension(item)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Toggle
                  checked={item.isActive}
                  disabled={update.isPending}
                  label={`${item.isActive ? 'Disable' : 'Enable'} ${item.name}`}
                  onCheckedChange={(isActive) =>
                    update.mutate({ id: item.id, body: { isActive } }, { onError })
                  }
                />
                <IconButton
                  label={`Edit ${item.name}`}
                  onClick={() => {
                    setEditingId(item.id);
                    setEditDraft({
                      name: item.name,
                      weight: String(item.weight),
                      length: String(item.length),
                      width: String(item.width),
                      height: String(item.height),
                    });
                  }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton label={`Delete ${item.name}`} tone="danger" onClick={() => setDeleting(item)}>
                  <DeleteIcon />
                </IconButton>
              </div>
            </div>
          ),
        )}
        {!loading && items?.length === 0 && <p className="p-5 text-sm text-neutral-500">No records yet.</p>}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete dimension?"
        description={deleting ? `“${deleting.name}” will be permanently deleted.` : ''}
        error={remove.error instanceof Error ? remove.error.message : undefined}
        isConfirming={remove.isPending}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  unit = 'cm',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-600">
        {label} ({unit})
      </span>
      <input
        type="number"
        min={0}
        step="0.1"
        className={fieldClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
