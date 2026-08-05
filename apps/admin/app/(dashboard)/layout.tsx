'use client';

import { AuthGuard, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import { Button } from '@prime-kicks/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 min-h-4 min-w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 min-h-4 min-w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `rounded px-2 py-1.5 transition-colors ${
      pathname === href
        ? 'bg-black text-white font-medium'
        : 'text-neutral-700 hover:bg-neutral-100'
    }`;

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-neutral-200 bg-white p-5 shadow-xl transition-transform duration-200 lg:w-56 lg:translate-x-0 lg:p-6 lg:shadow-none ${open ? 'translate-x-0' : ''}`}
      >
        <div className="mb-8 flex items-center justify-between text-lg font-bold">
          Prime Admin
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-md p-2 hover:bg-neutral-100 lg:hidden"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 text-sm">
          {user?.role === 'ADMIN' && (
            <Link className={linkClass('/')} href="/" onClick={onClose}>
              Dashboard
            </Link>
          )}

          <Link className={linkClass('/products')} href="/products" onClick={onClose}>
            Products
          </Link>

          {user?.role === 'ADMIN' && (
            <>
              <Link className={linkClass('/masters')} href="/masters" onClick={onClose}>
                Masters
              </Link>

              <Link className={linkClass('/users')} href="/users" onClick={onClose}>
                Users
              </Link>

              <Link className={linkClass('/orders')} href="/orders" onClick={onClose}>
                Orders
              </Link>

              <Link className={linkClass('/payments')} href="/payments" onClick={onClose}>
                Payment Pending
              </Link>

              <Link className={linkClass('/analytics')} href="/analytics" onClick={onClose}>
                Analytics
              </Link>

              <Link className={linkClass('/audit-logs')} href="/audit-logs" onClick={onClose}>
                Audit Log
              </Link>
            </>
          )}
        </nav>

        <div className="mt-6 border-t border-neutral-200 pt-4">
          <p className="truncate text-sm font-medium text-neutral-900">{user?.name}</p>
          <p className="mb-3 truncate text-xs text-neutral-500">{user?.role}</p>

          <Button variant="outline" size="sm" className="w-full" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </aside>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <AuthGuard>
      <ToastProvider>
        <div className="min-h-screen bg-neutral-50">
          <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
          <div className="min-w-0 lg:pl-56">
            <header className="sticky top-0 z-20 flex h-16 items-center border-b border-neutral-200 bg-white px-4 lg:hidden">
              <button
                type="button"
                aria-label="Open navigation"
                className="rounded-md p-2 hover:bg-neutral-100"
                onClick={() => setNavOpen(true)}
              >
                <MenuIcon />
              </button>
              <span className="ml-3 font-semibold">Prime Admin</span>
            </header>
            <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </AuthGuard>
  );
}
