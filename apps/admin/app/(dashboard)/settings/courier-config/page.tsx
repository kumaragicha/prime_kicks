'use client';

import { DeleteIcon, EditIcon, IconButton } from '@/components/action-controls';
import { useCourierConfigMutations, useCourierConfigs } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CourierConfig } from '@prime-kicks/types';
import { Button } from '@prime-kicks/ui';
import { useState } from 'react';

const WEIGHT_SLABS = ['1kg', '2kg', '5kg'] as const;
const fieldClass = 'mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';
type FormValues = { label: string; courierCompanyId: string; courierCompanyServiceTypeId: string };
const emptyForm: FormValues = { label: '', courierCompanyId: '', courierCompanyServiceTypeId: '' };

function SortableCourier({ config, onEdit, onDelete, disabled }: { config: CourierConfig; onEdit: () => void; onDelete: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: config.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <button type="button" aria-label="Drag to reorder" {...attributes} {...listeners} disabled={disabled} className="cursor-grab touch-none text-neutral-400 disabled:cursor-not-allowed">⠿</button>
      <div className="min-w-0 flex-1 text-sm text-neutral-700">
        {config.label && <p className="mb-1 font-medium text-neutral-900">{config.label}</p>}
        <span>Company ID: <strong className="text-neutral-900">{config.courierCompanyId}</strong></span>
        <span className="mx-2 text-neutral-300">•</span>
        <span>Service type ID: <strong className="text-neutral-900">{config.courierCompanyServiceTypeId}</strong></span>
      </div>
      <div className="flex gap-2">
        <IconButton label="Edit courier" onClick={onEdit} disabled={disabled}><EditIcon /></IconButton>
        <IconButton label="Delete courier" tone="danger" onClick={onDelete} disabled={disabled}><DeleteIcon /></IconButton>
      </div>
    </div>
  );
}

export default function CourierConfigPage() {
  const { data: configs = [], isLoading } = useCourierConfigs();
  const mutations = useCourierConfigMutations();
  const { success, error } = useToast();
  const [activeSlab, setActiveSlab] = useState<string | null>(null);
  const [editing, setEditing] = useState<CourierConfig | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const sensors = useSensors(useSensor(PointerSensor));
  const isSaving = mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;

  const configsFor = (slab: string) => configs.filter((config) => config.weightSlab === slab).sort((a, b) => a.priority - b.priority);
  const closeForm = () => { if (!isSaving) { setActiveSlab(null); setEditing(null); setForm(emptyForm); } };
  const add = (slab: string) => { setActiveSlab(slab); setEditing(null); setForm(emptyForm); };
  const edit = (config: CourierConfig) => { setActiveSlab(config.weightSlab); setEditing(config); setForm({ label: config.label ?? '', courierCompanyId: config.courierCompanyId, courierCompanyServiceTypeId: config.courierCompanyServiceTypeId }); };

  const save = (slab: string) => {
    const body = { label: form.label.trim() || null, courierCompanyId: form.courierCompanyId.trim(), courierCompanyServiceTypeId: form.courierCompanyServiceTypeId.trim() };
    if (!/^\d+$/.test(body.courierCompanyId) || !/^\d+$/.test(body.courierCompanyServiceTypeId)) { error('Enter numeric Shipmozo IDs for both fields.'); return; }
    const callbacks = { onSuccess: () => { success(`Courier configuration for ${slab} saved.`); closeForm(); }, onError: (err: unknown) => error(err instanceof Error ? err.message : 'Unable to save courier configuration.') };
    if (editing) mutations.update.mutate({ id: editing.id, body }, callbacks);
    else mutations.create.mutate({ weightSlab: slab, ...body }, callbacks);
  };

  const remove = (config: CourierConfig) => {
    if (!confirm(`Delete this ${config.weightSlab} courier configuration?`)) return;
    mutations.remove.mutate(config.id, { onSuccess: () => success('Courier configuration deleted.'), onError: (err: unknown) => error(err instanceof Error ? err.message : 'Unable to delete courier configuration.') });
  };

  const reorder = (slab: string, event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const current = configsFor(slab);
    const oldIndex = current.findIndex(({ id }) => id === event.active.id);
    const newIndex = current.findIndex(({ id }) => id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    arrayMove(current, oldIndex, newIndex).forEach((config, priority) => {
      if (config.priority !== priority) mutations.update.mutate({ id: config.id, body: { priority } }, { onError: () => error('Unable to save courier priority.') });
    });
  };

  return <div className="max-w-4xl">
    <h1 className="text-2xl font-bold">Courier Configuration</h1>
    <p className="mt-2 text-sm text-neutral-500">Add Shipmozo courier company and service type IDs. Drag couriers only within the same weight slab; the saved order determines assignment priority.</p>
    {isLoading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : <div className="mt-6 space-y-5">
      {WEIGHT_SLABS.map((slab) => {
        const slabConfigs = configsFor(slab);
        const formOpen = activeSlab === slab;
        return <section key={slab} className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-neutral-900">{slab} slab</h2><p className="mt-1 text-sm text-neutral-500">The first courier is tried first.</p></div><Button size="sm" onClick={() => add(slab)} disabled={isSaving || formOpen}>Add courier</Button></div>
          {slabConfigs.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => reorder(slab, event)}><SortableContext items={slabConfigs.map(({ id }) => id)} strategy={verticalListSortingStrategy}><div className="mt-4 space-y-2">{slabConfigs.map((config) => <SortableCourier key={config.id} config={config} onEdit={() => edit(config)} onDelete={() => remove(config)} disabled={isSaving} />)}</div></SortableContext></DndContext> : <p className="mt-4 text-sm text-neutral-500">No courier configured.</p>}
          {formOpen && <form className="mt-4 grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); save(slab); }}>
            <label className="text-sm font-medium text-neutral-700 sm:col-span-2">Label <span className="font-normal text-neutral-500">(optional)</span><input className={fieldClass} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="e.g. Delhivery Surface" maxLength={100} /></label>
            <label className="text-sm font-medium text-neutral-700">Courier company ID<input inputMode="numeric" pattern="[0-9]*" className={fieldClass} value={form.courierCompanyId} onChange={(event) => setForm({ ...form, courierCompanyId: event.target.value })} placeholder="e.g. 2 for Delhivery" required /></label>
            <label className="text-sm font-medium text-neutral-700">Service type ID<input inputMode="numeric" pattern="[0-9]*" className={fieldClass} value={form.courierCompanyServiceTypeId} onChange={(event) => setForm({ ...form, courierCompanyServiceTypeId: event.target.value })} placeholder={`Shipmozo ${slab} service type ID`} required /></label>
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={isSaving}>{editing ? 'Save changes' : 'Add courier'}</Button><Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>Cancel</Button></div>
          </form>}
        </section>;
      })}
    </div>}
  </div>;
}
