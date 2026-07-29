'use client';

import { Announcement } from '@/components/announcement';
import { Icon } from '@/components/icon';
import { SiteFooter } from '@/components/site-footer';
import { ApiError, api, type StoreCart } from '@/lib/api';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type AddressForm = {
  name: string;
  email: string;
  mobileNo: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
};

const emptyAddress: AddressForm = {
  name: '',
  email: '',
  mobileNo: '',
  line1: '',
  line2: '',
  landmark: '',
  pincode: '',
  city: '',
  state: '',
};

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [address, setAddress] = useState<AddressForm>(emptyAddress);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

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
      } else setMessage("We couldn't load your bag.");
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
      else notify("We couldn't update this item.");
    } finally {
      setPending(null);
    }
  }
  async function remove(itemId: string) {
    setPending(itemId);
    try {
      setCart(await api.removeCartItem(itemId));
    } catch {
      notify("We couldn't remove this item.");
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

  function updateField(field: keyof AddressForm, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  async function placeOrder() {
    if (!cart || cart.items.length === 0) return;
    if (
      !address.name ||
      !address.email ||
      !address.mobileNo ||
      !address.line1 ||
      !address.pincode ||
      !address.city ||
      !address.state
    ) {
      notify('Please fill in all required address fields.');
      return;
    }
    setPlacing(true);
    try {
      const result = await api.createOrder({
        items: cart.items.map((item) => ({
          productId: item.product.id,
          variantId: item.variant.id,
          quantity: item.quantity,
        })),
        address,
      });
      setOrderNumber(result.orderNumber);
      setPlaced(true);
      setCart(null);
    } catch (error) {
      if (error instanceof ApiError) notify(error.message);
      else notify('Something went wrong. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

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

      {placed ? (
        <section className="max-w-[600px] mx-auto pt-[100px] px-[5.25vw] pb-[100px] text-center">
          <div className="mb-[30px]">
            <span className="inline-flex items-center justify-center w-[60px] h-[60px] rounded-full bg-green-100 text-green-700 mb-[20px]">
              <svg
                viewBox="0 0 24 24"
                className="w-[30px] h-[30px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <h1 className="text-[clamp(36px,5vw,56px)] leading-[.8] tracking-[-.09em] m-0 mb-[15px]">
              Order <em className="font-[Georgia,serif] font-normal">placed.</em>
            </h1>
            <p className="text-[#666] text-[13px] mb-[5px]">Your order number is</p>
            <p className="text-[18px] font-bold tracking-[-.02em]">{orderNumber}</p>
            <p className="text-[#666] text-[12px] mt-[15px]">
              We&apos;ll send you a confirmation once it ships.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-[15px] bg-ink text-white px-[20px] py-[13px] no-underline uppercase tracking-[.08em] text-[10px] font-bold rounded-[8px] [&_svg]:w-[14px]"
            href="/"
          >
            Continue shopping <Icon name="arrow" />
          </Link>
        </section>
      ) : (
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
            <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-[60px] items-start max-[760px]:block">
              <div className="grid gap-[14px]">
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
              </div>

              <div className="grid gap-[20px]">
                {/* Order summary */}
                <aside className="border border-ink rounded-[14px] p-[23px] bg-[#f5f2eb] shadow-[0_12px_25px_rgba(28,22,16,0.08)]">
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
                </aside>

                {/* Address form */}
                <aside className="border border-line rounded-[14px] p-[23px] bg-white shadow-[0_7px_18px_rgba(28,22,16,0.05)]">
                  <button
                    className="w-full flex items-center justify-between text-left"
                    onClick={() => setShowAddress(!showAddress)}
                  >
                    <p className="m-0 text-[10px] tracking-[.16em] uppercase font-bold">
                      Shipping address
                    </p>
                    <span className={`transition-transform ${showAddress ? 'rotate-180' : ''}`}>
                      <svg
                        viewBox="0 0 24 24"
                        className="w-[14px] h-[14px]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  {showAddress && (
                    <div className="mt-[18px] grid gap-[12px]">
                      <div className="grid grid-cols-2 gap-[10px]">
                        <input
                          className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                          placeholder="Full name *"
                          value={address.name}
                          onChange={(e) => updateField('name', e.target.value)}
                        />
                        <input
                          className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                          placeholder="Email *"
                          type="email"
                          value={address.email}
                          onChange={(e) => updateField('email', e.target.value)}
                        />
                      </div>
                      <input
                        className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                        placeholder="Mobile number *"
                        value={address.mobileNo}
                        onChange={(e) => updateField('mobileNo', e.target.value)}
                      />
                      <input
                        className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                        placeholder="Address line 1 *"
                        value={address.line1}
                        onChange={(e) => updateField('line1', e.target.value)}
                      />
                      <input
                        className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                        placeholder="Address line 2"
                        value={address.line2}
                        onChange={(e) => updateField('line2', e.target.value)}
                      />
                      <input
                        className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                        placeholder="Landmark"
                        value={address.landmark}
                        onChange={(e) => updateField('landmark', e.target.value)}
                      />
                      <div className="grid grid-cols-3 gap-[10px]">
                        <input
                          className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                          placeholder="Pincode *"
                          value={address.pincode}
                          onChange={(e) => updateField('pincode', e.target.value)}
                        />
                        <input
                          className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                          placeholder="City *"
                          value={address.city}
                          onChange={(e) => updateField('city', e.target.value)}
                        />
                        <input
                          className="w-full border border-line rounded-[8px] px-[12px] py-[10px] text-[12px] bg-white placeholder:text-[#aaa] outline-none focus:border-ink"
                          placeholder="State *"
                          value={address.state}
                          onChange={(e) => updateField('state', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </aside>

                {/* Place order button */}
                <button
                  className="w-full h-[50px] border-0 rounded-[10px] bg-ink text-white uppercase tracking-[.08em] text-[11px] font-bold flex items-center justify-center gap-[12px] disabled:opacity-50 [&_svg]:w-[14px]"
                  disabled={placing}
                  onClick={placeOrder}
                >
                  {placing ? (
                    <>
                      <i className="w-[15px] h-[15px] border-2 border-white/30 border-t-white rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
                      Placing order…
                    </>
                  ) : (
                    <>
                      <Icon name="bag" /> Place order
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {toast && (
        <div
          className="fixed z-30 left-1/2 bottom-[23px] bg-accent text-ink rounded-[10px] py-[13px] px-[17px] text-[11px] font-bold flex items-center gap-[8px] shadow-[0_10px_28px_rgba(0,0,0,0.28)] animate-[toast_0.25s_ease-out_both] [&_svg]:w-[16px] max-[800px]:w-max max-[800px]:max-w-[calc(100%-30px)]"
          role="status"
        >
          <Icon name="bag" /> {toast}
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
