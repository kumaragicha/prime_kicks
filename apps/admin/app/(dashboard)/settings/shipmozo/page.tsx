'use client';

import { Toggle } from '@/components/action-controls';
import { useShipmozoSettings, useUpdateShipmozoSettings } from '@/lib/hooks';
import { INDIAN_STATES } from '@/lib/indian-states';
import { useToast } from '@/lib/toast';
import { Button } from '@prime-kicks/ui';
import { useEffect, useState } from 'react';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-neutral-100 py-4 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="mt-1 text-xs text-neutral-500">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function ShipmozoSettingsPage() {
  const { data, isLoading } = useShipmozoSettings();
  const update = useUpdateShipmozoSettings();
  const { success, error } = useToast();

  const [warehouseId, setWarehouseId] = useState('');
  const [skipStates, setSkipStates] = useState<string[]>([]);
  // Seed the local inputs once the settings load.
  useEffect(() => {
    if (data) {
      setWarehouseId(data.warehouseId ?? '');
      setSkipStates(data.skipStates ?? []);
    }
  }, [data]);

  const onError = (e: unknown) => error(e instanceof Error ? e.message : 'Update failed.');

  const toggle = (key: 'enabled' | 'autoAssignCourier', value: boolean) =>
    update.mutate({ [key]: value }, { onSuccess: () => success('Settings updated.'), onError });

  const saveWarehouse = () =>
    update.mutate(
      { warehouseId: warehouseId.trim() },
      { onSuccess: () => success('Warehouse ID saved.'), onError },
    );

  // Persist the skip-states list immediately on add/remove so it can't drift
  // from what's shown.
  const persistSkipStates = (next: string[]) =>
    update.mutate(
      { skipStates: next },
      { onSuccess: () => success('Skip states updated.'), onError },
    );

  const addSkipState = (value: string) => {
    if (!value) return;
    // Case-insensitive de-dupe — the backend matches states the same way.
    if (skipStates.some((s) => s.toLowerCase() === value.toLowerCase())) return;
    const next = [...skipStates, value];
    setSkipStates(next);
    persistSkipStates(next);
  };

  // States not yet in the skip list — the only ones worth offering in the picker.
  const availableStates = INDIAN_STATES.filter(
    (s) => !skipStates.some((picked) => picked.toLowerCase() === s.toLowerCase()),
  );

  const removeSkipState = (state: string) => {
    const next = skipStates.filter((s) => s !== state);
    setSkipStates(next);
    persistSkipStates(next);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Shipmozo Configuration</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Control the entire shipment flow from here. Changes apply to new orders immediately.
      </p>

      {isLoading || !data ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white px-5">
          <Row
            title="Enable Shipmozo shipments"
            description="When off, orders are created only in our system — no order is pushed to Shipmozo."
          >
            <Toggle
              checked={data.enabled}
              disabled={update.isPending}
              label="Enable Shipmozo shipments"
              onCheckedChange={(v) => toggle('enabled', v)}
            />
          </Row>

          <Row
            title="Auto-assign courier"
            description="When on, the configured courier for the order's weight slab is assigned automatically after a successful push."
          >
            <Toggle
              checked={data.autoAssignCourier}
              disabled={update.isPending}
              label="Auto-assign courier"
              onCheckedChange={(v) => toggle('autoAssignCourier', v)}
            />
          </Row>

          <Row
            title="Warehouse ID"
            description="Pickup warehouse id from your Shipmozo panel. Used on every order push. Overrides the environment value when set."
          >
            <div className="flex items-center gap-2">
              <input
                className={`${fieldClass} w-40`}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                placeholder="e.g. 68468"
              />
              <Button
                size="sm"
                onClick={saveWarehouse}
                disabled={update.isPending || warehouseId.trim() === (data.warehouseId ?? '')}
              >
                Save
              </Button>
            </div>
          </Row>

          <Row
            title="Skip states"
            description="Orders shipping to these states are created in our system but NOT pushed to Shipmozo. Matching is case-insensitive."
          >
            <div className="flex w-64 flex-col gap-2">
              <select
                className={fieldClass}
                value=""
                disabled={update.isPending || availableStates.length === 0}
                onChange={(e) => addSkipState(e.target.value)}
              >
                <option value="" disabled>
                  {availableStates.length === 0 ? 'All states added' : 'Add a state to skip…'}
                </option>
                {availableStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              {skipStates.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {skipStates.map((state) => (
                    <span
                      key={state}
                      className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
                    >
                      {state}
                      <button
                        type="button"
                        aria-label={`Remove ${state}`}
                        className="text-neutral-400 hover:text-red-600 disabled:opacity-50"
                        disabled={update.isPending}
                        onClick={() => removeSkipState(state)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-400">
                  No states skipped — all orders are pushed.
                </p>
              )}
            </div>
          </Row>
        </div>
      )}

      {!isLoading && data && !data.enabled && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Shipmozo is currently <strong>disabled</strong>. New orders will not be pushed to the
          courier panel.
        </p>
      )}
    </div>
  );
}
