'use client';

import { Announcement } from '@/components/announcement';
import { BlurImage } from '@/components/blur-image';
import { Icon } from '@/components/icon';
import { PaymentBadges } from '@/components/payment-badges';
import { SiteFooter } from '@/components/site-footer';
import { Toast } from '@/components/toast';
import { ApiError, api, type SavedAddress, type StoreCart } from '@/lib/api';
import { celebrateFromBottom } from '@/lib/celebrate';
import { DELIVERY_WINDOW, expectedDeliveryDate, formatDeliveryDate } from '@/lib/delivery';
import { COD_ADVANCE_PERCENT, splitPayment, type PaymentMethod } from '@prime-kicks/types';
import { formatCurrency } from '@prime-kicks/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Razorpay Checkout's own global, injected by the script we load lazily below.
// Only the handful of fields this page actually uses are typed.
interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  /**
   * Where Razorpay form-POSTs the result when a payment method forces the
   * browser to leave this page entirely (e.g. a bank's own 3-D Secure/OTP
   * page) — the in-page `handler` below never gets a chance to fire there,
   * since that JS context is gone. See POST /payments/razorpay/callback.
   */
  callback_url?: string;
  /** Required alongside callback_url, or Razorpay ignores it and stays in-page. */
  redirect?: boolean;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let razorpayScriptPromise: Promise<boolean> | null = null;

