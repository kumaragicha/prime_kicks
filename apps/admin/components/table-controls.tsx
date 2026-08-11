'use client';

import { Button } from '@prime-kicks/ui';
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table';

export const controlClass =
  'rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 shadow-sm transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10';

/**
 * Select variant of {@link controlClass}: native chevron removed and replaced
 * with a consistent SVG caret, with room on the right so text never overlaps.
 */
export const selectClass = `${controlClass} cursor-pointer appearance-none bg-no-repeat pr-9 bg-[right_0.7rem_center] bg-[length:0.85rem] bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20fill='none'%20viewBox='0%200%2024%2024'%20stroke='%23737373'%20stroke-width='2.5'%3E%3Cpath%20stroke-linecap='round'%20stroke-linejoin='round'%20d='m6%209%206%206%206-6'/%3E%3C/svg%3E")]`;

/**
 * The shared admin data-table shell (header + rows + empty state), dimmed while
 * a background refetch is in flight. Column definitions and row data live in the
 * caller's `table` instance — this only owns the presentation the list pages
 * (orders, users, products) previously each copied.
 */
export function DataTable<TData>({
  table,
  isFetching = false,
  emptyMessage,
  minWidthClass = 'min-w-[760px]',
  onRowClick,
}: {
  table: TanstackTable<TData>;
  isFetching?: boolean;
  emptyMessage: string;
  minWidthClass?: string;
  /** When set, clicking a row calls this with the row's original data. */
  onRowClick?: (row: TData) => void;
}) {
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;

  return (
    <div
      className="overflow-x-auto rounded-lg border border-neutral-200 bg-white"
      style={{ opacity: isFetching ? 0.6 : 1 }}
    >
      <table className={`${minWidthClass} w-full text-sm`}>
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-medium text-neutral-600">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-neutral-100 last:border-0${
                onRowClick ? ' cursor-pointer hover:bg-neutral-50' : ''
              }`}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="px-4 py-8 text-center text-neutral-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {total} result{total === 1 ? '' : 's'}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span>
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
