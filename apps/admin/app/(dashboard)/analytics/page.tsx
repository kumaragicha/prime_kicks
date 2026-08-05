'use client';

import {
  BarList,
  compactCurrency,
  KpiStat,
  MiniStat,
  Panel,
  pctChange,
  TrendChart,
} from '@/components/dashboard-ui';
import { selectClass } from '@/components/table-controls';
import { useAuth } from '@/lib/auth';
import { useInsights } from '@/lib/hooks';
import type { InsightsData } from '@/lib/api';
import { formatCurrency } from '@prime-kicks/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];
type Granularity = 'day' | 'week' | 'month';

/** Collapse a daily series into week/month buckets so sparse data reads well. */
function bucketTrend(
  daily: InsightsData['trend'],
  granularity: Granularity,
): InsightsData['trend'] {
  if (granularity === 'day') return daily;
  const buckets = new Map<string, { date: string; orders: number; revenue: number }>();
  daily.forEach((d, i) => {
    const key =
      granularity === 'month'
        ? `${d.date.slice(0, 7)}-01`
        : daily[Math.floor(i / 7) * 7]!.date; // first day of each 7-day chunk
    const b = buckets.get(key) ?? { date: key, orders: 0, revenue: 0 };
    b.orders += d.orders;
    b.revenue += d.revenue;
    buckets.set(key, b);
  });
  return [...buckets.values()];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/products');
  }, [user, router]);

  const [days, setDays] = useState(30);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [sizeProduct, setSizeProduct] = useState('');

  const { data, isLoading, isError, isFetching } = useInsights(days);

  const trend = useMemo(
    () => (data ? bucketTrend(data.trend, granularity) : []),
    [data, granularity],
  );

  // Collapse the per-size low-stock rows into one row per product, so a product
  // low on several sizes shows once with all its affected sizes as badges.
  const lowByProduct = useMemo(() => {
    const map = new Map<
      string,
      { productId: string; title: string; brand: string; sizes: { sizeLabel: string; stock: number }[] }
    >();
    for (const v of data?.stock.low ?? []) {
      const row = map.get(v.productId) ?? {
        productId: v.productId,
        title: v.title,
        brand: v.brand,
        sizes: [],
      };
      row.sizes.push({ sizeLabel: v.sizeLabel, stock: v.stock });
      map.set(v.productId, row);
    }
    return [...map.values()];
  }, [data]);

  if (user && user.role !== 'ADMIN') return null;

  const cur = data?.period.current;
  const prev = data?.period.previous;
  const aov = (p?: { orders: number; revenue: number }) =>
    p && p.orders > 0 ? p.revenue / p.orders : 0;

  const scopedProduct = data?.sizesByProduct.find((p) => p.productId === sizeProduct);
  const sizeRows = scopedProduct ? scopedProduct.sizes : (data?.sizes ?? []);
  const agingTotal = data?.receivablesAging.reduce((s, a) => s + a.amount, 0) ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-neutral-500">
            Sales trends and breakdowns to guide business decisions.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-neutral-300 bg-white text-sm shadow-sm">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 transition-colors ${
                days === r.days
                  ? 'bg-neutral-900 font-medium text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Failed to load analytics. This section is restricted to ADMIN accounts and needs the API
          running.
        </p>
      )}
      {isLoading && !data && <p className="text-neutral-500">Loading…</p>}

      {data && cur && prev && (
        <div className={`flex flex-col gap-6 ${isFetching ? 'opacity-60' : ''}`}>
          {/* KPI strip — current window vs the preceding window of equal length */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiStat label={`Orders · ${days}d`} value={cur.orders} deltaPct={pctChange(cur.orders, prev.orders)} />
            <KpiStat
              label={`Revenue · ${days}d`}
              value={compactCurrency(cur.revenue)}
              deltaPct={pctChange(cur.revenue, prev.revenue)}
            />
            <KpiStat
              label={`Profit · ${days}d`}
              value={compactCurrency(cur.profit)}
              deltaPct={pctChange(cur.profit, prev.profit)}
            />
            <KpiStat
              label={`Avg order · ${days}d`}
              value={compactCurrency(aov(cur))}
              deltaPct={pctChange(aov(cur), aov(prev))}
            />
          </div>

          {/* Trend */}
          <Panel
            title={`Orders & revenue — last ${days} days`}
            action={
              <div className="flex overflow-hidden rounded-md border border-neutral-300 text-xs">
                {(['day', 'week', 'month'] as Granularity[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGranularity(g)}
                    className={`px-2.5 py-1 capitalize transition-colors ${
                      granularity === g
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            }
          >
            <TrendChart data={trend} />
          </Panel>

          {/* ---- Cash & inventory ---- */}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Cash & inventory
          </h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Receivables aging">
              <div className="mb-3 text-2xl font-bold">{compactCurrency(agingTotal)}</div>
              <div className="grid grid-cols-3 gap-2">
                {data.receivablesAging.map((a) => (
                  <MiniStat
                    key={a.bucket}
                    label={`${a.label} · ${a.orders}`}
                    value={compactCurrency(a.amount)}
                    tone={a.bucket === '31+' ? 'danger' : a.bucket === '8-30' ? 'warning' : 'neutral'}
                  />
                ))}
              </div>
            </Panel>

            <Panel
              title="Low / out of stock"
              action={
                <span className="text-xs text-neutral-500">
                  <span className="text-red-600">{data.stock.outOfStockCount} out</span> ·{' '}
                  {data.stock.lowStockCount} low
                </span>
              }
            >
              <div className="max-h-72 overflow-y-auto pr-1">
                {lowByProduct.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">Everything well stocked.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
                    {lowByProduct.map((p) => (
                      <li key={p.productId} className="py-2.5">
                        <div className="truncate">
                          <span className="font-medium text-neutral-800">{p.title}</span>
                          <span className="text-neutral-400"> · {p.brand}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {p.sizes.map((s) => (
                            <span
                              key={s.sizeLabel}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                s.stock <= 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {s.sizeLabel}: {s.stock <= 0 ? 'Out' : `${s.stock} left`}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>

            <Panel
              title="Dead stock"
              action={<span className="text-xs text-neutral-500">no sales in 30d</span>}
            >
              <div className="max-h-72 overflow-y-auto pr-1">
                {data.stock.dead.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">No dead stock — nice.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
                    {data.stock.dead.map((p) => (
                      <li key={p.productId} className="flex items-center justify-between gap-2 py-2">
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-neutral-800">{p.title}</span>
                          <span className="text-neutral-400"> · {p.brand}</span>
                        </span>
                        <span className="shrink-0 text-xs text-neutral-500">{p.stock} in stock</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
          </div>

          {/* ---- Revenue quality & customers ---- */}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Revenue quality & customers
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={`Customers · last ${days} days`}>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Active" value={data.customers.active} />
                <MiniStat label="New" value={data.customers.new} tone="success" />
                <MiniStat label="Returning" value={data.customers.returning} />
              </div>
              <p className="mt-3 text-sm text-neutral-500">
                Repeat rate:{' '}
                <span className="font-semibold text-neutral-900">
                  {(data.customers.repeatRate * 100).toFixed(0)}%
                </span>
              </p>
            </Panel>

            <Panel title="Sales channel (all-time)">
              <div className="grid grid-cols-2 gap-2">
                {['SINGLE', 'BULK'].map((type) => {
                  const c = data.channel.find((x) => x.type === type);
                  return (
                    <MiniStat
                      key={type}
                      label={`${type === 'BULK' ? 'Bulk / reseller' : 'Single / direct'} · ${c?.orders ?? 0} orders`}
                      value={compactCurrency(c?.revenue ?? 0)}
                    />
                  );
                })}
              </div>
            </Panel>

            <Panel title="Most profitable brands (all-time)">
              <div className="max-h-96 overflow-y-auto pr-1">
                <BarList
                  items={data.profitByBrand.map((b) => ({
                    key: b.brand,
                    label: b.brand,
                    value: b.profit,
                    display: compactCurrency(b.profit),
                  }))}
                />
              </div>
            </Panel>

            <Panel title="Top customers (all-time)">
              <div className="max-h-96 overflow-y-auto pr-1">
                <ul className="flex flex-col divide-y divide-neutral-100 text-sm">
                  {data.topCustomers.length === 0 && (
                    <li className="py-6 text-center text-neutral-400">No customers yet.</li>
                  )}
                  {data.topCustomers.map((c) => (
                    <li key={c.userId} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0 truncate font-medium text-neutral-800">{c.name}</span>
                      <span className="shrink-0 text-neutral-600">
                        {formatCurrency(c.spend)} · {c.orders} orders
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>

          {/* ---- Product breakdowns (all-time) ---- */}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Product breakdowns
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Top products">
              <div className="max-h-96 overflow-y-auto pr-1">
                <BarList
                  items={data.topProducts.map((p) => ({
                    key: p.productId,
                    label: p.title,
                    sub: `${p.sku} · ${p.brand}`,
                    value: p.units,
                    display: `${p.units} sold`,
                  }))}
                />
              </div>
            </Panel>

            <Panel title="Top brands">
              <div className="max-h-96 overflow-y-auto pr-1">
                <BarList
                  items={data.topBrands.map((b) => ({
                    key: b.brand,
                    label: b.brand,
                    value: b.units,
                    display: `${b.units} sold`,
                  }))}
                />
              </div>
            </Panel>

            <Panel
              title="Fastest-selling sizes"
              action={
                <select
                  className={`${selectClass} max-w-[12rem] py-1.5 text-xs`}
                  value={sizeProduct}
                  onChange={(e) => setSizeProduct(e.target.value)}
                >
                  <option value="">All products</option>
                  {data.sizesByProduct.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.title}
                    </option>
                  ))}
                </select>
              }
            >
              <div className="max-h-96 overflow-y-auto pr-1">
                <BarList
                  emptyMessage="No sizes sold for this product yet."
                  items={sizeRows.map((s) => ({
                    key: s.sizeLabel,
                    label: `Size ${s.sizeLabel}`,
                    value: s.units,
                    display: `${s.units} sold`,
                  }))}
                />
              </div>
            </Panel>

            <Panel title="Orders by location">
              <div className="max-h-96 overflow-y-auto pr-1">
                <BarList
                  items={data.locations.map((l) => ({
                    key: `${l.city}-${l.state}`,
                    label: l.city || '—',
                    sub: l.state,
                    value: l.orders,
                    display: `${l.orders} ${l.orders === 1 ? 'order' : 'orders'}`,
                  }))}
                />
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
