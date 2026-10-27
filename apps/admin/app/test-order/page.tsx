'use client';

/**
 * DEV-ONLY Shipmozo test-order playground.
 *
 * Lives outside the (dashboard) route group, so it needs no admin login. Pick a
 * weight, paste a free-form address, Parse to fill the editable fields, review /
 * edit them, then Place order — which pushes the REVIEWED fields to Shipmozo and
 * assigns a courier by the configured slab priority. The result banners clear
 * themselves 5s after an order is placed. Local use only.
 */

import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const WEIGHTS = [1, 2, 5] as const;
type WeightKg = (typeof WEIGHTS)[number];

interface AddressFields {
  name: string;
  email: string;
  mobileNo: string;
  altMobileNo: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
}

const EMPTY_ADDRESS: AddressFields = {
  name: '',
  email: '',
  mobileNo: '',
  altMobileNo: '',
  line1: '',
  line2: '',
  landmark: '',
  pincode: '',
  city: '',
  state: '',
};

/** Field order + labels for the editable form. */
const FIELDS: Array<{ key: keyof AddressFields; label: string; wide?: boolean }> = [
  { key: 'name', label: 'Name' },
  { key: 'mobileNo', label: 'Mobile no' },
  { key: 'altMobileNo', label: 'Alt mobile no' },
  { key: 'email', label: 'Email' },
  { key: 'line1', label: 'Address line 1', wide: true },
  { key: 'line2', label: 'Address line 2', wide: true },
  { key: 'landmark', label: 'Landmark', wide: true },
  { key: 'pincode', label: 'Pincode' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
];

interface CourierCandidate {
  serviceTypeId: string;
  companyId: string;
  label: string;
}

interface ResolvedBox {
  weight: number;
  length: number;
  width: number;
  height: number;
  source: string;
}

interface TestOrderResult {
  slab?: string;
  box?: ResolvedBox;
  dryRun?: boolean;
  push?: { result: string; message: string; data?: Record<string, unknown> };
  shipmozoOrderId?: string | null;
  candidates?: CourierCandidate[];
  assigned?: {
    courierId: string;
    courier: string;
    awbNumber: string | null;
  } | null;
  assignErrors?: Array<{ id: string; name: string; error: string }>;
}

const SAMPLE = `Name: suhana Nasrin
Address: kodakkanchery house pattissery, Thanneercode. P.O, chalissery, palakkad
City : chalissery
State: Kerala
Landmark: GJB school pattissery
Pincode: 679536
Ph no: 7356479558
Size: 6/39`;

export default function TestOrderPage() {
  const [weightKg, setWeightKg] = useState<WeightKg>(1);
  const [addressBlock, setAddressBlock] = useState('');
  const [address, setAddress] = useState<AddressFields>(EMPTY_ADDRESS);
  const [parsed, setParsed] = useState(false);
  const [box, setBox] = useState<ResolvedBox | null>(null);
  const [assignCourier, setAssignCourier] = useState(true);
  const [result, setResult] = useState<TestOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'parse' | 'order' | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending auto-clear timer on unmount.
  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  // Refresh the box preview (dimensions for the chosen weight) when the weight
  // changes after a parse. Only reads the box; never touches the edited fields.
  useEffect(() => {
    if (!parsed || !addressBlock.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/dev/test-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addressBlock, weightKg, dryRun: true }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) setBox(json.box ?? null);
      } catch {
        /* box preview is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightKg]);

  function setField(key: keyof AddressFields, value: string) {
    setAddress((a) => ({ ...a, [key]: value }));
  }

  async function parse() {
    setBusy('parse');
    setError(null);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/dev/test-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressBlock, weightKg, dryRun: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(fmtErr(json));
      setAddress({ ...EMPTY_ADDRESS, ...json.parsed });
      setBox(json.box ?? null);
      setParsed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function validateAddress(a: AddressFields): string[] {
    const errs: string[] = [];
    const digits = (v: string) => v.replace(/\D/g, '');
    if (!a.name.trim()) errs.push('Full name is required');
    else if (!/^[\p{L} ]+$/u.test(a.name.trim()))
      errs.push('Full name can only contain letters and spaces');
    if (digits(a.mobileNo).length < 10) errs.push('Enter a valid mobile number (at least 10 digits)');
    if (a.altMobileNo.trim() && digits(a.altMobileNo).length < 10)
      errs.push('Alternative mobile number must be at least 10 digits');
    if (a.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email.trim()))
      errs.push('Valid email is required');
    if (!a.line1.trim()) errs.push('Address line 1 is required');
    if (digits(a.pincode).length < 6) errs.push('Valid pincode is required');
    if (!a.city.trim()) errs.push('City is required');
    if (!a.state.trim()) errs.push('State is required');
    return errs;
  }

  async function placeOrder() {
    const errs = validateAddress(address);
    if (errs.length > 0) {
      setError(errs.join(' · '));
      return;
    }
    setBusy('order');
    setError(null);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/dev/test-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, weightKg, assignCourier }),
      });
      const json = (await res.json()) as TestOrderResult & { message?: string };
      if (!res.ok) throw new Error(fmtErr(json));
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      // Clear whatever status is showing 5s after placing (success or error).
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => {
        setResult(null);
        setError(null);
      }, 5000);
    }
  }

  const pushed = result?.push?.result === '1';
  const canPlace = parsed && !!(address.line1 || address.pincode) && busy === null;

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Shipmozo test order</h1>
        <p style={styles.sub}>
          Dev-only. Pick a weight, paste an address, Parse to fill the fields, review / edit them,
          then Place order.
        </p>

        <label style={styles.label}>Weight</label>
        <div style={styles.weights}>
          {WEIGHTS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeightKg(w)}
              style={{ ...styles.weightBtn, ...(weightKg === w ? styles.weightBtnActive : {}) }}
            >
              {w} kg
            </button>
          ))}
        </div>
        {box && (
          <div style={styles.boxNote}>
            Box: {box.length}×{box.width}×{box.height} cm · {box.weight} g — from {box.source}
          </div>
        )}

        <div style={styles.cols}>
          {/* Left: raw paste + parse */}
          <div style={styles.col}>
            <label style={styles.label}>
              Paste address
              <button type="button" style={styles.linkBtn} onClick={() => setAddressBlock(SAMPLE)}>
                fill sample
              </button>
            </label>
            <textarea
              value={addressBlock}
              onChange={(e) => setAddressBlock(e.target.value)}
              placeholder="Paste the full address block here…"
              rows={14}
              style={styles.textarea}
            />
            <button
              type="button"
              onClick={parse}
              disabled={!addressBlock.trim() || busy !== null}
              style={{ ...styles.btn, ...styles.btnSecondary, marginTop: 10, width: '100%' }}
            >
              {busy === 'parse' ? 'Parsing…' : 'Parse →'}
            </button>
          </div>

          {/* Right: editable, reviewable fields */}
          <div style={styles.col}>
            <label style={styles.label}>Review fields</label>
            <div style={styles.fields}>
              {FIELDS.map((f) => (
                <div key={f.key} style={{ ...styles.fieldWrap, ...(f.wide ? styles.fieldWide : {}) }}>
                  <span style={styles.fieldLabel}>{f.label}</span>
                  <input
                    type="text"
                    value={address[f.key]}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={parsed ? '' : '—'}
                    style={styles.input}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={assignCourier}
            onChange={(e) => setAssignCourier(e.target.checked)}
          />
          Assign a courier after placing (uses your configured slab priority)
        </label>

        <button
          type="button"
          onClick={placeOrder}
          disabled={!canPlace}
          style={{ ...styles.btn, ...styles.btnPrimary, width: '100%', marginTop: 12 }}
          title={parsed ? '' : 'Parse an address first'}
        >
          {busy === 'order' ? 'Placing…' : `Place order (${weightKg} kg)`}
        </button>

        {error && <div style={styles.error}>⚠ {error}</div>}

        {result && result.push && (
          <div style={{ ...styles.banner, ...(pushed ? styles.ok : styles.bad) }}>
            {pushed ? '✓ Pushed to Shipmozo' : '✗ Shipmozo rejected it'} — {result.push.message}
            {result.shipmozoOrderId ? (
              <div style={styles.mono}>Shipmozo order id: {result.shipmozoOrderId}</div>
            ) : null}
          </div>
        )}

        {result && result.assigned && (
          <div style={{ ...styles.banner, ...styles.ok }}>
            ✓ Courier assigned — {result.assigned.courier}
            <div style={styles.mono}>
              AWB: {result.assigned.awbNumber ?? '(pending)'} · service type id:{' '}
              {result.assigned.courierId}
            </div>
          </div>
        )}

        {result && result.assigned === null && result.assignErrors && (
          <div style={{ ...styles.banner, ...styles.bad }}>
            ✗ No courier could be assigned
            {result.assignErrors.map((a, i) => (
              <div key={i} style={styles.mono}>
                {a.name}: {a.error}
              </div>
            ))}
          </div>
        )}

        {result && result.candidates && result.candidates.length > 0 && (
          <div style={styles.parsedBox}>
            <h2 style={styles.h2}>Configured couriers tried ({result.slab} slab, priority order)</h2>
            {result.candidates.map((c, i) => (
              <div key={c.serviceTypeId} style={styles.row}>
                <span style={{ ...styles.dd, flex: 1 }}>
                  {i + 1}. {c.label}
                  {result.assigned?.courierId === c.serviceTypeId ? ' ✓ assigned' : ''}
                </span>
                <span style={styles.dt}>svc {c.serviceTypeId}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function fmtErr(json: { message?: string | string[] }): string {
  return Array.isArray(json?.message)
    ? json.message.join(', ')
    : json?.message || 'Request failed';
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    padding: '32px 16px',
    display: 'flex',
    justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 820,
    background: '#fff',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  },
  h1: { margin: '0 0 4px', fontSize: 22, color: '#0f172a' },
  sub: { margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.5 },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
    margin: '16px 0 8px',
  },
  linkBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  weights: { display: 'flex', gap: 8 },
  weightBtn: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  weightBtnActive: { background: '#2563eb', borderColor: '#2563eb', color: '#fff' },
  boxNote: { marginTop: 8, fontSize: 12, color: '#64748b' },
  cols: { display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' },
  col: { flex: '1 1 300px', minWidth: 260 },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    resize: 'vertical',
    color: '#0f172a',
  },
  fields: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  fieldWrap: { flex: '1 1 calc(50% - 5px)', minWidth: 110, display: 'flex', flexDirection: 'column' },
  fieldWide: { flex: '1 1 100%' },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 10px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    color: '#0f172a',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    fontSize: 13,
    color: '#334155',
    cursor: 'pointer',
  },
  btn: {
    padding: '12px 0',
    borderRadius: 10,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: { background: '#16a34a', color: '#fff' },
  btnSecondary: { background: '#e2e8f0', color: '#334155' },
  error: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: 13,
  },
  banner: { marginTop: 12, padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600 },
  ok: { background: '#f0fdf4', color: '#15803d' },
  bad: { background: '#fef2f2', color: '#b91c1c' },
  mono: { fontFamily: 'ui-monospace, monospace', fontWeight: 400, marginTop: 6, fontSize: 13 },
  parsedBox: { marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 },
  h2: { fontSize: 15, margin: '0 0 12px', color: '#334155' },
  row: { display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9' },
  dt: { fontSize: 12, color: '#64748b' },
  dd: { margin: 0, fontSize: 13, color: '#0f172a', wordBreak: 'break-word' },
};
