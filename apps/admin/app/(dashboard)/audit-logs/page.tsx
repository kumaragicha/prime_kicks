'use client';

import { controlClass, DataTable, Pagination } from '@/components/table-controls';
import { useAuditLogs, useDebouncedValue } from '@/lib/hooks';
import {
  AUDIT_EVENTS,
  AUDIT_MODULES,
  type AuditEvent,
  type AuditLogRow,
} from '@/lib/api';
import { Badge } from '@prime-kicks/ui';
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

const columnHelper = createColumnHelper<AuditLogRow>();
const PAGE_SIZE = 25;

const EVENT_TONES: Record<AuditEvent, 'neutral' | 'success' | 'warning' | 'danger'> = {
  CREATION: 'success',
  UPDATION: 'warning',
  DELETION: 'danger',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState('');
  const [event, setEvent] = useState('');
  const [auditedBy, setAuditedBy] = useState('');
  const [reference, setReference] = useState('');
  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const debouncedAuditedBy = useDebouncedValue(auditedBy);
  const debouncedReference = useDebouncedValue(reference);

  const { data, isLoading, isError, isFetching } = useAuditLogs({
    page,
    limit: PAGE_SIZE,
    module: moduleFilter || undefined,
    event: event || undefined,
    auditedBy: debouncedAuditedBy || undefined,
    referenceNumber: debouncedReference || undefined,
  });

  const resetTo =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  const columns = useMemo(
    () => [
      columnHelper.accessor('createdAt', {
        header: 'When',
        cell: (c) => (
          <span className="whitespace-nowrap text-neutral-600">{formatDateTime(c.getValue())}</span>
        ),
      }),
      columnHelper.accessor('module', {
        header: 'Module',
        cell: (c) => <Badge tone="neutral">{c.getValue()}</Badge>,
      }),
      columnHelper.accessor('event', {
        header: 'Event',
        cell: (c) => <Badge tone={EVENT_TONES[c.getValue()]}>{c.getValue()}</Badge>,
      }),
      columnHelper.accessor('action', {
        header: 'Action',
        cell: (c) => <span className="text-neutral-800">{c.getValue()}</span>,
      }),
      columnHelper.accessor('referenceNumber', {
        header: 'Reference',
        cell: (c) => c.getValue() ?? <span className="text-neutral-400">—</span>,
      }),
      columnHelper.accessor('auditedBy', {
        header: 'By',
        cell: (c) => <span className="text-neutral-600">{c.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Details</div>,
        cell: (c) => (
          <div className="text-right">
            <button
              type="button"
              className="text-blue-600 hover:underline"
              onClick={() => setSelected(c.row.original)}
            >
              View
            </button>
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every create, update, and delete performed through the API.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <select
          className={`${controlClass} w-full sm:w-auto`}
          value={moduleFilter}
          onChange={(e) => resetTo(setModuleFilter)(e.target.value)}
        >
          <option value="">All modules</option>
          {AUDIT_MODULES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className={`${controlClass} w-full sm:w-auto`}
          value={event}
          onChange={(e) => resetTo(setEvent)(e.target.value)}
        >
          <option value="">All events</option>
          {AUDIT_EVENTS.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
        <input
          className={`${controlClass} w-full sm:min-w-48 sm:flex-1`}
          placeholder="Audited by (email)…"
          value={auditedBy}
          onChange={(e) => resetTo(setAuditedBy)(e.target.value)}
        />
        <input
          className={`${controlClass} w-full sm:min-w-48 sm:flex-1`}
          placeholder="Reference (order no, SKU…)"
          value={reference}
          onChange={(e) => resetTo(setReference)(e.target.value)}
        />
      </div>

      {isLoading && <p className="text-neutral-500">Loading…</p>}
      {isError && (
        <p className="text-red-600">Failed to load. This section is restricted to ADMIN accounts.</p>
      )}

      {data && (
        <>
          <DataTable
            table={table}
            isFetching={isFetching}
            emptyMessage="No audit entries match your filters."
            minWidthClass="min-w-[900px]"
          />

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}

      {selected && <AuditLogDetail log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AuditLogDetail({ log, onClose }: { log: AuditLogRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{log.action}</h2>
            <p className="mt-1 text-xs text-neutral-500">{formatDateTime(log.createdAt)}</p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Detail label="Module" value={log.module} />
          <Detail label="Event" value={log.event} />
          <Detail label="Audited by" value={log.auditedBy} />
          <Detail label="Reference" value={log.referenceNumber ?? '—'} />
          <Detail label="Record id" value={log.moduleId ?? '—'} />
          <Detail label="Sub-module" value={log.subModule ?? '—'} />
        </dl>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Form data
          </p>
          <pre className="max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
            {log.formData ? JSON.stringify(log.formData, null, 2) : 'None'}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 break-words text-neutral-900">{value}</dd>
    </div>
  );
}
