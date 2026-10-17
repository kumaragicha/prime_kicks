'use client';

import { DeleteIcon, EditIcon, IconButton, Toggle } from '@/components/action-controls';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { controlClass, selectClass } from '@/components/table-controls';
import { useCouponMutations, useCoupons } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { Coupon } from '@prime-kicks/types';
import type { CreateCouponSchema } from '@prime-kicks/validation';
import { Button } from '@prime-kicks/ui';
import { useState } from 'react';

type FormState = {
  code: string;
  description: string;
  type: 'PERCENT' | 'FLAT';
  value: string;
  maxDiscount: string;
  minOrderValue: string;
  usageLimit: string;
  perUserLimit: string;
  validFrom: string;
  validUntil: string;
  customerOnly: boolean;
  prepaidOnly: boolean;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: '',
  description: '',
  type: 'PERCENT',
  value: '',
  maxDiscount: '',
  minOrderValue: '',
  usageLimit: '',
  perUserLimit: '',
  validFrom: '',
  validUntil: '',
  customerOnly: true,
  prepaidOnly: true,
  isActive: true,
};

function toForm(c: Coupon): FormState {
  return {
    code: c.code,
    description: c.description,
    type: c.type,
    value: String(c.value),
    maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
    minOrderValue: c.minOrderValue ? String(c.minOrderValue) : '',
    usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
    perUserLimit: c.perUserLimit != null ? String(c.perUserLimit) : '',
    validFrom: c.validFrom ? c.validFrom.slice(0, 10) : '',
    validUntil: c.validUntil ? c.validUntil.slice(0, 10) : '',
    customerOnly: c.customerOnly,
    prepaidOnly: c.prepaidOnly,
    isActive: c.isActive,
  };
}

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

/** Human-readable discount, e.g. "10% (max ₹500)" or "₹300 off". */
function discountLabel(c: Coupon): string {
  if (c.type === 'PERCENT') {
    return `${c.value}%${c.maxDiscount != null ? ` (max ₹${c.maxDiscount})` : ''}`;
  }
  return `₹${c.value} off`;
}

