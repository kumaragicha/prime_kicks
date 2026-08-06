'use client';

import { useState } from 'react';
import { Button } from '@prime-kicks/ui';
import { useMasterMutations } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { DeleteIcon, EditIcon, IconButton, Toggle } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';

type Resource = 'brands' | 'product-types' | 'categories' | 'tags';
type Master = { id: string; name: string; isActive: boolean };

export function MasterManager({ title, description, resource, items, loading }: { title: string; description: string; resource: Resource; items?: Master[]; loading: boolean }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<Master | null>(null);
  const { create, update, remove } = useMasterMutations(resource);
  const { error: toastError } = useToast();
  const onError = (e: Error) => toastError(e.message);
  const add = () => { const value = name.trim(); if (value) create.mutate(value, { onSuccess: () => setName(''), onError }); };
  return <div className="max-w-3xl"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-2 text-sm text-neutral-500">{description}</p><div className="mt-6 flex gap-2"><input className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && add()} placeholder={`Add ${title.toLowerCase().slice(0, -1)}`} /><Button onClick={add} disabled={create.isPending}>Add</Button></div><div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white">{loading && <p className="p-5 text-sm text-neutral-500">Loading…</p>}{items?.map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-neutral-100 p-3 last:border-0">{editing === item.id ? <input autoFocus className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} /> : <span className="flex-1 text-sm font-medium">{item.name}</span>}<div className="flex items-center gap-2"><Toggle checked={item.isActive} disabled={update.isPending} label={`${item.isActive ? 'Disable' : 'Enable'} ${item.name}`} onCheckedChange={(isActive) => update.mutate({ id: item.id, body: { isActive } }, { onError })} />{editing === item.id ? <Button size="sm" onClick={() => { const value = draft.trim(); if (value) update.mutate({ id: item.id, body: { name: value } }, { onSuccess: () => setEditing(null), onError }); }}>Save</Button> : <IconButton label={`Edit ${item.name}`} onClick={() => { setEditing(item.id); setDraft(item.name); }}><EditIcon /></IconButton>}<IconButton label={`Delete ${item.name}`} tone="danger" onClick={() => setDeleting(item)}><DeleteIcon /></IconButton></div></div>)}{!loading && items?.length === 0 && <p className="p-5 text-sm text-neutral-500">No records yet.</p>}</div><ConfirmDialog open={deleting !== null} title={`Delete ${title.toLowerCase().slice(0, -1)}?`} description={deleting ? `“${deleting.name}” will be permanently deleted.` : ''} error={remove.error instanceof Error ? remove.error.message : undefined} isConfirming={remove.isPending} onClose={() => { setDeleting(null); remove.reset(); }} onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })} /></div>;
}
