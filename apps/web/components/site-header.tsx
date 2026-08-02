'use client';

import { Icon } from '@/components/icon';
import { LoginModal } from '@/components/login-modal';
import { SearchPanel } from '@/components/search-panel';
import { notifyStore, useAuthCart } from '@/lib/hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

const navLinks = [
  { href: '/#new', label: 'New arrivals' },
  { href: '/#shop', label: 'Shop' },
  { href: '/#brands', label: 'Brands' },
  { href: '/#sale', label: 'Sale' },
];

/** Canonical storefront header, shared across home, search, product, and profile pages. */
export function SiteHeader() {
  const router = useRouter();
  const { user, cartCount, refresh } = useAuthCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // Close the menu when clicking outside (on the backdrop).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  function goAccount() {
    if (user) router.push('/profile');
    else setLoginOpen(true);
  }

  function goCart() {
    if (user) router.push('/cart');
    else setLoginOpen(true);
  }

  return (
    <>
      <header className="h-[73px] px-[5.25vw] flex items-center justify-between border-b border-line bg-[rgba(255,255,255,0.92)] backdrop-blur-[12px] sticky top-0 z-10 max-[800px]:h-[62px] max-[800px]:px-[15px]">
        <Link
          className="font-[900] tracking-[-.09em] text-ink no-underline text-[21px] [transform:skew(-9deg)] max-[800px]:text-[19px]"
          href="/"
          aria-label="Prime Kicks home"
        >
          PRIME<span className="font-normal ml-[3px]">KICKS</span>
        </Link>
        <nav
          className="flex items-center gap-[32px] ml-[55px] max-[800px]:hidden"
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              className="text-ink no-underline uppercase text-[11px] tracking-[.08em] font-bold"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
          {user && (
            <>
              <Link
                className="text-ink no-underline uppercase text-[11px] tracking-[.08em] font-bold"
                href="/profile"
              >
                My account
              </Link>
              <Link
                className="text-ink no-underline uppercase text-[11px] tracking-[.08em] font-bold"
                href="/orders"
              >
                My orders
              </Link>
            </>
          )}
        </nav>
        <div className="flex gap-[7px] items-center max-[800px]:gap-[1px]">
          <button
            className="relative border-0 bg-transparent w-[34px] h-[38px] p-[8px] text-ink max-[800px]:w-[35px] [&_svg]:w-[19px] [&_svg]:h-[19px]"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Icon name="search" />
          </button>
          <button
            className="relative border-0 bg-transparent w-[34px] h-[38px] p-[8px] text-ink max-[800px]:w-[35px] [&_svg]:w-[19px] [&_svg]:h-[19px]"
            onClick={goAccount}
            aria-label={user ? `Open ${user.name}'s profile` : 'Account login'}
          >
            {user ? (
              <span className="grid place-items-center w-[22px] h-[22px] rounded-full bg-ink text-white text-[9px] font-bold tracking-[.02em]">
                {getInitials(user.name)}
              </span>
            ) : (
              <Icon name="user" />
            )}
          </button>
          <button
            className="relative border-0 bg-transparent w-[34px] h-[38px] p-[8px] text-ink max-[800px]:w-[35px] [&_svg]:w-[19px] [&_svg]:h-[19px]"
            onClick={goCart}
            aria-label={`Shopping bag with ${cartCount} items`}
          >
            <Icon name="bag" />
            {cartCount > 0 && (
              <b className="absolute top-[2px] right-0 grid place-items-center bg-ink text-white w-[14px] h-[14px] rounded-full text-[8px]">
                {cartCount}
              </b>
            )}
          </button>
          <button
            className="hidden max-[800px]:block relative border-0 bg-transparent w-[34px] h-[38px] p-[8px] text-ink max-[800px]:w-[35px] [&_svg]:w-[19px] [&_svg]:h-[19px]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          {/* Backdrop — click anywhere outside the menu to close it */}
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[8] bg-black/30 animate-[fade_0.18s_ease-out] max-[800px]:block"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="fixed top-0 left-0 right-0 pt-[62px] px-[6vw] pb-[29px] z-[9] bg-paper border-b border-line grid gap-[20px] animate-[drop_0.22s_ease-out] max-[800px]:pt-[62px]">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                className="text-ink no-underline uppercase text-[14px] tracking-[.08em] font-bold"
                href={link.href}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <button
              className="text-ink bg-transparent border-0 p-0 text-left uppercase text-[14px] tracking-[.08em] font-bold"
              onClick={() => {
                setMenuOpen(false);
                goAccount();
              }}
            >
              {user ? 'My account' : 'Sign in'}
            </button>
            {user && (
              <Link
                className="text-ink no-underline uppercase text-[14px] tracking-[.08em] font-bold"
                href="/orders"
                onClick={() => setMenuOpen(false)}
              >
                My orders
              </Link>
            )}
          </nav>
        </>
      )}

      {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onSuccess={() => {
            void refresh();
            notifyStore();
          }}
        />
      )}
    </>
  );
}
