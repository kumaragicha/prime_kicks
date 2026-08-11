'use client';

import { DeleteIcon, EditIcon, IconButton, Toggle } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCombinationMutations, useCombinations, useDimensions } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { formatDimension, type DimensionCombination } from '@prime-kicks/types';
import { Button } from '@prime-kicks/ui';
import { useState, type ReactNode } from 'react';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

type Row = { dimensionId: string; quantity: string };
const emptyRow: Row = { dimensionId: '', quantity: '1' };

export default function CombinationsPage({ topSection }: { topSection?: ReactNode }) {
  const { data: dimensions } = useDimensions(true);
  const { data: combos, isLoading } = useCombinations(true);
  const { create, update, remove } = useCombinationMutations();
  const { success, error } = useToast();
  const onError = (e: unknown) => error(e instanceof Error ? e.message : 'Something went wrong.');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [boxId, setBoxId] = useState('');
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const [deleting, setDeleting] = useState<DimensionCombination | null>(null);

  const dimName = (id: string) => dimensions?.find((d) => d.id === id)?.name ?? '—';

  const reset = () => {
    setEditingId(null);
    setName('');
    setWeight('');
    setBoxId('');
    setRows([{ ...emptyRow }]);
  };

  const startEdit = (c: DimensionCombination) => {
    setEditingId(c.id);
    setName(c.name);
    setWeight(String(c.weight));
    setBoxId(c.boxDimensionId);
    setRows(c.items.map((i) => ({ dimensionId: i.dimensionId, quantity: String(i.quantity) })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = () => {
    const items = rows
      .filter((r) => r.dimensionId && Number(r.quantity) > 0)
      .map((r) => ({ dimensionId: r.dimensionId, quantity: Number(r.quantity) }));
    const w = Number(weight);
    if (!name.trim() || !(w > 0) || !boxId || items.length === 0) {
      error('Enter a name, a positive weight, a box, and at least one recipe row.');
      return;
    }
    if (new Set(items.map((i) => i.dimensionId)).size !== items.length) {
      error('Each dimension can appear only once in a combination.');
      return;
    }
    const body = { name: name.trim(), weight: w, boxDimensionId: boxId, items };
    if (editingId) {
      update.mutate(
        { id: editingId, body },
        { onSuccess: () => { success('Combination updated.'); reset(); }, onError },
      );
    } else {
      create.mutate(
        { ...body, isActive: true },
        { onSuccess: () => { success('Combination created.'); reset(); }, onError },
      );
    }
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      {/* Dimension Master + combinations list (left, primary) */}
      <div>
        {topSection}
        <h1 className={`text-2xl font-bold${topSection ? ' mt-12' : ''}`}>Dimension Combinations</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Rules for multi-unit orders: when an order&apos;s box mix exactly matches a recipe, its
          weight &amp; box are used. Single-unit orders use the product&apos;s own dimension.
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {isLoading && <p className="p-5 text-sm text-neutral-500">Loading…</p>}
          {combos?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-neutral-100 p-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-neutral-500">{c.weight} kg</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {c.items.map((i) => `${dimName(i.dimensionId)} ×${i.quantity}`).join(' + ')} → box{' '}
                  {dimName(c.boxDimensionId)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Toggle
                  checked={c.isActive}
                  disabled={update.isPending}
                  label={`${c.isActive ? 'Disable' : 'Enable'} ${c.name}`}
                  onCheckedChange={(isActive) => update.mutate({ id: c.id, body: { isActive } }, { onError })}
                />
                <IconButton label={`Edit ${c.name}`} onClick={() => startEdit(c)}>
                  <EditIcon />
                </IconButton>
                <IconButton label={`Delete ${c.name}`} tone="danger" onClick={() => setDeleting(c)}>
                  <DeleteIcon />
                </IconButton>
              </div>
            </div>
          ))}
          {!isLoading && combos?.length === 0 && (
            <p className="p-5 text-sm text-neutral-500">No combinations yet.</p>
          )}
        </div>
      </div>

      {/* Create / edit form (right, sticky, top of page) */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 lg:sticky lg:top-4">
          <h2 className="text-sm font-semibold">
            {editingId ? 'Edit combination' : 'New combination'}
          </h2>
          <div className="mt-4 grid gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">Name</span>
              <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 4 × Small" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">Weight (kg)</span>
              <input type="number" min={0} step="0.1" className={fieldClass} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600">Box to apply</span>
              <select className={fieldClass} value={boxId} onChange={(e) => setBoxId(e.target.value)}>
                <option value="">Select box dimension</option>
                {dimensions?.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} · {formatDimension(d)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4">
            <span className="text-xs font-medium text-neutral-600">Recipe (dimensions &amp; counts)</span>
            <div className="mt-2 flex flex-col gap-2">
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_72px_auto] gap-2">
                  <select
                    className={fieldClass}
                    value={row.dimensionId}
                    onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, dimensionId: e.target.value } : r)))}
                  >
                    <option value="">Select dimension</option>
                    {dimensions?.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className={fieldClass}
                    value={row.quantity}
                    onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)))}
                    placeholder="Qty"
                  />
                  <IconButton
                    label="Remove row"
                    tone="danger"
                    onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : rs))}
                  >
                    <DeleteIcon />
                  </IconButton>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-sm text-neutral-600 underline hover:text-neutral-900"
              onClick={() => setRows((rs) => [...rs, { ...emptyRow }])}
            >
              + Add dimension
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              {editingId ? 'Save changes' : 'Create combination'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
        </div>

      {/* ConfirmDialog lives inside the grid root; it renders as a fixed overlay. */}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete combination?"
        description={deleting ? `“${deleting.name}” will be permanently deleted.` : ''}
        error={remove.error instanceof Error ? remove.error.message : undefined}
        isConfirming={remove.isPending}
        onClose={() => { setDeleting(null); remove.reset(); }}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
