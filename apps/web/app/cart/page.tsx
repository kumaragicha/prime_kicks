'use client';

import { Announcement } from '@/components/announcement';
import { Icon } from '@/components/icon';
import { ApiError, api, type StoreCart } from '@/lib/api';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Transient banner for quantity/stock/checkout feedback while the bag is on screen.
  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 2800);
  }

  const load = useCallback(async () => {
    try {
      setCart(await api.getCart());
    } catch (error) {
      if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
        window.localStorage.setItem('prime-kicks-open-login', 'true');
        router.replace('/');
      } else setMessage('We couldn’t load your bag.');
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    if (!window.localStorage.getItem('prime-kicks-access-token')) {
      window.localStorage.setItem('prime-kicks-open-login', 'true');
      router.replace('/');
      return;
    }
    void load();
  }, [load, router]);
  async function update(itemId: string, quantity: number) {
    setPending(itemId);
    try {
      setCart(await api.updateCartItem(itemId, quantity));
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) notify(error.message);
      else notify('We couldn’t update this item.');
    } finally {
      setPending(null);
    }
  }
  async function remove(itemId: string) {
    setPending(itemId);
    try {
      setCart(await api.removeCartItem(itemId));
    } catch {
      notify('We couldn’t remove this item.');
    } finally {
      setPending(null);
    }
  }
  const subtotal = useMemo(
    () =>
      cart?.items.reduce((total, item) => total + item.product.customerPrice * item.quantity, 0) ??
      0,
    [cart],
  );

  return (
    <main>
      <Announcement />
      <header className="h-[73px] px-[5.25vw] flex items-center justify-between border-b border-line bg-[rgba(255,255,255,0.92)] backdrop-blur-[12px] sticky top-0 z-10 max-[800px]:h-[62px] max-[800px]:px-[15px]">
        <Link
          className="font-[900] tracking-[-.09em] text-ink no-underline text-[21px] [transform:skew(-9deg)] max-[800px]:text-[19px]"
          href="/"
        >
          PRIME<span className="font-normal ml-[3px]">KICKS</span>
        </Link>
        <nav className="hidden">
          <Link
            className="text-ink no-underline uppercase text-[11px] tracking-[.08em] font-bold"
            href="/#new"
          >
            New arrivals
          </Link>
          <Link
            className="text-ink no-underline uppercase text-[11px] tracking-[.08em] font-bold"
            href="/#shop"
          >
            Shop
          </Link>
          <Link
            className="text-ink no-underline uppercase text-[11px] tracking-[.08em] font-bold"
            href="/#brands"
          >
            Brands
          </Link>
          <Link
            className="text-ink no-underline uppercase text-[11px] tracking-[.08em] font-bold"
            href="/#sale"
          >
            Sale
          </Link>
        </nav>
        <div className="flex gap-[7px] items-center max-[800px]:gap-[1px]">
          <button
            className="block relative border-0 bg-transparent w-[34px] h-[38px] p-[8px] text-ink max-[800px]:w-[35px] [&_svg]:w-[19px] [&_svg]:h-[19px]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </header>
      {menuOpen && (
        <nav className="fixed top-[107px] left-0 right-0 px-[6vw] pt-[24px] pb-[29px] z-[9] bg-paper border-b border-line grid gap-[20px] animate-[drop_0.22s_ease-out] max-[800px]:top-[92px]">
          <Link
            className="text-ink no-underline uppercase tracking-[.08em] font-bold text-[14px]"
            href="/#new"
            onClick={() => setMenuOpen(false)}
          >
            New arrivals
          </Link>
          <Link
            className="text-ink no-underline uppercase tracking-[.08em] font-bold text-[14px]"
            href="/#shop"
            onClick={() => setMenuOpen(false)}
          >
            Shop all
          </Link>
          <Link
            className="text-ink no-underline uppercase tracking-[.08em] font-bold text-[14px]"
            href="/#brands"
            onClick={() => setMenuOpen(false)}
          >
            Brands
          </Link>
          <Link
            className="text-ink no-underline uppercase tracking-[.08em] font-bold text-[14px]"
            href="/#sale"
            onClick={() => setMenuOpen(false)}
          >
            Sale
          </Link>
          <Link
            className="text-ink no-underline uppercase tracking-[.08em] font-bold text-[14px]"
            href="/profile"
            onClick={() => setMenuOpen(false)}
          >
            Account
          </Link>
        </nav>
      )}
      <section className="max-w-[1280px] mx-auto pt-[68px] px-[5.25vw] pb-[100px] max-[760px]:pt-[43px] max-[760px]:px-[15px] max-[760px]:pb-[58px]">
        <div className="flex items-end justify-between border-b border-line pb-[30px] mb-[30px] max-[760px]:block max-[760px]:pb-[24px] max-[760px]:mb-[22px]">
          <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold text-[#76552a]">
            Your selection
          </p>
          <h1 className="text-[clamp(46px,6vw,76px)] leading-[.8] tracking-[-.09em] m-0 max-[760px]:text-[53px] max-[760px]:mb-[25px]">
            Your <em className="font-[Georgia,serif] font-normal">bag.</em>
          </h1>
          {(cart?.items.length ?? 0) > 0 && (
            <Link
              className="inline-flex items-center gap-[15px] bg-ink text-white px-[15px] py-[13px] no-underline uppercase tracking-[.08em] text-[10px] font-bold [&_svg]:w-[14px]"
              href="/"
            >
              Continue shopping <Icon name="arrow" />
            </Link>
          )}
        </div>
        {loading ? (
          <div className="min-h-[280px] grid place-content-center justify-items-center gap-[18px] text-center text-[#666] text-[10px] uppercase tracking-[.1em]">
            <i className="w-[17px] h-[17px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
            Loading your bag
          </div>
        ) : !cart ? (
          <div className="min-h-[280px] grid place-content-center justify-items-center gap-[18px] text-center text-[#666] text-[13px]">
            <p>{message || 'Sign in to see your bag.'}</p>
          </div>
        ) : cart.items.length === 0 ? (
          <div className="min-h-[280px] grid place-content-center justify-items-center gap-[18px] text-center text-[#666] text-[13px]">
            <p>Your bag is waiting for a pair.</p>
            <Link
              className="inline-flex items-center gap-[15px] bg-ink text-white px-[15px] py-[13px] no-underline uppercase tracking-[.08em] text-[10px] font-bold [&_svg]:w-[14px]"
              href="/"
            >
              Explore new arrivals <Icon name="arrow" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_330px] gap-[60px] items-start max-[760px]:block">
            <section className="grid gap-[14px]">
              {cart.items.map((item) => (
                <article
                  className="relative grid grid-cols-[150px_1fr_auto] gap-[20px] p-[14px] border border-line rounded-[14px] bg-white shadow-[0_7px_18px_rgba(28,22,16,0.05)] animate-[enter_0.35s_both] max-[760px]:grid-cols-[100px_1fr_auto] max-[760px]:gap-[13px] max-[760px]:p-[10px]"
                  key={item.id}
                >
                  <Link
                    className="aspect-[1/1.05] overflow-hidden rounded-[10px] bg-[#e9e7e1]"
                    href={`/products/${item.product.id}`}
                  >
                    {item.product.photoUrls[0] ? (
                      <img
                        className="w-full h-full object-cover"
                        src={item.product.photoUrls[0]}
                        alt={item.product.name}
                      />
                    ) : (
                      <span className="h-full grid place-items-center text-[11px] font-bold">
                        {item.product.brand}
                      </span>
                    )}
                  </Link>
                  <div className="grid content-start">
                    <p className="mx-0 mt-[2px] mb-[6px] text-[9px] uppercase tracking-[.09em] font-bold">
                      {item.product.brand}
                    </p>
                    <h2 className="text-[20px] tracking-[-.055em] leading-none m-0 max-[760px]:text-[17px]">
                      {item.product.name}
                    </h2>
                    <span className="text-[11px] text-[#777] my-[9px] max-[760px]:my-[7px]">
                      Size {item.variant.size.label}
                    </span>
                    <strong className="text-[14px]">
                      {formatCurrency(item.product.customerPrice, item.product.currency)}
                    </strong>
                    <div className="flex items-center gap-[11px] mt-[17px] max-[760px]:mt-[12px] [&_svg]:w-[13px]">
                      <button
                        className="w-[28px] h-[28px] border border-line rounded-[7px] bg-white grid place-items-center disabled:opacity-40"
                        disabled={pending === item.id || item.quantity === 1}
                        onClick={() => update(item.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        <Icon name="minus" />
                      </button>
                      <b className="text-[12px] min-w-[10px] text-center">{item.quantity}</b>
                      <button
                        className="w-[28px] h-[28px] border border-line rounded-[7px] bg-white grid place-items-center disabled:opacity-40"
                        disabled={pending === item.id}
                        onClick={() => update(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Icon name="plus" />
                      </button>
                    </div>
                  </div>
                  <button
                    className="w-[31px] h-[31px] border-0 bg-transparent text-[#777] p-[7px] [&_svg]:w-[17px]"
                    disabled={pending === item.id}
                    onClick={() => remove(item.id)}
                    aria-label={`Remove ${item.product.name}`}
                  >
                    <Icon name="trash" />
                  </button>
                </article>
              ))}
            </section>
            <aside className="border border-ink rounded-[14px] p-[23px] bg-[#f5f2eb] shadow-[0_12px_25px_rgba(28,22,16,0.08)] max-[760px]:mt-[25px]">
              <p className="m-0 mb-[22px] text-[10px] tracking-[.16em] uppercase font-bold">
                Order summary
              </p>
              <div className="flex justify-between gap-[20px] text-[12px] py-[11px]">
                <span className="text-[#666]">Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <div className="flex justify-between gap-[20px] text-[12px] py-[11px]">
                <span className="text-[#666]">Express shipping</span>
                <b className="text-[10px]">
                  {subtotal >= 10000 ? 'Free' : 'Calculated at checkout'}
                </b>
              </div>
              <section className="flex justify-between gap-[20px] mt-[7px] border-t border-t-[#d6d1c7] pt-[18px] pb-[11px] text-[14px]">
                <span>Total</span>
                <strong className="text-[18px]">{formatCurrency(subtotal)}</strong>
              </section>
              <button
                className="w-full h-[47px] mt-[17px] border-0 rounded-[8px] bg-ink text-white uppercase tracking-[.08em] text-[10px] font-bold flex items-center justify-center gap-[17px] [&_svg]:w-[14px]"
                onClick={() => notify('Checkout is the next step to connect.')}
              >
                Proceed to checkout <Icon name="arrow" />
              </button>
              <p className="text-center text-[#777] text-[10px] mx-0 mt-[15px] mb-0">
                Authenticated pairs. Secure checkout.
              </p>
            </aside>
          </div>
        )}
      </section>
      {toast && (
        <div
          className="fixed z-30 left-1/2 bottom-[23px] bg-accent text-ink rounded-[10px] py-[13px] px-[17px] text-[11px] font-bold flex items-center gap-[8px] shadow-[0_10px_28px_rgba(0,0,0,0.28)] animate-[toast_0.25s_ease-out_both] [&_svg]:w-[16px] max-[800px]:w-max max-[800px]:max-w-[calc(100%-30px)]"
          role="status"
        >
          <Icon name="bag" /> {toast}
        </div>
      )}
      <footer className="bg-[#111] text-white pt-[27px] px-[5.25vw] pb-[21px] max-[800px]:px-[21px] max-[800px]:pb-[19px] max-[760px]:pt-[22px] max-[760px]:px-[15px] max-[760px]:pb-[22px]">
        <div className="flex justify-between gap-[20px] text-[#888] text-[9px] uppercase tracking-[.07em] border-0 p-0 max-[800px]:grid max-[800px]:gap-[17px] max-[800px]:leading-[1.4] max-[760px]:flex">
          <span>© 2026 Prime Kicks. All rights reserved.</span>
          <div className="flex gap-[20px] max-[800px]:gap-[14px] max-[800px]:flex-wrap max-[760px]:hidden">
            <a className="text-white no-underline hover:underline" href="https://instagram.com">
              Instagram
            </a>
            <a className="text-white no-underline hover:underline" href="https://facebook.com">
              Facebook
            </a>
            <a className="text-white no-underline hover:underline" href="https://x.com">
              X / Twitter
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
