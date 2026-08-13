'use client';

import { BarList, compactCurrency, MiniStat, Panel, StatCard } from '@/components/dashboard-ui';
import { controlClass, selectClass } from '@/components/table-controls';
import { useAuth } from '@/lib/auth';
import { useInventory } from '@/lib/hooks';
import type { InventoryProductRow } from '@/lib/api';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type StatusFilter = 'all' | 'ok' | 'low' | 'out' | 'dead';
type SortKey = 'inhouseValue' | 'retailValue' | 'units' | 'title';

const STATUS_META: Record<
  InventoryProductRow['status'],
  { label: string; className: string }
> = {
  ok: { label: 'In stock', className: 'bg-emerald-50 text-emerald-700' },
  low: { label: 'Low', className: 'bg-amber-50 text-amber-700' },
  out: { label: 'Out', className: 'bg-red-50 text-red-700' },
};

export default function InventoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/products');
  }, [user, router]);

  const { data, isLoading, isError, isFetching } = useInventory();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('inhouseValue');

  const rows = useMemo(() => {
    const all = data?.products ?? [];
    const q = search.trim().toLowerCase();
    const filtered = all.filter((p) => {
      if (status === 'dead' ? !p.isDead : status !== 'all' && p.status !== status) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      return b[sort] - a[sort];
    });
    return sorted;
  }, [data, search, status, sort]);

  if (user && user.role !== 'ADMIN') return null;

  const s = data?.summary;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-neutral-500">
            Current stock across all live products — units on hand and the money tied up in them.
          </p>
        </div>
        {data && (
          <p className="text-xs text-neutral-400">
            Snapshot · {new Date(data.generatedAt).toLocaleString('en-IN')}
          </p>
        )}
      </div>

      {isError && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Failed to load inventory. This section is restricted to ADMIN accounts and needs the API
          running.
        </p>
      )}
      {isLoading && !data && <p className="text-neutral-500">Loading…</p>}

      {data && s && (
        <div className={`flex flex-col gap-6 ${isFetching ? 'opacity-60' : ''}`}>
          {/* Headline stock value + units */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Units in stock"
              value={s.totalUnits.toLocaleString('en-IN')}
              sub={`${s.totalVariants.toLocaleString('en-IN')} variants across ${s.totalProducts} products`}
            />
            <StatCard
              label="Inhouse stock value"
              value={compactCurrency(s.inhouseValue)}
              sub="what the on-hand stock cost us"
            />
            <StatCard
              label="Retail value"
              value={compactCurrency(s.retailValue)}
              sub={`reseller ${compactCurrency(s.resellerValue)}`}
              tone="success"
            />
            <StatCard
              label="Potential profit"
              value={compactCurrency(s.potentialProfit)}
              sub="if all stock sells at customer price"
              tone="success"
            />
          </div>

          {/* Stock health */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MiniStat
              label="Out of stock (products)"
              value={s.outOfStockProducts}
              tone={s.outOfStockProducts > 0 ? 'danger' : 'neutral'}
            />
            <MiniStat
              label={`Low stock (≤ ${data.lowStockThreshold} variants)`}
              value={s.lowStockVariants}
              tone={s.lowStockVariants > 0 ? 'warning' : 'neutral'}
            />
            <MiniStat
              label={`Dead stock (${data.deadStockDays}d no sale)`}
              value={s.deadStockProducts}
              tone={s.deadStockProducts > 0 ? 'warning' : 'neutral'}
            />
            <MiniStat label="Active / inactive" value={`${s.activeProducts} / ${s.inactiveProducts}`} />
          </div>

          {/* Value tied up by brand */}
          <Panel title="Stock value by brand" action={<span className="text-xs text-neutral-500">at inhouse cost</span>}>
            <div className="max-h-96 overflow-y-auto pr-1">
              <BarList
                emptyMessage="No stock yet."
                items={data.byBrand.map((b) => ({
                  key: b.brand,
                  label: b.brand,
                  sub: `${b.products} products · ${b.units.toLocaleString('en-IN')} units`,
                  value: b.inhouseValue,
                  display: compactCurrency(b.inhouseValue),
                }))}
              />
            </div>
          </Panel>

          {/* Per-product table */}
          <Panel
            title={`Products (${rows.length})`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${controlClass} w-44`}
                  placeholder="Search name / SKU / brand"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className={`${selectClass} py-1.5 text-xs`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="ok">In stock</option>
                  <option value="low">Low</option>
                  <option value="out">Out of stock</option>
                  <option value="dead">Dead stock</option>
                </select>
                <select
                  className={`${selectClass} py-1.5 text-xs`}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  <option value="inhouseValue">Sort: Inhouse value</option>
                  <option value="retailValue">Sort: Retail value</option>
                  <option value="units">Sort: Units</option>
                  <option value="title">Sort: Name</option>
                </select>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Units</th>
                    <th className="px-3 py-2 text-right font-medium">Inhouse value</th>
                    <th className="px-3 py-2 text-right font-medium">Retail value</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="py-2 pl-3 font-medium">Sizes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-400">
                        No products match.
                      </td>
                    </tr>
                  )}
                  {rows.map((p) => (
                    <tr key={p.productId} className="align-top hover:bg-neutral-50/60">
                      <td className="py-3 pr-3">
                        <Link
                          href={`/products/${p.productId}/edit`}
                          className="font-medium text-neutral-900 hover:underline"
                        >
                          {p.title}
                        </Link>
                        <div className="text-xs text-neutral-400">
                          {p.sku} · {p.brand}
                          {!p.isActive && <span className="ml-1 text-neutral-400">· hidden</span>}
                          {p.isDead && <span className="ml-1 text-amber-600">· dead stock</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {p.units.toLocaleString('en-IN')}
                        <div className="text-xs text-neutral-400">{p.variants} sizes</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-neutral-700">
                        {formatCurrency(p.inhouseValue)}
                        <div className="text-xs text-neutral-400">@ {formatCurrency(p.inhouseCost)}</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-neutral-700">
                        {formatCurrency(p.retailValue)}
                        <div className="text-xs text-neutral-400">@ {formatCurrency(p.customerPrice)}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[p.status].className}`}
                        >
                          {STATUS_META[p.status].label}
                        </span>
                      </td>
                      <td className="py-3 pl-3">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {p.sizes.map((sz) => (
                            <span
                              key={sz.sizeLabel}
                              title={`Size ${sz.sizeLabel}: ${sz.stock} in stock`}
                              className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${
                                sz.stock <= 0
                                  ? 'bg-red-50 text-red-600'
                                  : sz.stock <= data.lowStockThreshold
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {sz.sizeLabel}:{sz.stock}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