/** Loads Razorpay's Checkout script once and caches the (shared) promise. */
function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = RAZORPAY_CHECKOUT_SRC;
      script.onload = () => resolve(true);
      script.onerror = () => {
        razorpayScriptPromise = null; // allow a retry on the next attempt
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

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

/** Checkout consent checkbox — must be ticked before an order can be placed. */
function TermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-[10px] border border-line rounded-[10px] p-[14px] bg-white cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[2px] w-[16px] h-[16px] shrink-0 accent-[#111]"
      />
      <span className="text-[11.5px] leading-[1.5] text-[#555]">
        I agree to the{' '}
        <Link className="text-ink underline" href="/terms" target="_blank" rel="noreferrer">
          Terms &amp; Conditions
        </Link>
        ,{' '}
        <Link
          className="text-ink underline"
          href="/privacy-policy"
          target="_blank"
          rel="noreferrer"
        >
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link className="text-ink underline" href="/refund-policy" target="_blank" rel="noreferrer">
          Refund Policy
        </Link>
        .
      </span>
    </label>
  );
}

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
  // Customer site: 1 Bag → 2 Address → 3 Payment. (Reseller never leaves step 1.)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ONLINE');
  // A prepaid-only coupon removed because the customer picked COD — kept so we
  // can say so on the COD option and offer a one-tap re-apply for online payment.
  const [removedCoupon, setRemovedCoupon] = useState<{
    code: string;
    discount: number;
    prepaidOnly: boolean;
  } | null>(null);
  const [address, setAddress] = useState<AddressForm>(emptyAddress);
  // Customer site: saved addresses offered as selectable cards at checkout.
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  // 'list' = pick a saved card; 'form' = type a new address or edit a saved one.
  const [addressMode, setAddressMode] = useState<'list' | 'form'>('form');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressMenuId, setAddressMenuId] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const savedAddressLoadedRef = useRef(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const [errKey, setErrKey] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isPickup, setIsPickup] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  // The reseller app has no address step — one tap places the order.
  const skipAddress = process.env.NEXT_PUBLIC_STOREFRONT === 'reseller';
  // Online prepayment is web-only — reseller/credit orders keep today's
  // admin-confirms-payment-manually flow, completely untouched.
  const payOnline = process.env.NEXT_PUBLIC_STOREFRONT !== 'reseller';
  // Per-unit amount stripped from reseller prices on pickup/label orders.
  const [shippingDeduction, setShippingDeduction] = useState(0);
  // Coupon state (web customers only). `applied` holds the validated discount.
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    prepaidOnly: boolean;
  } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  // Idempotency key for the in-flight checkout; survives retries, cleared on success.
  const idempotencyKeyRef = useRef<string | null>(null);
  const isReseller = userRole === 'RESELLER';
  // Coupons are web-storefront (prepaid) + customer only.
  const couponsEnabled = payOnline && !isReseller;
  // Customer prices already include shipping — show that on the customer store
  // (resellers have their own wholesale terms).
  const shippingIncluded = payOnline && !isReseller;
  // Mobile bag step: Total + checkout live in a bar pinned to the bottom, so the
  // in-flow actions block is empty there (unless a reseller needs the pickup toggle).
  const stickyCheckout = step === 1 && !isPickup && !skipAddress;
  const actionsEmptyOnMobile = stickyCheckout && !isReseller;
  // The checkout (address) step is just the form + a pinned bar on every screen size.
  const onCheckoutStep = step === 2 || step === 3;
  const onPaymentStep = step === 3;
  const showStickyBar = Boolean(
    cart && cart.items.length > 0 && (stickyCheckout || onCheckoutStep),
  );

  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 4800);
  }

  const load = useCallback(async () => {
    try {
      const [cartResult, meResult, pricingResult] = await Promise.allSettled([
        api.getCart(),
        api.me(),
        api.getPricingSetting(),
      ]);
      if (cartResult.status === 'fulfilled') setCart(cartResult.value);
      else if (cartResult.status === 'rejected') throw cartResult.reason;
      if (meResult.status === 'fulfilled') setUserRole(meResult.value.role);
      if (pricingResult.status === 'fulfilled')
        setShippingDeduction(pricingResult.value.resellerShippingDeduction ?? 0);
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
      notify(error instanceof ApiError ? error.message : "We couldn't update this item.");
    } finally {
      setPending(null);
    }
  }
  async function remove(itemId: string) {
    setPending(itemId);
    try {
      setCart(await api.removeCartItem(itemId));
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "We couldn't remove this item.");
    } finally {
      setPending(null);
    }
  }

  const subtotal = useMemo(
    () => cart?.items.reduce((total, item) => total + item.product.price * item.quantity, 0) ?? 0,
    [cart],
  );

  // Reseller prices include shipping. When a reseller self-handles delivery
  // (pickup / label), preview the per-unit shipping deduction — clamped per line
  // so a price never goes below 0. Mirrors the authoritative backend calc.
  const pickupDiscount = useMemo(() => {
    if (!isReseller || !isPickup || shippingDeduction <= 0) return 0;
    return (
      cart?.items.reduce(
        (sum, item) => sum + Math.min(item.product.price, shippingDeduction) * item.quantity,
        0,
      ) ?? 0
    );
  }, [cart, isReseller, isPickup, shippingDeduction]);
  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  // A prepaid-only coupon (e.g. PREPAID10) doesn't apply to COD — it stays
  // remembered and comes back if the customer switches to paying online.
  const couponActive = Boolean(
    appliedCoupon && (paymentMethod === 'ONLINE' || !appliedCoupon.prepaidOnly),
  );
  const couponDiscount = couponActive ? (appliedCoupon?.discount ?? 0) : 0;
  const total = subtotal - pickupDiscount - couponDiscount;
  // What's charged online now vs. collected on delivery (COD advance split).
  const { payNow, payOnDelivery } = splitPayment(total, payOnline ? paymentMethod : 'ONLINE');
  const deliveryBy = useMemo(() => formatDeliveryDate(expectedDeliveryDate()), []);
  // Struck MRP convention matches the product page ("50% off" → MRP is 2× the
  // selling price). Savings = everything off the MRP, including any coupon.
  const originalTotal = subtotal * 2;
  const savings = Math.max(0, originalTotal - total);

  // Drop a stale coupon if the cart changes (quantities/items) — the customer
  // re-applies against the new total, which the server re-validates anyway.
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setCouponError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || !cart || cart.items.length === 0) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const preview = await api.validateCoupon({
        code,
        items: cart.items.map((item) => ({
          productId: item.product.id,
          variantId: item.variant.id,
          quantity: item.quantity,
        })),
      });
      setRemovedCoupon(null);
      setAppliedCoupon({
        code: preview.code,
        discount: preview.discount,
        // Missing flag (older API) → treat as prepaid-only: never show a discount
        // on COD that checkout would then reject.
        prepaidOnly: preview.prepaidOnly ?? true,
      });
      setCouponInput(preview.code);
      // Celebrate the saving: confetti blast from the bottom + a toast.
      void celebrateFromBottom();
      notify(`${preview.code} applied — you saved ${formatCurrency(preview.discount)}!`);
    } catch (error) {
      setAppliedCoupon(null);
      setCouponError(error instanceof Error ? error.message : 'That coupon could not be applied.');
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setRemovedCoupon(null);
    setCouponInput('');
    setCouponError('');
  }

  /**
   * Switch payment method. COD automatically removes a prepaid-only coupon
   * (e.g. PREPAID10) — the COD option then says it was removed.
   */
  function selectPaymentMethod(method: PaymentMethod) {
    setPaymentMethod(method);
    if (method === 'COD' && appliedCoupon?.prepaidOnly) {
      setRemovedCoupon(appliedCoupon);
      setAppliedCoupon(null);
      setCouponInput('');
      setCouponError('');
    }
  }

  /** Bring back a coupon removed for COD, switching to online payment. */
  function reapplyRemovedCoupon() {
    if (!removedCoupon) return;
    setPaymentMethod('ONLINE');
    setAppliedCoupon(removedCoupon);
    void celebrateFromBottom();
    setCouponInput(removedCoupon.code);
    setRemovedCoupon(null);
  }

  function updateField(field: keyof AddressForm, value: string) {
    let next = value;
    // Phone fields: digits only (no +, spaces, or symbols), capped at 10.
    if (field === 'mobileNo' || field === 'altMobileNo') {
      next = value.replace(/\D/g, '').slice(0, 10);
    }
    // Address line 1 is capped at 100 characters.
    if (field === 'line1') next = value.slice(0, 100);
    setAddress((prev) => ({ ...prev, [field]: next }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function validateAddress(a: AddressForm): Partial<Record<keyof AddressForm, string>> {
    const e: Partial<Record<keyof AddressForm, string>> = {};
    if (!a.name.trim()) e.name = 'Please enter your full name.';
    // Names are letters and spaces only — reject digits, symbols, apostrophes, hyphens.
    else if (!/^[\p{L} ]+$/u.test(a.name.trim()))
      e.name = 'Name can only contain letters and spaces.';
    // Email is now optional — only validate format if provided
    if (a.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim()))
      e.email = 'Enter a valid email address.';
    // Phone: exactly 10 digits, no spaces, +, or any other symbol.
    if (!a.mobileNo) e.mobileNo = 'Please enter your mobile number.';
    else if (!/^\d{10}$/.test(a.mobileNo))
      e.mobileNo = 'Mobile number must be 10 digits — no spaces, +, or symbols.';
    // Alternative mobile is optional — only validate format if provided
    if (a.altMobileNo && !/^\d{10}$/.test(a.altMobileNo))
      e.altMobileNo = 'Alternative mobile must be 10 digits — no spaces, +, or symbols.';
    // ...and it must differ from the primary number.
    else if (a.altMobileNo && a.altMobileNo === a.mobileNo)
      e.altMobileNo = 'Alternative mobile must be different from the mobile number.';
    if (!a.line1.trim()) e.line1 = 'Please enter your address.';
    else if (a.line1.trim().length > 100)
      e.line1 = 'Address line 1 must be 100 characters or fewer.';
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
    const isPhone = field === 'mobileNo' || field === 'altMobileNo';
    const isNumeric = isPhone || field === 'pincode';
    const maxLength = isPhone ? 10 : field === 'pincode' ? 6 : field === 'line1' ? 100 : undefined;
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
          inputMode={isNumeric ? 'numeric' : undefined}
          maxLength={maxLength}
          value={address[field]}
          onChange={(e) => updateField(field, e.target.value)}
          aria-invalid={err ? true : undefined}
        />
      </div>
    );
  }

  // Customer site: on reaching the checkout step, load the saved addresses once.
  // With any saved, show them as cards and pre-select the most recent one.
  useEffect(() => {
    if (step !== 2 || !payOnline || savedAddressLoadedRef.current) return;
    savedAddressLoadedRef.current = true;
    api
      .listSavedAddresses()
      .then((list) => {
        setSavedAddresses(list);
        const first = list[0];
        if (!first) return;
        const { id, ...fields } = first;
        setAddressMode('list');
        setSelectedAddressId(id);
        setAddress({ ...emptyAddress, ...fields });
      })
      .catch(() => undefined);
  }, [step, payOnline]);

  // Close an open ⋮ menu on any outside click.
  useEffect(() => {
    if (!addressMenuId) return;
    const close = () => setAddressMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [addressMenuId]);

  function savedToForm(saved: SavedAddress): AddressForm {
    const { id: _id, ...fields } = saved;
    return { ...emptyAddress, ...fields };
  }

  function selectSavedAddress(saved: SavedAddress) {
    setSelectedAddressId(saved.id);
    setAddress(savedToForm(saved));
    setErrors({});
  }

  function startNewAddress() {
    setAddressMenuId(null);
    setAddressMode('form');
    setEditingAddressId(null);
    setAddress(emptyAddress);
    setErrors({});
    setSaveAddressForFuture(true);
  }

  function startEditAddress(saved: SavedAddress) {
    setAddressMenuId(null);
    setAddressMode('form');
    setEditingAddressId(saved.id);
    setAddress(savedToForm(saved));
    setErrors({});
  }

  function backToSavedAddresses() {
    setAddressMode('list');
    setEditingAddressId(null);
    const current = savedAddresses.find((a) => a.id === selectedAddressId) ?? savedAddresses[0];
    if (current) selectSavedAddress(current);
  }

  async function saveEditedAddress() {
    if (!editingAddressId) return;
    const fieldErrors = validateAddress(address);
    const firstError = Object.values(fieldErrors)[0];
    if (firstError) {
      setErrors(fieldErrors);
      setErrKey((k) => k + 1);
      notify(firstError);
      return;
    }
    setSavingAddress(true);
    try {
      const updated = await api.updateSavedAddress(editingAddressId, address);
      setSavedAddresses((list) => [updated, ...list.filter((a) => a.id !== updated.id)]);
      setEditingAddressId(null);
      setAddressMode('list');
      selectSavedAddress(updated);
      notify('Address updated.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the address.');
    } finally {
      setSavingAddress(false);
    }
  }

  async function deleteSavedAddressCard(saved: SavedAddress) {
    setAddressMenuId(null);
    if (!window.confirm('Delete this saved address?')) return;
    try {
      await api.deleteSavedAddress(saved.id);
      const next = savedAddresses.filter((a) => a.id !== saved.id);
      setSavedAddresses(next);
      const fallback = next[0];
      if (!fallback) startNewAddress();
      else if (selectedAddressId === saved.id) selectSavedAddress(fallback);
    } catch {
      notify('Could not delete the address. Please try again.');
    }
  }

  // Changing how/what the customer pays must open a fresh payment session.
  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [paymentMethod, couponActive, appliedCoupon?.code]);

  function goToShipping() {
    if (!cart || cart.items.length === 0) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Address step → payment step: validate the address and save it if asked. */
  function goToPayment() {
    if (!cart || cart.items.length === 0) return;
    if (editingAddressId) {
      notify('Save your address changes first.');
      return;
    }
    const fieldErrors = validateAddress(address);
    const firstError = Object.values(fieldErrors)[0];
    if (firstError) {
      setErrors(fieldErrors);
      setErrKey((k) => k + 1);
      notify(firstError);
      return;
    }
    setErrors({});
    // Remember a newly typed address if they asked to. Never blocks checkout —
    // a failed save just means it won't be offered next time.
    if (addressMode === 'form' && saveAddressForFuture) {
      void api
        .createSavedAddress(address)
        .then((saved) => {
          setSavedAddresses((list) => [saved, ...list.filter((a) => a.id !== saved.id)]);
          setSelectedAddressId(saved.id);
          setAddressMode('list');
        })
        .catch(() => undefined);
    }
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function placeOrder() {
    if (!cart || cart.items.length === 0) return;
    // Terms are only collected on the one-tap pickup/reseller flow (step 1); the
    // customer checkout step has no checkbox.
    if ((isPickup || skipAddress) && !agreedToTerms) {
      notify(
        'Please agree to the Terms & Conditions, Privacy Policy and Refund Policy to continue.',
      );
      return;
    }
    if (editingAddressId) {
      notify('Save your address changes first.');
      return;
    }
    // Pickup orders collect in store — no shipping address required, so skip validation.
    const fieldErrors = isPickup || skipAddress ? {} : validateAddress(address);
    const firstError = Object.values(fieldErrors)[0];
    if (firstError) {
      setErrors(fieldErrors);
      setErrKey((k) => k + 1); // re-trigger the shake animation on every attempt
      notify(firstError);
      return;
    }
    setErrors({});
    setPlacing(true);
    // Reuse one idempotency key across retries of THIS checkout so a
    // double-submit (or a lost response/dismissed payment, for the web flow)
    // can't create a second order or open a second Razorpay session. Web:
    // cleared only once payment is actually confirmed. Reseller: cleared
    // right after the order is created, same as always.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    try {
      if (!payOnline) {
        // Reseller/credit: fully unchanged — order is created immediately,
        // admin confirms payment manually, same as today.
        const result = await api.createOrder(
          {
            items: cart.items.map((item) => ({
              productId: item.product.id,
              variantId: item.variant.id,
              quantity: item.quantity,
            })),
            isPickup,
            skipAddress: skipAddress || undefined,
            address: isPickup || skipAddress ? undefined : address,
          },
          idempotencyKeyRef.current,
        );
        idempotencyKeyRef.current = null; // order placed — retire this key
        router.replace(`/order-confirmed?order=${encodeURIComponent(result.orderNumber)}`);
        return;
      }

      // Web: NO order is created yet — only a Razorpay checkout session for
      // the cart as it stands right now. Nothing is written to the database
      // until payment is confirmed; an abandoned/failed payment here leaves
      // no order, no stock touched, and the cart exactly as it was.
      const session = await api.startRazorpayCheckout(
        {
          items: cart.items.map((item) => ({
            productId: item.product.id,
            variantId: item.variant.id,
            quantity: item.quantity,
          })),
          isPickup,
          address: isPickup ? undefined : address,
          couponCode:
            couponsEnabled && couponActive ? (appliedCoupon?.code ?? undefined) : undefined,
          paymentMethod: payOnline ? paymentMethod : undefined,
        },
        idempotencyKeyRef.current,
      );

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        notify('Could not load the payment gateway. Please try again.');
        return; // nothing was created — cart and bag are untouched
      }

      const checkout = new window.Razorpay({
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        name: 'Prime Kicks',
        description: 'Prime Kicks order',
        order_id: session.razorpayOrderId,
        callback_url: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/payments/razorpay/callback`,
        prefill: isPickup
          ? undefined
          : { name: address.name, email: address.email || undefined, contact: address.mobileNo },
        theme: { color: '#111111' },
        handler: (response) => {
          void (async () => {
            try {
              const result = await api.verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (result.outcome === 'confirmed' || result.outcome === 'already_confirmed') {
                idempotencyKeyRef.current = null; // order placed — retire this key
                router.replace(`/order-confirmed?order=${encodeURIComponent(result.orderNumber)}`);
              } else if (result.outcome === 'refunded') {
                // An item sold out between checkout and payment — the
                // customer was never left paying for something undeliverable.
                notify(
                  'Sorry — something in your bag sold out while you were paying. You have NOT been charged (a full refund was issued automatically).',
                );
                router.replace('/');
              } else {
                notify(
                  'Payment received, but confirming it failed — contact us if you were charged.',
                );
                router.replace('/orders');
              }
            } catch {
              notify(
                'Payment received, but confirming it failed — contact us if you were charged.',
              );
              router.replace('/orders');
            }
          })();
        },
        modal: {
          ondismiss: () => {
            // Nothing was ever created — the bag is exactly as it was.
            notify('Payment not completed.');
          },
        },
      });
      checkout.open();
    } catch (error) {
      if (error instanceof ApiError) notify(error.message);
      else notify('Something went wrong. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  // The current step's main action — shared by the phone bottom bar and the
  // tablet/desktop summary card so both always do and say the same thing.
  const primaryAction = onPaymentStep ? placeOrder : onCheckoutStep ? goToPayment : goToShipping;
  const primaryLabel = onPaymentStep
    ? `Pay ${formatCurrency(payNow)}`
    : onCheckoutStep
      ? 'Continue to payment'
      : 'Proceed to checkout';

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
          {!skipAddress && (
            <>
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
            </>
          )}

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
        <section
          className={`max-w-[1280px] mx-auto pt-[68px] px-[5.25vw] pb-[100px] max-[760px]:pt-[43px] max-[760px]:px-[15px] ${
            payOnline ? 'max-[760px]:pb-[28px]' : 'max-[760px]:pb-[58px]'
          }`}
        >
          <div className="flex items-end justify-between border-b border-line pb-[30px] mb-[30px] max-[760px]:block max-[760px]:pb-[24px] max-[760px]:mb-[22px]">
            <div className={!payOnline || cart?.items.length === 0 ? 'max-[760px]:mb-[25px]' : ''}>
              {payOnline && (
                <Link
                  href="/search"
                  className="mb-[18px] inline-flex items-center gap-[6px] text-[10px] font-bold uppercase tracking-[.12em] text-[#777] no-underline transition-colors hover:text-ink [&_svg]:h-[13px] [&_svg]:w-[13px] max-[760px]:mb-[14px]"
                >
                  <Icon name="chevron-left" /> Continue shopping
                </Link>
              )}
              <h1 className="text-[clamp(46px,6vw,76px)] leading-[.8] tracking-[-.09em] m-0 max-[760px]:text-[53px]">
                Your <em className="font-[Georgia,serif] font-normal">bag.</em>
              </h1>
              {payOnline && cart && cart.items.length > 0 && (
                <p className="m-0 mt-[14px] text-[11px] font-bold uppercase tracking-[.14em] text-[#777]">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </p>
              )}
            </div>
            {cart?.items.length === 0 && (
              <Link
                className="inline-flex items-center gap-[15px] bg-ink text-white rounded-[8px] px-[15px] py-[13px] no-underline uppercase tracking-[.08em] text-[10px] font-bold [&_svg]:w-[14px]"
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
                className="inline-flex items-center gap-[15px] bg-ink text-white rounded-[8px] px-[15px] py-[13px] no-underline uppercase tracking-[.08em] text-[10px] font-bold [&_svg]:w-[14px]"
                href="/"
              >
                Explore new arrivals <Icon name="arrow" />
              </Link>
            </div>
          ) : (
            <div
              className={
                onCheckoutStep
                  ? // Checkout steps: one column on phones/tablets; from 1024px the
                    // form sits left and the summary + action card sits right.
                    'grid grid-cols-1 gap-y-[20px] items-start max-[1023px]:max-w-[760px] min-[1024px]:grid-cols-[minmax(0,1fr)_360px] min-[1024px]:gap-x-[48px]'
                  : 'grid grid-cols-[minmax(0,1fr)_380px] gap-x-[60px] gap-y-[20px] items-start max-[760px]:grid-cols-1 max-[760px]:gap-y-[24px]'
              }
            >
              <div
                className={`grid gap-[14px] content-start ${
                  onCheckoutStep
                    ? 'order-2 min-[1024px]:order-none min-[1024px]:col-start-1 min-[1024px]:row-start-1 min-[1024px]:row-span-2'
                    : 'col-start-1 row-start-1 row-span-2 max-[760px]:col-auto max-[760px]:row-auto max-[760px]:row-span-1 max-[760px]:order-1'
                }`}
              >
                {step === 1 ? (
                  cart.items.map((item) =>
                    !payOnline ? (
                      /* Reseller app: original item card, unchanged. */
                      <article
                        className="relative grid grid-cols-[150px_1fr_auto] gap-[20px] p-[14px] border border-line rounded-[14px] bg-white shadow-[0_7px_18px_rgba(28,22,16,0.05)] animate-[enter_0.35s_both] max-[760px]:grid-cols-[100px_1fr_auto] max-[760px]:gap-[13px] max-[760px]:p-[10px]"
                        key={item.id}
                      >
                        <Link
                          className="aspect-[1/1.05] overflow-hidden rounded-[10px] bg-[#e9e7e1]"
                          href={`/products/${item.product.id}`}
                        >
                          {item.product.photoUrls[0] ? (
                            <BlurImage
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
                    ) : (
                      <article
                        className="relative overflow-hidden border border-line rounded-[14px] bg-white shadow-[0_7px_18px_rgba(28,22,16,0.05)] animate-[enter_0.35s_both]"
                        key={item.id}
                      >
                        <button
                          className="absolute right-[8px] top-[8px] z-[1] grid h-[34px] w-[34px] place-items-center rounded-[8px] border-0 bg-transparent text-[#777] transition-colors hover:bg-[#f3f1ec] hover:text-ink disabled:opacity-40 [&_svg]:w-[17px]"
                          disabled={pending === item.id}
                          onClick={() => remove(item.id)}
                          aria-label={`Remove ${item.product.name}`}
                        >
                          <Icon name="trash" />
                        </button>

                        {/* Top: image + details */}
                        <div className="grid grid-cols-[112px_1fr] items-center gap-[18px] p-[16px] max-[760px]:grid-cols-[88px_1fr] max-[760px]:gap-[14px] max-[760px]:p-[14px]">
                          <Link
                            className="aspect-square overflow-hidden rounded-[10px] bg-[#e9e7e1]"
                            href={`/products/${item.product.id}`}
                          >
                            {item.product.photoUrls[0] ? (
                              <BlurImage
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
                          <div className="grid min-w-0 content-center gap-[6px] pr-[30px]">
                            <p className="m-0 text-[9px] uppercase tracking-[.1em] font-bold text-[#777]">
                              {item.product.brand}
                            </p>
                            <Link
                              href={`/products/${item.product.id}`}
                              className="text-ink no-underline"
                            >
                              <h2 className="m-0 text-[18px] leading-[1.1] tracking-[-.045em] max-[760px]:text-[16px]">
                                {item.product.name}
                              </h2>
                            </Link>
                            <span className="text-[11px] text-[#777]">
                              Size {item.variant.size.label}
                            </span>
                            <span className="mt-[2px] flex flex-wrap items-baseline gap-x-[8px] gap-y-[2px]">
                              {/* Line total (price × quantity), like the order summary. */}
                              <strong className="text-[16px] tracking-[-.02em]">
                                {formatCurrency(
                                  item.product.price * item.quantity,
                                  item.product.currency,
                                )}
                              </strong>
                              <s className="text-[12px] text-[#9a9a9a]">
                                {formatCurrency(
                                  item.product.price * 2 * item.quantity,
                                  item.product.currency,
                                )}
                              </s>
                              <span className="text-[10px] font-bold uppercase tracking-[.05em] text-accent">
                                50% off
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Bottom: quantity stepper on the right */}
                        <div className="flex items-center justify-end border-t border-line px-[16px] py-[11px] max-[760px]:px-[14px]">
                          <div className="inline-flex items-stretch overflow-hidden rounded-[8px] border border-line bg-white [&_svg]:w-[14px]">
                            <button
                              className="grid h-[36px] w-[38px] place-items-center border-0 bg-white transition-colors hover:bg-[#f3f1ec] disabled:opacity-35"
                              disabled={pending === item.id || item.quantity === 1}
                              onClick={() => update(item.id, item.quantity - 1)}
                              aria-label="Decrease quantity"
                            >
                              <Icon name="minus" />
                            </button>
                            <span className="grid w-[44px] place-items-center border-x border-line text-[13px] font-bold">
                              {item.quantity}
                            </span>
                            <button
                              className="grid h-[36px] w-[38px] place-items-center border-0 bg-white transition-colors hover:bg-[#f3f1ec] disabled:opacity-35"
                              disabled={pending === item.id}
                              onClick={() => update(item.id, item.quantity + 1)}
                              aria-label="Increase quantity"
                            >
                              <Icon name="plus" />
                            </button>
                          </div>
                        </div>
                      </article>
                    ),
                  )
                ) : step === 3 ? (
                  /* Step 3: delivery + payment method (customer site only) */
                  <aside className="grid gap-[22px] border border-line rounded-[14px] p-[26px] bg-white shadow-[0_7px_18px_rgba(28,22,16,0.05)] animate-[enter_0.35s_both] max-[760px]:p-[18px]">
                    <section>
                      <p className="m-0 mb-[12px] text-[10px] tracking-[.16em] uppercase font-bold">
                        Delivery method
                      </p>
                      <div className="flex gap-[12px] rounded-[12px] border border-ink bg-[#faf8f4] p-[16px]">
                        <span
                          aria-hidden="true"
                          className="mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 border-ink"
                        >
                          <span className="h-[8px] w-[8px] rounded-full bg-ink" />
                        </span>
                        <div className="grid gap-[3px] text-[12.5px] leading-[1.5] text-[#555]">
                          <p className="m-0 text-[14px] font-bold text-ink">
                            Standard delivery <span className="text-[#4b7d4b]">· FREE</span>
                          </p>
                          <p className="m-0">Delivered in {DELIVERY_WINDOW}</p>
                          <p className="m-0">
                            Expected by <b className="text-ink">{deliveryBy}</b>
                          </p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <p className="m-0 mb-[12px] text-[10px] tracking-[.16em] uppercase font-bold">
                        Payment method
                      </p>
                      <div
                        className="grid gap-[12px]"
                        role="radiogroup"
                        aria-label="Payment method"
                      >
                        {(['ONLINE', 'COD'] as const).map((method) => {
                          const selected = paymentMethod === method;
                          const codSplit = splitPayment(subtotal - pickupDiscount, 'COD');
                          return (
                            <div
                              key={method}
                              role="radio"
                              aria-checked={selected}
                              tabIndex={0}
                              onClick={() => selectPaymentMethod(method)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  selectPaymentMethod(method);
                                }
                              }}
                              className={`flex cursor-pointer gap-[12px] rounded-[12px] border p-[16px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink/20 ${
                                selected
                                  ? 'border-ink bg-[#faf8f4]'
                                  : 'border-line bg-white hover:border-[#bbb]'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
                                  selected ? 'border-ink' : 'border-[#ccc]'
                                }`}
                              >
                                {selected && (
                                  <span className="h-[8px] w-[8px] rounded-full bg-ink" />
                                )}
                              </span>
                              {method === 'ONLINE' ? (
                                <div className="grid min-w-0 gap-[8px]">
                                  <p className="m-0 flex flex-wrap items-center gap-[8px] text-[14px] font-bold">
                                    Pay online
                                    <span className="rounded-full bg-[#4b7d4b] px-[8px] py-[3px] text-[9px] uppercase tracking-[.08em] text-white">
                                      Recommended
                                    </span>
                                  </p>
                                  <p className="m-0 text-[12px] text-[#555]">
                                    UPI, credit/debit cards &amp; net banking via Razorpay. Pay the
                                    full amount now.
                                  </p>
                                  <PaymentBadges />
                                  {appliedCoupon && (
                                    <p className="m-0 text-[11.5px] font-bold text-[#4b7d4b]">
                                      Coupon {appliedCoupon.code} applied (−
                                      {formatCurrency(appliedCoupon.discount)})
                                    </p>
                                  )}
                                  {!appliedCoupon && removedCoupon && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        reapplyRemovedCoupon();
                                      }}
                                      className="w-fit border-0 bg-transparent p-0 text-left text-[11.5px] font-bold text-[#4b7d4b] underline underline-offset-2"
                                    >
                                      Re-apply {removedCoupon.code} (save{' '}
                                      {formatCurrency(removedCoupon.discount)})
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="grid min-w-0 gap-[6px]">
                                  <p className="m-0 text-[14px] font-bold">Cash on delivery</p>
                                  <p className="m-0 text-[12px] text-[#555]">
                                    Pay {COD_ADVANCE_PERCENT}% advance online now (
                                    <b className="text-ink">{formatCurrency(codSplit.payNow)}</b>),
                                    the rest (
                                    <b className="text-ink">
                                      {formatCurrency(codSplit.payOnDelivery)}
                                    </b>
                                    ) in cash on delivery.
                                  </p>
                                  {removedCoupon && (
                                    <p className="m-0 flex items-start gap-[6px] rounded-[8px] bg-[#fbeeee] px-[10px] py-[8px] text-[11.5px] font-medium leading-[1.4] text-[#b3261e]">
                                      <span aria-hidden="true">✕</span>
                                      <span>
                                        Coupon <b>{removedCoupon.code}</b> removed — it&apos;s valid
                                        on online payment only.
                                      </span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {/* What's charged now vs. on delivery (phones; the side card shows it on larger screens) */}
                    <section className="grid gap-[10px] border-t border-line pt-[18px] text-[13px] text-[#555] min-[761px]:hidden">
                      <div className="flex justify-between gap-[20px]">
                        <span>Order total</span>
                        <span className="text-ink">{formatCurrency(total)}</span>
                      </div>
                      {couponDiscount > 0 && appliedCoupon && (
                        <div className="flex justify-between gap-[20px] text-[#4b7d4b]">
                          <span>Includes coupon ({appliedCoupon.code})</span>
                          <span>−{formatCurrency(couponDiscount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-[20px] font-bold text-ink">
                        <span>{paymentMethod === 'COD' ? 'Pay now (advance)' : 'Pay now'}</span>
                        <span>{formatCurrency(payNow)}</span>
                      </div>
                      {paymentMethod === 'COD' && (
                        <div className="flex justify-between gap-[20px]">
                          <span>Pay on delivery (cash)</span>
                          <span className="text-ink">{formatCurrency(payOnDelivery)}</span>
                        </div>
                      )}
                    </section>
                  </aside>
                ) : (
                  /* Step 2: shipping address replaces the product list */
                  <aside className="border border-line rounded-[14px] p-[26px] bg-white shadow-[0_7px_18px_rgba(28,22,16,0.05)] animate-[enter_0.35s_both] max-[760px]:p-[18px]">
                    {payOnline && addressMode === 'list' && savedAddresses.length > 0 ? (
                      <>
                        <div className="mb-[18px] flex items-center justify-between gap-[12px]">
                          <p className="m-0 text-[10px] tracking-[.16em] uppercase font-bold">
                            Saved addresses
                          </p>
                          <button
                            type="button"
                            onClick={startNewAddress}
                            className="inline-flex items-center gap-[6px] rounded-[8px] border border-line bg-white px-[12px] py-[9px] text-[10px] font-bold uppercase tracking-[.08em] transition-colors hover:border-ink [&_svg]:w-[12px]"
                          >
                            <Icon name="plus" /> Add new address
                          </button>
                        </div>
                        <div
                          className="grid gap-[12px]"
                          role="radiogroup"
                          aria-label="Saved addresses"
                        >
                          {savedAddresses.map((saved) => {
                            const selected = saved.id === selectedAddressId;
                            return (
                              <div
                                key={saved.id}
                                role="radio"
                                aria-checked={selected}
                                tabIndex={0}
                                onClick={() => selectSavedAddress(saved)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    selectSavedAddress(saved);
                                  }
                                }}
                                className={`relative cursor-pointer rounded-[12px] border p-[16px] pr-[48px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink/20 ${
                                  selected
                                    ? 'border-ink bg-[#faf8f4]'
                                    : 'border-line bg-white hover:border-[#bbb]'
                                }`}
                              >
                                <div className="flex gap-[12px]">
                                  <span
                                    aria-hidden="true"
                                    className={`mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${
                                      selected ? 'border-ink' : 'border-[#ccc]'
                                    }`}
                                  >
                                    {selected && (
                                      <span className="h-[8px] w-[8px] rounded-full bg-ink" />
                                    )}
                                  </span>
                                  <div className="grid min-w-0 gap-[2px] text-[12.5px] leading-[1.5] text-[#555]">
                                    <p className="m-0 text-[14px] font-bold text-ink">
                                      {saved.name}
                                    </p>
                                    <p className="m-0">{saved.line1}</p>
                                    {saved.line2 && <p className="m-0">{saved.line2}</p>}
                                    {saved.landmark && <p className="m-0">{saved.landmark}</p>}
                                    <p className="m-0">
                                      {saved.city}, {saved.state} - {saved.pincode}
                                    </p>
                                    <p className="m-0 mt-[4px]">Phone: {saved.mobileNo}</p>
                                    {saved.email && (
                                      <p className="m-0 break-all">Email: {saved.email}</p>
                                    )}
                                  </div>
                                </div>

                                {/* ⋮ menu: edit / delete */}
                                <div className="absolute right-[8px] top-[8px]">
                                  <button
                                    type="button"
                                    aria-label={`Options for ${saved.name}'s address`}
                                    aria-haspopup="menu"
                                    aria-expanded={addressMenuId === saved.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddressMenuId((id) => (id === saved.id ? null : saved.id));
                                    }}
                                    className="grid h-[32px] w-[32px] place-items-center rounded-[8px] text-[#777] transition-colors hover:bg-[#f3f1ec] hover:text-ink"
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      className="h-[16px] w-[16px]"
                                      aria-hidden="true"
                                    >
                                      <circle cx="12" cy="5" r="1.7" />
                                      <circle cx="12" cy="12" r="1.7" />
                                      <circle cx="12" cy="19" r="1.7" />
                                    </svg>
                                  </button>
                                  {addressMenuId === saved.id && (
                                    <div
                                      role="menu"
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 top-[36px] z-10 w-[132px] overflow-hidden rounded-[10px] border border-line bg-white shadow-[0_12px_24px_rgba(28,22,16,0.14)]"
                                    >
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => startEditAddress(saved)}
                                        className="block w-full px-[14px] py-[10px] text-left text-[12px] hover:bg-[#f5f2eb]"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => void deleteSavedAddressCard(saved)}
                                        className="block w-full px-[14px] py-[10px] text-left text-[12px] text-[#b3261e] hover:bg-[#fbeeee]"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-[20px] flex items-center justify-between gap-[12px]">
                          <p className="m-0 text-[10px] tracking-[.16em] uppercase font-bold">
                            {editingAddressId ? 'Edit address' : 'Shipping address'}
                          </p>
                          {payOnline && savedAddresses.length > 0 && (
                            <button
                              type="button"
                              onClick={backToSavedAddresses}
                              className="text-[10px] font-bold uppercase tracking-[.08em] text-[#777] transition-colors hover:text-ink"
                            >
                              ‹ Saved addresses
                            </button>
                          )}
                        </div>

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
                          {renderField('line2', 'Landmark')}
                          <div className="grid grid-cols-3 gap-[12px] items-start max-[480px]:grid-cols-1">
                            {renderField('pincode', 'Pincode *')}
                            {renderField('city', 'City *')}
                            {renderField('state', 'State *')}
                          </div>
                        </div>

                        {payOnline && editingAddressId ? (
                          <div className="mt-[18px] flex gap-[8px] border-t border-line pt-[16px]">
                            <button
                              type="button"
                              onClick={() => void saveEditedAddress()}
                              disabled={savingAddress}
                              className="h-[42px] rounded-[8px] border-0 bg-ink px-[18px] text-[10px] font-bold uppercase tracking-[.08em] text-white transition-opacity disabled:opacity-50"
                            >
                              {savingAddress ? 'Saving…' : 'Save address'}
                            </button>
                            <button
                              type="button"
                              onClick={backToSavedAddresses}
                              className="h-[42px] rounded-[8px] border border-line bg-white px-[18px] text-[10px] font-bold uppercase tracking-[.08em]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          payOnline && (
                            <label className="mt-[18px] flex cursor-pointer select-none items-center gap-[10px] border-t border-line pt-[16px]">
                              <input
                                type="checkbox"
                                checked={saveAddressForFuture}
                                onChange={(e) => setSaveAddressForFuture(e.target.checked)}
                                className="h-[16px] w-[16px] accent-[#111]"
                              />
                              <span className="text-[12px] font-bold leading-snug">
                                Save this address for future orders
                              </span>
                            </label>
                          )
                        )}
                      </>
                    )}
                  </aside>
                )}
              </div>

              <div
                className={`grid gap-[20px] content-start ${
                  onCheckoutStep
                    ? 'order-1 min-[1024px]:order-none min-[1024px]:col-start-2 min-[1024px]:row-start-1'
                    : 'col-start-2 row-start-1 max-[760px]:col-auto max-[760px]:row-auto max-[760px]:order-2'
                }`}
              >
                {/* Step indicator */}
                {!skipAddress && (
                  <div className="flex items-center gap-[10px] text-[10px] uppercase tracking-[.12em] font-bold">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className={step === 1 ? 'text-ink' : 'text-[#b3ab9c]'}
                    >
                      1 · Bag
                    </button>
                    <span className="flex-1 h-px bg-[#ddd6c9]" />
                    <button
                      type="button"
                      onClick={() => step === 3 && setStep(2)}
                      className={step === 2 ? 'text-ink' : 'text-[#b3ab9c]'}
                    >
                      2 · Address
                    </button>
                    <span className="flex-1 h-px bg-[#ddd6c9]" />
                    <span className={step === 3 ? 'text-ink' : 'text-[#b3ab9c]'}>3 · Payment</span>
                  </div>
                )}

                {/* Order summary (bag step only — checkout is just the address form) */}
                {!onCheckoutStep && (
                  <aside className="border border-ink rounded-[14px] p-[23px] bg-[#f5f2eb] shadow-[0_12px_25px_rgba(28,22,16,0.08)]">
                    <p className="m-0 mb-[22px] text-[10px] tracking-[.16em] uppercase font-bold">
                      Order summary
                    </p>

                    {/* Coupon — web customers only (prepaid). */}
                    {couponsEnabled && (
                      <div className="mb-[18px] border-b border-b-[#d6d1c7] pb-[18px]">
                        <p className="m-0 mb-[11px] text-[10px] tracking-[.16em] uppercase font-bold">
                          Have a coupon?
                        </p>
                        {appliedCoupon ? (
                          <div className="flex items-center justify-between gap-[12px] rounded-[8px] border border-[#111] bg-white px-[13px] py-[11px]">
                            <span className="flex items-center gap-[9px] text-[12px] font-bold uppercase tracking-[.08em]">
                              <span
                                aria-hidden="true"
                                className="grid h-[18px] w-[18px] place-items-center rounded-full bg-ink text-white [&_svg]:h-[11px] [&_svg]:w-[11px]"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                >
                                  <path
                                    d="M5 13l4 4L19 7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                              {appliedCoupon.code}
                            </span>
                            <button
                              type="button"
                              onClick={removeCoupon}
                              className="text-[10px] font-bold uppercase tracking-[.1em] text-[#999] transition-colors hover:text-ink"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex gap-[8px]">
                              <input
                                value={couponInput}
                                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void applyCoupon();
                                  }
                                }}
                                placeholder="Enter coupon code"
                                className="h-[44px] min-w-0 flex-1 rounded-[8px] border border-line bg-white px-[13px] text-[13px] uppercase tracking-[.06em] outline-none transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:text-[#aaa] focus:border-ink"
                              />
                              <button
                                type="button"
                                onClick={() => void applyCoupon()}
                                disabled={couponLoading || !couponInput.trim()}
                                className="inline-flex h-[44px] shrink-0 items-center justify-center rounded-[8px] bg-ink px-[20px] text-[10px] font-bold uppercase tracking-[.08em] text-white transition-opacity hover:bg-[#393834] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {couponLoading ? 'Checking…' : 'Apply'}
                              </button>
                            </div>
                            {couponError && (
                              <p className="m-0 mt-[9px] text-[11px] leading-[1.4] text-[#b3261e]">
                                {couponError}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {!payOnline ? (
                      /* Reseller app: original summary, unchanged. */
                      <>
                        {pickupDiscount > 0 && (
                          <div className="flex justify-between gap-[20px] mt-[7px] text-[12px] text-[#4b7d4b]">
                            <span>Shipping deduction (pickup / label)</span>
                            <span>−{formatCurrency(pickupDiscount)}</span>
                          </div>
                        )}
                        <section className="flex justify-between gap-[20px] mt-[7px] border-t border-t-[#d6d1c7] pt-[18px] pb-[11px] text-[14px]">
                          <span>Total</span>
                          <strong className="text-[18px]">{formatCurrency(total)}</strong>
                        </section>
                      </>
                    ) : (
                      <>
                        {/* Price breakdown: Subtotal → Tax → Delivery (then any discounts). */}
                        <div className="grid gap-[12px] text-[13px] text-[#555]">
                          <div className="flex justify-between gap-[20px]">
                            <span>Subtotal</span>
                            <span className="text-ink">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between gap-[20px]">
                            <span>Tax</span>
                            <span className="text-ink">{formatCurrency(0)}</span>
                          </div>
                          {shippingIncluded && (
                            <div className="flex justify-between gap-[20px]">
                              <span>Delivery</span>
                              <span className="font-bold text-[#4b7d4b]">FREE</span>
                            </div>
                          )}
                          {pickupDiscount > 0 && (
                            <div className="flex justify-between gap-[20px] text-[#4b7d4b]">
                              <span>Shipping deduction (pickup / label)</span>
                              <span>−{formatCurrency(pickupDiscount)}</span>
                            </div>
                          )}
                          {couponDiscount > 0 && appliedCoupon && (
                            <div className="flex justify-between gap-[20px] text-[#4b7d4b]">
                              <span>Coupon ({appliedCoupon.code})</span>
                              <span>−{formatCurrency(couponDiscount)}</span>
                            </div>
                          )}
                        </div>

                        {shippingIncluded && savings > 0 && (
                          <div className="mt-[16px] flex items-center justify-center gap-[8px] rounded-[10px] border border-[#cfe0cf] bg-[#f1f7f1] px-[14px] py-[11px] text-[12px] font-bold text-[#3f6b3f]">
                            <span
                              aria-hidden="true"
                              className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#4b7d4b] text-white [&_svg]:h-[11px] [&_svg]:w-[11px]"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                              >
                                <path
                                  d="M5 13l4 4L19 7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                            You&apos;re saving {formatCurrency(savings)} on this order
                          </div>
                        )}

                        <section className="flex items-baseline justify-between gap-[20px] mt-[16px] border-t border-t-[#d6d1c7] pt-[18px] pb-[11px] text-[14px]">
                          <span>Total</span>
                          <strong className="text-[20px]">
                            {formatCurrency(total)}
                            {shippingIncluded && (
                              <span className="ml-[8px] text-[10px] font-normal uppercase tracking-[.08em] text-[#8a8378]">
                                incl. shipping
                              </span>
                            )}
                          </strong>
                        </section>

                        {/* Trust row: secure-checkout line + accepted payment marks. */}
                        <div className="mt-[14px] border-t border-t-[#e4ded3] pt-[16px]">
                          <p className="m-0 mb-[12px] flex items-center justify-center gap-[7px] text-[11px] font-bold uppercase tracking-[.1em] text-[#6a6358] [&_svg]:h-[13px] [&_svg]:w-[13px]">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect x="5" y="11" width="14" height="9" rx="2" />
                              <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                            </svg>
                            Guaranteed secure checkout
                          </p>
                          <PaymentBadges className="justify-center" />
                        </div>
                      </>
                    )}
                  </aside>
                )}
              </div>

              {/* Actions block — bag step only (checkout uses the pinned bar) */}
              <div
                className={`grid gap-[14px] content-start col-start-2 row-start-2 max-[760px]:col-auto max-[760px]:row-auto max-[760px]:order-3 ${
                  onCheckoutStep ? 'hidden' : actionsEmptyOnMobile ? 'max-[760px]:hidden' : ''
                }`}
              >
                {step === 1 ? (
                  /* Step 1: proceed to shipping (or straight to pickup for resellers) */
                  <>
                    {isReseller && !skipAddress && (
                      <label className="flex items-center gap-[10px] border border-line rounded-[10px] p-[14px] bg-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isPickup}
                          onChange={(e) => setIsPickup(e.target.checked)}
                          className="w-[16px] h-[16px] accent-[#111]"
                        />
                        <span className="text-[12px] font-bold leading-snug">
                          Pickup or Label ?
                        </span>
                      </label>
                    )}
                    {isPickup || skipAddress ? (
                      <>
                        <TermsCheckbox checked={agreedToTerms} onChange={setAgreedToTerms} />
                        <button
                          className="w-full h-[50px] border-0 rounded-[10px] bg-ink text-white uppercase tracking-[.08em] text-[11px] font-bold flex items-center justify-center gap-[12px] select-none transition-opacity duration-150 disabled:opacity-50 [&_svg]:w-[14px]"
                          disabled={placing || !agreedToTerms}
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
                      </>
                    ) : (
                      <button
                        className="w-full h-[50px] border-0 rounded-[10px] bg-ink text-white uppercase tracking-[.08em] text-[11px] font-bold flex items-center justify-center gap-[12px] [&_svg]:w-[14px] max-[760px]:hidden"
                        onClick={goToShipping}
                      >
                        Continue to shipping <Icon name="arrow" />
                      </button>
                    )}
                  </>
                ) : null}
              </div>

              {/* Tablet/desktop checkout card: summary + the step's action, in the
                  page flow (phones use the bar pinned to the bottom instead). */}
              {onCheckoutStep && (
                <aside className="order-3 grid gap-[12px] rounded-[14px] border border-ink bg-[#f5f2eb] p-[22px] text-[13px] text-[#555] shadow-[0_12px_25px_rgba(28,22,16,0.08)] max-[760px]:hidden min-[1024px]:order-none min-[1024px]:col-start-2 min-[1024px]:row-start-2 min-[1024px]:sticky min-[1024px]:top-[96px]">
                  <p className="m-0 mb-[4px] text-[10px] font-bold uppercase tracking-[.16em] text-ink">
                    Order summary
                  </p>
                  <div className="flex justify-between gap-[16px]">
                    <span>
                      Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                    </span>
                    <span className="text-ink">{formatCurrency(subtotal)}</span>
                  </div>
                  {couponDiscount > 0 && appliedCoupon && (
                    <div className="flex justify-between gap-[16px] text-[#4b7d4b]">
                      <span>Coupon ({appliedCoupon.code})</span>
                      <span>−{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-[16px]">
                    <span>Delivery</span>
                    <span className="font-bold text-[#4b7d4b]">FREE</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-[16px] border-t border-t-[#d6d1c7] pt-[12px] text-[14px] text-ink">
                    <span>Total</span>
                    <strong className="text-[20px]">{formatCurrency(total)}</strong>
                  </div>
                  {onPaymentStep && paymentMethod === 'COD' && (
                    <>
                      <div className="flex justify-between gap-[16px] font-bold text-ink">
                        <span>Pay now (advance)</span>
                        <span>{formatCurrency(payNow)}</span>
                      </div>
                      <div className="flex justify-between gap-[16px]">
                        <span>Pay on delivery (cash)</span>
                        <span className="text-ink">{formatCurrency(payOnDelivery)}</span>
                      </div>
                    </>
                  )}
                  {savings > 0 && !(onPaymentStep && paymentMethod === 'COD') && (
                    <p className="m-0 text-[11.5px] font-bold text-[#4b7d4b]">
                      You save {formatCurrency(savings)} on this order
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={primaryAction}
                    disabled={onPaymentStep && placing}
                    className="mt-[6px] flex h-[50px] w-full items-center justify-center gap-[10px] rounded-[10px] border-0 bg-ink text-[11px] font-bold uppercase tracking-[.08em] text-white transition-opacity disabled:opacity-60 [&_svg]:h-[14px] [&_svg]:w-[14px]"
                  >
                    {onPaymentStep && placing ? (
                      <>
                        <i className="h-[15px] w-[15px] rounded-full border-2 border-white/30 border-t-white animate-[spin_0.8s_linear_infinite]" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <rect x="5" y="11" width="14" height="9" rx="2" />
                          <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                        </svg>
                        {primaryLabel}
                      </>
                    )}
                  </button>
                  <p className="m-0 flex items-center justify-center gap-[6px] text-[10px] font-bold uppercase tracking-[.1em] text-[#6a6358]">
                    Guaranteed secure checkout
                  </p>
                </aside>
              )}
            </div>
          )}
        </section>
      }

      {/* Total + primary action pinned to the bottom of the screen: on the bag
          step (mobile only) it proceeds to checkout; on the checkout step (all
          screen sizes) it opens payment. */}
      {showStickyBar && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pt-[12px] pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(28,22,16,0.1)] ${'hidden max-[760px]:block'}`}
        >
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-[14px] px-[5.25vw] max-[760px]:px-[15px]">
            <div className="leading-tight">
              <p className="m-0 text-[9px] font-bold uppercase tracking-[.14em] text-[#999]">
                Total
              </p>
              <strong className="text-[19px] tracking-[-.02em]">{formatCurrency(total)}</strong>
              {onPaymentStep && paymentMethod === 'COD' ? (
                <p className="m-0 mt-[1px] text-[10px] font-bold text-[#555]">
                  {formatCurrency(payNow)} now · {formatCurrency(payOnDelivery)} on delivery
                </p>
              ) : (
                savings > 0 &&
                shippingIncluded && (
                  <p className="m-0 mt-[1px] text-[10px] font-bold text-[#4b7d4b]">
                    You save {formatCurrency(savings)}
                  </p>
                )
              )}
            </div>
            <button
              type="button"
              onClick={primaryAction}
              disabled={onPaymentStep && placing}
              className="flex h-[48px] max-w-[320px] flex-1 items-center justify-center gap-[9px] whitespace-nowrap rounded-[10px] border-0 bg-ink text-[11px] font-bold uppercase tracking-[.08em] text-white transition-opacity disabled:opacity-60 max-[760px]:max-w-[230px] [&_svg]:h-[14px] [&_svg]:w-[14px] [&_svg]:shrink-0"
            >
              {onPaymentStep && placing ? (
                <>
                  <i className="h-[15px] w-[15px] rounded-full border-2 border-white/30 border-t-white animate-[spin_0.8s_linear_infinite]" />
                  Processing…
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                  </svg>
                  {onPaymentStep
                    ? // COD's split is spelled out next to the total, so the button
                      // stays one line on phones: always "Pay <amount due now>".
                      `Pay ${formatCurrency(payNow)}`
                    : onCheckoutStep
                      ? 'Continue to payment'
                      : 'Proceed to checkout'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <Toast message={toast} visible={!!toast} />

      <SiteFooter />
      {/* Clearance so the pinned checkout bar never covers the footer's last
          line — painted in the footer's colour so it reads as part of it. */}
      {showStickyBar && (
        <div aria-hidden="true" className="hidden h-[88px] bg-[#111] max-[760px]:block" />
      )}
    </main>
  );
}
