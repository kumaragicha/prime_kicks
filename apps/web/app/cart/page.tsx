'use client';

import { Announcement } from '@/components/announcement';
import { Icon } from '@/components/icon';
import { SiteFooter } from '@/components/site-footer';
import { Toast } from '@/components/toast';
import { ApiError, api, type StoreCart } from '@/lib/api';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type AddressForm = {
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
};

const emptyAddress: AddressForm = {
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

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [address, setAddress] = useState<AddressForm>(emptyAddress);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const [errKey, setErrKey] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [addressBlock, setAddressBlock] = useState('');
  const [parsing, setParsing] = useState(false);

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
      cart?.items.reduce((total, item) => total + item.product.price * item.quantity, 0) ?? 0,
    [cart],
  );

  function updateField(field: keyof AddressForm, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function validateAddress(a: AddressForm): Partial<Record<keyof AddressForm, string>> {
    const e: Partial<Record<keyof AddressForm, string>> = {};
    if (!a.name.trim()) e.name = 'Please enter your full name.';
    // Email is now optional — only validate format if provided
    if (a.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim()))
      e.email = 'Enter a valid email address.';
    if (!a.mobileNo.trim()) e.mobileNo = 'Please enter your mobile number.';
    else if (!/^\d{10}$/.test(a.mobileNo.replace(/\D/g, '')))
      e.mobileNo = 'Enter a valid 10-digit mobile number.';
    // Alternative mobile is optional — only validate format if provided
    if (a.altMobileNo.trim() && !/^\d{10}$/.test(a.altMobileNo.replace(/\D/g, '')))
      e.altMobileNo = 'Enter a valid 10-digit alternative mobile number.';
    if (!a.line1.trim()) e.line1 = 'Please enter your address.';
    if (!a.pincode.trim()) e.pincode = 'Please enter your pincode.';
    else if (!/^\d{6}$/.test(a.pincode.trim())) e.pincode = 'Enter a valid 6-digit pincode.';
    if (!a.city.trim()) e.city = 'Please enter your city.';
    if (!a.state.trim()) e.state = 'Please enter your state.';
    return e;
  }

  // Keyed on errKey so every failed "Place order" attempt remounts the field and
  // replays the shake; typing doesn't change errKey, so focus is never lost.
  function renderField(field: keyof AddressForm, placeholder: string, type = 'text') {
    const err = errors[field];
    return (
      <div key={`${field}-${errKey}`}>
        <input
          className={`w-full border rounded-[8px] px-[13px] py-[11px] text-[13px] bg-white placeholder:text-[#aaa] outline-none transition-colors ${
            err
              ? 'border-red-400 focus:border-red-500 bg-red-50/40 animate-[shake_0.4s_ease]'
              : 'border-line focus:border-ink'
          }`}
          placeholder={placeholder}
          type={type}
          value={address[field]}
          onChange={(e) => updateField(field, e.target.value)}
          aria-invalid={err ? true : undefined}
        />
      </div>
    );
  }

  function goToShipping() {
    if (!cart || cart.items.length === 0) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function parseAddressBlock() {
    if (!addressBlock.trim()) {
      notify('Please paste an address block first.');
      return;
    }
    setParsing(true);
    try {
      const result = await api.parseAddress(addressBlock);
      const parsed = result.parsed;
      setAddress((prev) => ({
        ...prev,
        name: parsed.name || prev.name,
        email: parsed.email || prev.email,
        mobileNo: parsed.mobileNo || prev.mobileNo,
        altMobileNo: parsed.altMobileNo || prev.altMobileNo,
        line1: parsed.line1 || prev.line1,
        line2: parsed.line2 || prev.line2,
        landmark: parsed.landmark || prev.landmark,
        pincode: parsed.pincode || prev.pincode,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
      }));
      notify('Address parsed successfully!');
    } catch (error) {
      if (error instanceof ApiError) notify(error.message);
      else notify('Failed to parse address. Please try again.');
    } finally {
      setParsing(false);
    }
  }

  async function placeOrder() {
    if (!cart || cart.items.length === 0) return;
    const fieldErrors = validateAddress(address);
    const firstError = Object.values(fieldErrors)[0];
    if (firstError) {
      setErrors(fieldErrors);
      setErrKey((k) => k + 1); // re-trigger the shake animation on every attempt
      notify(firstError);
      return;
    }
    setErrors({});
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
      // Redirect to a dedicated confirmation route so the success screen has its
      // own URL — a refresh keeps showing it instead of falling back to the cart.
      router.replace(`/order-confirmed?order=${encodeURIComponent(result.orderNumber)}`);
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

      {
        <section className="max-w-[1280px] mx-auto pt-[68px] px-[5.25vw] pb-[100px] max-[760px]:pt-[43px] max-[760px]:px-[15px] max-[760px]:pb-[58px]">
          <div className="flex items-end justify-between border-b border-line pb-[30px] mb-[30px] max-[760px]:block max-[760px]:pb-[24px] max-[760px]:mb-[22px]">
            <h1 className="text-[clamp(46px,6vw,76px)] leading-[.8] tracking-[-.09em] m-0 max-[760px]:text-[53px] max-[760px]:mb-[25px]">
              Your <em className="font-[Georgia,serif] font-normal">bag.</em>
            </h1>
            {cart?.items.length === 0 && (
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
            <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-x-[60px] gap-y-[20px] items-start max-[760px]:grid-cols-1 max-[760px]:gap-y-[24px]">
              <div
                className={`grid gap-[14px] content-start col-start-1 row-start-1 row-span-2 max-[760px]:col-auto max-[760px]:row-auto max-[760px]:row-span-1 ${
                  step === 2 ? 'max-[760px]:order-2' : 'max-[760px]:order-1'
                }`}
              >
                {step === 1 ? (
                  cart.items.map((item) => (
                    <article
                      className="relative grid grid-cols-[150px_1fr_auto] gap-[20px] p-[14px] border border-line rounded-[14px] bg-white shadow-[0_7px_18px_rgba(28,22,16,0.05)] animate-[enter_0.35s_both] max-[760px]:grid-cols-[100px_1fr_auto] max-[760px]:gap-[13px] max-[760px]:p-[10px]"
                      key={item.id}
                    >
                      <Link
                        className="aspect-[1/1.05] overflow-hidden rounded-[10px] bg-[#e9e7e1]"
                        href={`/products/${item.product.id}`}
                      >
                        {item.product.photoUrls[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
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
                          {formatCurrency(item.product.price, item.product.currency)}
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
                  ))
                ) : (
                  /* Step 2: shipping address replaces the product list */
                  <aside className="border border-line rounded-[14px] p-[26px] bg-white shadow-[0_7px_18px_rgba(28,22,16,0.05)] animate-[enter_0.35s_both] max-[760px]:p-[18px]">
                    <p className="m-0 mb-[20px] text-[10px] tracking-[.16em] uppercase font-bold">
                      Shipping address
                    </p>

                    {/* Quick fill option - Paste address block (always visible) */}
                    <div className="mb-[20px]">
                      <p className="m-0 mb-[10px] text-[11px] text-[#666] font-bold">
                        📋 Quick Fill: Paste full address block (optional)
                      </p>
                      <div className="p-[16px] bg-[#f9f8f6] rounded-[10px] border border-dashed border-[#d6d1c7]">
                        <p className="m-0 mb-[10px] text-[11px] text-[#666]">
                          {`Paste the full address block here and click "Parse Address" to auto-fill
                          all fields: `}
                        </p>
                        <textarea
                          className="w-full border rounded-[8px] px-[13px] py-[11px] text-[13px] bg-white placeholder:text-[#aaa] outline-none transition-colors border-line focus:border-ink min-h-[100px] resize-y"
                          placeholder="Example:&#10;John Doe&#10;john@example.com&#10;9876543210&#10;123 Main Street, Apartment 4B&#10;Near City Mall&#10;Mumbai, Maharashtra 400001"
                          value={addressBlock}
                          onChange={(e) => setAddressBlock(e.target.value)}
                        />
                        <button
                          className="mt-[10px] w-full h-[42px] border-0 rounded-[8px] bg-ink text-white uppercase tracking-[.08em] text-[10px] font-bold flex items-center justify-center gap-[8px] disabled:cursor-not-allowed [&_svg]:w-[14px]"
                          disabled={parsing || !addressBlock.trim()}
                          onClick={parseAddressBlock}
                        >
                          {parsing ? (
                            <>
                              <i className="w-[14px] h-[14px] border-2 border-white/30 border-t-white rounded-full animate-[spin_0.8s_linear_infinite]" />{' '}
                              Parsing…
                            </>
                          ) : (
                            <>
                              <Icon name="search" /> Parse Address
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-[12px] mb-[20px]">
                      <div className="flex-1 h-px bg-[#ddd6c9]" />
                      <span className="text-[11px] text-[#999] uppercase tracking-[.08em] font-bold">
                        or enter manually
                      </span>
                      <div className="flex-1 h-px bg-[#ddd6c9]" />
                    </div>

                    {/* Manual entry form */}
                    <div className="grid gap-[14px]">
                      <div className="grid grid-cols-2 gap-[12px] items-start max-[480px]:grid-cols-1">
                        {renderField('name', 'Full name *')}
                        {renderField('email', 'Email (optional)', 'email')}
                      </div>
                      <div className="grid grid-cols-2 gap-[12px] items-start max-[480px]:grid-cols-1">
                        {renderField('mobileNo', 'Mobile number *')}
                        {renderField('altMobileNo', 'Alternative mobile (optional)')}
                      </div>
                      {renderField('line1', 'Address line 1 *')}
                      {renderField('line2', 'Address line 2')}
                      {renderField('landmark', 'Landmark')}
                      <div className="grid grid-cols-3 gap-[12px] items-start max-[480px]:grid-cols-1">
                        {renderField('pincode', 'Pincode *')}
                        {renderField('city', 'City *')}
                        {renderField('state', 'State *')}
                      </div>
                    </div>
                  </aside>
                )}
              </div>

              <div
                className={`grid gap-[20px] content-start col-start-2 row-start-1 max-[760px]:col-auto max-[760px]:row-auto ${
                  step === 2 ? 'max-[760px]:order-1' : 'max-[760px]:order-2'
                }`}
              >
                {/* Step indicator */}
                <div className="flex items-center gap-[10px] text-[10px] uppercase tracking-[.12em] font-bold">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={step === 1 ? 'text-ink' : 'text-[#b3ab9c]'}
                  >
                    1 · Bag
                  </button>
                  <span className="flex-1 h-px bg-[#ddd6c9]" />
                  <span className={step === 2 ? 'text-ink' : 'text-[#b3ab9c]'}>2 · Shipping</span>
                </div>

                {/* Order summary (both steps) */}
                <aside className="border border-ink rounded-[14px] p-[23px] bg-[#f5f2eb] shadow-[0_12px_25px_rgba(28,22,16,0.08)]">
                  <p className="m-0 mb-[22px] text-[10px] tracking-[.16em] uppercase font-bold">
                    Order summary
                  </p>
                  <div className="flex justify-between gap-[20px] text-[12px] py-[11px]">
                    <span className="text-[#666]">Subtotal</span>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>

                  <section className="flex justify-between gap-[20px] mt-[7px] border-t border-t-[#d6d1c7] pt-[18px] pb-[11px] text-[14px]">
                    <span>Total</span>
                    <strong className="text-[18px]">{formatCurrency(subtotal)}</strong>
                  </section>
                </aside>
              </div>

              {/* Actions block — always below the summary on mobile */}
              <div className="grid gap-[14px] content-start col-start-2 row-start-2 max-[760px]:col-auto max-[760px]:row-auto max-[760px]:order-3">
                {step === 1 ? (
                  /* Step 1: proceed to shipping */
                  <button
                    className="w-full h-[50px] border-0 rounded-[10px] bg-ink text-white uppercase tracking-[.08em] text-[11px] font-bold flex items-center justify-center gap-[12px] [&_svg]:w-[14px]"
                    onClick={goToShipping}
                  >
                    Continue to shipping <Icon name="arrow" />
                  </button>
                ) : (
                  <>
                    {/* Address verification line */}
                    <div className="border border-line rounded-[10px] p-[14px] bg-white">
                      <p className="m-0 mb-[8px] text-[10px] uppercase tracking-[.12em] font-bold text-[#999]">
                        Please verify your address & contact details before placing the order:
                      </p>
                    </div>

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

                    <button
                      type="button"
                      className="w-full text-center text-[10px] uppercase tracking-[.1em] font-bold text-[#76552a]"
                      onClick={() => setStep(1)}
                    >
                      ← Back to bag
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      }

      <Toast message={toast} visible={!!toast} />

      <SiteFooter />
    </main>
  );
}
