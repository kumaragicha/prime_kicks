'use client';

import { AuthGuard, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';
import { Button } from '@prime-kicks/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState, type ReactNode } from 'react';

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

/** Shared props for the small line icons used in the nav. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 min-h-5 min-w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const LogoutIcon = () => (
  <Icon>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
  </Icon>
);

/** Nav items with an icon each. `adminOnly` items only render for ADMINs. */
const NAV: Array<{ href: string; label: string; icon: ReactNode; adminOnly: boolean }> = [
  {
    href: '/',
    label: 'Dashboard',
    adminOnly: true,
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </Icon>
    ),
  },
  {
    href: '/products',
    label: 'Products',
    adminOnly: false,
    icon: (
      <Icon>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.3 7l8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </Icon>
    ),
  },
  {
    href: '/users',
    label: 'Users',
    adminOnly: true,
    icon: (
      <Icon>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </Icon>
    ),
  },
  {
    href: '/orders',
    label: 'Orders',
    adminOnly: true,
    icon: (
      <Icon>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </Icon>
    ),
  },
  {
    href: '/payments',
    label: 'Payment Pending',
    adminOnly: true,
    icon: (
      <Icon>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </Icon>
    ),
  },
  {
    href: '/inventory',
    label: 'Inventory',
    adminOnly: true,
    icon: (
      <Icon>
        <path d="M20 8v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8" />
        <path d="M2 4h20v4H2z" />
        <path d="M10 12h4" />
      </Icon>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    adminOnly: true,
    icon: (
      <Icon>
        <line x1="3" y1="3" x2="3" y2="21" />
        <line x1="3" y1="21" x2="21" y2="21" />
        <rect x="7" y="12" width="3" height="6" />
        <rect x="12" y="8" width="3" height="10" />
        <rect x="17" y="4" width="3" height="14" />
      </Icon>
    ),
  },
  {
    href: '/audit-logs',
    label: 'Audit Log',
    adminOnly: true,
    icon: (
      <Icon>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </Icon>
    ),
  },
];

// Labels/text fade in only when the (desktop) sidebar is expanded on hover.
// Below `lg` (the mobile drawer) they're always visible.
const LABEL =
  'whitespace-nowrap transition-opacity duration-150 lg:opacity-0 lg:group-hover:opacity-100';

const MastersIcon = () => (
  <Icon>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </Icon>
);

/** The six masters shown as sub-options directly inside the sidebar. */
const MASTER_SUB: Array<{ href: string; label: string }> = [
  { href: '/masters/brands', label: 'Brands' },
  { href: '/masters/product-types', label: 'Product Types' },
  { href: '/masters/categories', label: 'Categories' },
  { href: '/masters/tags', label: 'Tags' },
  { href: '/size-types', label: 'Sizes' },
  { href: '/dimensions', label: 'Dimensions' },
];

const SettingsIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
);

/** Sub-options for the Settings group. */
const SETTINGS_SUB: Array<{ href: string; label: string }> = [
  { href: '/hero', label: 'Hero Banner' },
  { href: '/settings/shipmozo', label: 'Shipmozo Config' },
  { href: '/settings/courier-config', label: 'Courier Config' },
];

/**
 * A collapsible sidebar group: an icon + label + chevron that expands to show
 * its sub-links inline. Shows as "selected" when any sub-link (or an extra base
 * path) is active, and auto-opens on those pages. Children are hidden on the
 * collapsed desktop rail and revealed on hover (or always, on mobile).
 */
function NavGroup({
  icon,
  label,
  items,
  extraActive = [],
  onClose,
}: {
  icon: ReactNode;
  label: string;
  items: Array<{ href: string; label: string }>;
  extraActive?: string[];
  onClose: () => void;
}) {
  const pathname = usePathname();
  const active = items.some((s) => pathname === s.href) || extraActive.some((p) => pathname === p);
  const [open, setOpen] = useState(active);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={label}
        className={`flex w-full items-center gap-3 overflow-hidden rounded px-2.5 py-2 transition-colors ${
          active
            ? 'bg-neutral-100 font-medium text-neutral-900'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`}
      >
        {icon}
        <span className={LABEL}>{label}</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-150 ${LABEL} ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      {open && (
        <div className="mt-1 ml-4 hidden flex-col gap-1 border-l border-neutral-200 pl-2 max-lg:flex lg:group-hover:flex">
          {items.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              onClick={onClose}
              className={`flex items-center gap-2 overflow-hidden rounded px-2.5 py-1.5 text-[13px] transition-colors ${
                pathname === s.href
                  ? 'bg-black text-white font-medium'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  pathname === s.href ? 'bg-white' : 'bg-neutral-400'
                }`}
              />
              <span className="whitespace-nowrap">{s.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `flex items-center gap-3 overflow-hidden rounded px-2.5 py-2 transition-colors ${
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
      {/*
        Desktop: collapsed to an icon rail (w-16) by default and expands to w-56
        on hover — as a floating overlay (the content padding stays at the
        collapsed width), so the main view keeps full width until you hover.
        Mobile: the usual slide-in drawer at w-72 with labels always shown.
      */}
      <aside
        className={`group fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-neutral-200 bg-white p-4 shadow-xl transition-all duration-200 lg:w-16 lg:translate-x-0 lg:p-3 lg:shadow-none lg:hover:w-56 lg:hover:shadow-xl ${open ? 'translate-x-0' : ''}`}
      >
        <div className="mb-8 flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span className="flex h-8 w-8 min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md bg-black text-sm text-white">
              PK
            </span>
            <span className={LABEL}>Prime Admin</span>
          </div>
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
          {NAV.filter((item) => !item.adminOnly || user?.role === 'ADMIN').map((item) => (
            <Fragment key={item.href}>
              <Link
                className={linkClass(item.href)}
                href={item.href}
                onClick={onClose}
                title={item.label}
              >
                {item.icon}
                <span className={LABEL}>{item.label}</span>
              </Link>

              {/* Masters: an in-place expandable group (no separate page). */}
              {item.href === '/products' && user?.role === 'ADMIN' && (
                <NavGroup
                  icon={<MastersIcon />}
                  label="Masters"
                  items={MASTER_SUB}
                  extraActive={['/masters']}
                  onClose={onClose}
                />
              )}
            </Fragment>
          ))}

          {user?.role === 'ADMIN' && (
            <NavGroup
              icon={<SettingsIcon />}
              label="Settings"
              items={SETTINGS_SUB}
              onClose={onClose}
            />
          )}
        </nav>

        <div className="mt-6 overflow-hidden border-t border-neutral-200 pt-4">
          <div className={LABEL}>
            <p className="truncate text-sm font-medium text-neutral-900">{user?.name}</p>
            <p className="mb-3 truncate text-xs text-neutral-500">{user?.role}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex w-full items-center justify-center gap-2"
            onClick={() => void logout()}
            title="Log out"
          >
            <LogoutIcon />
            <span className={LABEL}>Log out</span>
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
          {/* Content padding matches the COLLAPSED rail width so the sidebar
              expands over the content on hover instead of pushing it. */}
          <div className="min-w-0 lg:pl-16">
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
