'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@prime-kicks/ui';

export function ConfirmDialog({
  open,
  title,
  description,
  error,
  isConfirming = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  error?: string;
  isConfirming?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isConfirming, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) onClose();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm text-neutral-600">
          {description}
        </p>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button ref={cancelButtonRef} type="button" variant="outline" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isConfirming} className="bg-red-600 hover:bg-red-700">
            {isConfirming ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </section>
    </div>
  );
}