export default function CouponsPage() {
  const { data, isLoading, isError } = useCoupons();
  const { create, update, remove } = useCouponMutations();
  const toast = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function startEdit(c: Coupon) {
    setForm(toForm(c));
    setEditingId(c.id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildPayload(): CreateCouponSchema | null {
    const value = Number(form.value);
    if (!form.code.trim()) {
      toast.error('A coupon code is required.');
      return null;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a discount value greater than 0.');
      return null;
    }
    if (form.type === 'PERCENT' && value > 100) {
      toast.error('A percentage discount cannot exceed 100.');
      return null;
    }
    return {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      type: form.type,
      value,
      maxDiscount: form.type === 'PERCENT' ? numOrNull(form.maxDiscount) : null,
      minOrderValue: form.minOrderValue.trim() === '' ? 0 : Number(form.minOrderValue),
      usageLimit: numOrNull(form.usageLimit),
      perUserLimit: numOrNull(form.perUserLimit),
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
      customerOnly: form.customerOnly,
      prepaidOnly: form.prepaidOnly,
      isActive: form.isActive,
    } as CreateCouponSchema;
  }

  function submit() {
    const payload = buildPayload();
    if (!payload) return;
    const onError = (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Could not save the coupon.');

    if (editingId) {
      update.mutate(
        { id: editingId, body: payload },
        {
          onSuccess: () => {
            toast.success('Coupon updated.');
            resetForm();
          },
          onError,
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success('Coupon created.');
          resetForm();
        },
        onError,
      });
    }
  }

  const coupons = data?.data ?? [];
  const saving = create.isPending || update.isPending;
  const inputClass = `${controlClass} w-full`;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold">Coupons</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Discount codes for the storefront. Coupons apply to customer, prepaid orders only — never
        reseller, credit or admin orders.
      </p>

      {/* Create / edit form */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold">{editingId ? 'Edit coupon' : 'New coupon'}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Code
            <input
              className={inputClass}
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="PREPAID10"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 sm:col-span-2 lg:col-span-2">
            Description
            <input
              className={inputClass}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="10% off on prepaid orders"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Type
            <select
              className={selectClass}
              value={form.type}
              onChange={(e) => set('type', e.target.value as 'PERCENT' | 'FLAT')}
            >
              <option value="PERCENT">Percentage (%)</option>
              <option value="FLAT">Flat amount (₹)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            {form.type === 'PERCENT' ? 'Percentage (1–100)' : 'Amount (₹)'}
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.value}
              onChange={(e) => set('value', e.target.value)}
              placeholder={form.type === 'PERCENT' ? '10' : '300'}
            />
          </label>
          {form.type === 'PERCENT' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
              Max discount ₹ (optional)
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.maxDiscount}
                onChange={(e) => set('maxDiscount', e.target.value)}
                placeholder="No cap"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Min order value ₹
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.minOrderValue}
              onChange={(e) => set('minOrderValue', e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Total usage limit (optional)
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.usageLimit}
              onChange={(e) => set('usageLimit', e.target.value)}
              placeholder="Unlimited"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Per-customer limit (optional)
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.perUserLimit}
              onChange={(e) => set('perUserLimit', e.target.value)}
              placeholder="Unlimited"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Valid from (optional)
            <input
              type="date"
              className={inputClass}
              value={form.validFrom}
              onChange={(e) => set('validFrom', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
            Valid until (optional)
            <input
              type="date"
              className={inputClass}
              value={form.validUntil}
              onChange={(e) => set('validUntil', e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={form.customerOnly}
              onChange={(e) => set('customerOnly', e.target.checked)}
            />
            Customers only (not resellers)
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={form.prepaidOnly}
              onChange={(e) => set('prepaidOnly', e.target.checked)}
            />
            Prepaid orders only
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
            />
            Active
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <Button onClick={submit} disabled={saving}>
            {editingId ? 'Save changes' : 'Create coupon'}
          </Button>
          {editingId && (
            <Button variant="secondary" onClick={resetForm} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        {isLoading && <p className="p-5 text-sm text-neutral-500">Loading…</p>}
        {isError && <p className="p-5 text-sm text-red-600">Could not load coupons.</p>}
        {!isLoading && !isError && coupons.length === 0 && (
          <p className="p-5 text-sm text-neutral-500">No coupons yet. Create one above.</p>
        )}
        {coupons.length > 0 && (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="p-3">Code</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Min order</th>
                <th className="p-3">Usage</th>
                <th className="p-3">Validity</th>
                <th className="p-3">Active</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                  <td className="p-3">
                    <div className="font-semibold">{c.code}</div>
                    {c.description && (
                      <div className="text-xs text-neutral-500">{c.description}</div>
                    )}
                    <div className="mt-0.5 text-[11px] text-neutral-400">
                      {c.customerOnly ? 'Customers' : 'All roles'} · {c.prepaidOnly ? 'Prepaid' : 'Any payment'}
                    </div>
                  </td>
                  <td className="p-3">{discountLabel(c)}</td>
                  <td className="p-3">{c.minOrderValue ? `₹${c.minOrderValue}` : '—'}</td>
                  <td className="p-3">
                    {c.usedCount}
                    {c.usageLimit != null ? ` / ${c.usageLimit}` : ''}
                    {c.perUserLimit != null && (
                      <div className="text-[11px] text-neutral-400">{c.perUserLimit}/customer</div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-neutral-600">
                    {c.validFrom || c.validUntil ? (
                      <>
                        {c.validFrom ? c.validFrom.slice(0, 10) : '—'} →{' '}
                        {c.validUntil ? c.validUntil.slice(0, 10) : '—'}
                      </>
                    ) : (
                      'Always'
                    )}
                  </td>
                  <td className="p-3">
                    <Toggle
                      checked={c.isActive}
                      disabled={update.isPending}
                      label={`${c.isActive ? 'Disable' : 'Enable'} ${c.code}`}
                      onCheckedChange={(isActive) =>
                        update.mutate(
                          { id: c.id, body: { isActive } },
                          {
                            onError: (e) =>
                              toast.error(e instanceof Error ? e.message : 'Could not update.'),
                          },
                        )
                      }
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      <IconButton label={`Edit ${c.code}`} onClick={() => startEdit(c)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        label={`Delete ${c.code}`}
                        tone="danger"
                        onClick={() => setDeleting(c)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete coupon?"
        description={deleting ? `“${deleting.code}” will be permanently deleted.` : ''}
        error={remove.error instanceof Error ? remove.error.message : undefined}
        isConfirming={remove.isPending}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Coupon deleted.');
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
