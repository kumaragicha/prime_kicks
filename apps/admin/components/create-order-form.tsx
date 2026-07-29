'use client';

import { useCreateOrder, useProduct, useProducts, useResellers } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { formatSize, ORDER_TYPE, PAYMENT_STATUS } from '@prime-kicks/types';
import { Button } from '@prime-kicks/ui';
import { formatCurrency } from '@prime-kicks/utils';
import { useState } from 'react';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

const radioGroupClass = 'flex gap-4';

export function CreateOrderForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  // --- Form state ---
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [resellerId, setResellerId] = useState('');
  const [orderType, setOrderType] = useState<'BULK' | 'SINGLE'>(ORDER_TYPE.SINGLE);
  const [paymentStatus, setPaymentStatus] = useState<'RECEIVED' | 'PENDING'>(
    PAYMENT_STATUS.PENDING,
  );
  const [shippingStatus, setShippingStatus] = useState<'PENDING' | 'RECEIVED'>(
    PAYMENT_STATUS.PENDING,
  );
  const [shipping, setShipping] = useState(0);

  const [address, setAddress] = useState({
    name: '',
    email: '',
    mobileNo: '',
    line1: '',
    line2: '',
    landmark: '',
    pincode: '',
    city: '',
    state: '',
  });

  const { success, error: toastError } = useToast();

  // --- Data ---
  const { data: productResults, isLoading: loadingProducts } = useProducts(
    productSearch ? { search: productSearch, pageSize: 20 } : undefined,
  );
  const { data: selectedProduct, isLoading: loadingProduct } = useProduct(selectedProductId);
  const { data: resellers, isLoading: loadingResellers } = useResellers();
  const createOrder = useCreateOrder();

  const inStockVariants = selectedProduct?.variants.filter((v) => v.stock > 0) ?? [];

  const selectedVariant = inStockVariants.find((v) => v.id === selectedVariantId);
  const unitPrice = selectedVariant ? selectedProduct!.resellerPrice : 0;
  const subtotal = unitPrice * quantity;
  const total = subtotal + shipping;

  // --- Handlers ---
  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    setSelectedVariantId('');
    setProductSearch('');
  };

  const handleAddressChange = (field: string, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedProductId || !selectedVariantId || !resellerId) {
      toastError('Please select a product, size, and reseller.');
      return;
    }

    try {
      await createOrder.mutateAsync({
        resellerId,
        items: [
          {
            productId: selectedProductId,
            variantId: selectedVariantId,
            quantity,
          },
        ],
        orderType,
        paymentStatus,
        shippingStatus,
        shipping,
        address,
      });
      success('Order created successfully!');
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to create order. Please try again.');
    }
  };

  const resetForm = () => {
    setProductSearch('');
    setSelectedProductId('');
    setSelectedVariantId('');
    setQuantity(1);
    setResellerId('');
    setOrderType(ORDER_TYPE.SINGLE);
    setPaymentStatus(PAYMENT_STATUS.PENDING);
    setShippingStatus(PAYMENT_STATUS.PENDING);
    setShipping(0);
    setAddress({
      name: '',
      email: '',
      mobileNo: '',
      line1: '',
      line2: '',
      landmark: '',
      pincode: '',
      city: '',
      state: '',
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-xl font-semibold text-neutral-900">Create Order</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Product Search */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Product</label>
            <input
              className={fieldClass}
              placeholder="Search products by name or SKU…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            {productSearch && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-neutral-200">
                {loadingProducts ? (
                  <p className="p-2 text-sm text-neutral-500">Searching…</p>
                ) : productResults?.data.length === 0 ? (
                  <p className="p-2 text-sm text-neutral-500">No products found.</p>
                ) : (
                  productResults?.data.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
                      onClick={() => handleProductSelect(p.id)}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-neutral-500"> — SKU: {p.sku}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedProduct && (
              <p className="mt-1 text-sm text-neutral-600">
                Selected: {selectedProduct.name} (SKU: {selectedProduct.sku})
              </p>
            )}
          </div>

          {/* Size Selection */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Size</label>
            <select
              className={fieldClass}
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              disabled={!selectedProductId || loadingProduct}
            >
              <option value="">
                {!selectedProductId
                  ? 'Select a product first'
                  : loadingProduct
                    ? 'Loading…'
                    : inStockVariants.length === 0
                      ? 'No sizes in stock'
                      : 'Select a size'}
              </option>
              {inStockVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatSize(v.size)} — {v.stock} in stock
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Quantity</label>
            <input
              type="number"
              min={1}
              className={fieldClass}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={!selectedVariantId}
            />
            {selectedVariant && (
              <p className="mt-1 text-xs text-neutral-500">Available: {selectedVariant.stock}</p>
            )}
          </div>

          {/* Reseller */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Reseller</label>
            <select
              className={fieldClass}
              value={resellerId}
              onChange={(e) => setResellerId(e.target.value)}
              disabled={loadingResellers}
            >
              <option value="">{loadingResellers ? 'Loading…' : 'Select a reseller'}</option>
              {resellers?.data.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.email})
                </option>
              ))}
            </select>
          </div>

          {/* Order Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Order Type</label>
            <div className={radioGroupClass}>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="orderType"
                  checked={orderType === ORDER_TYPE.SINGLE}
                  onChange={() => setOrderType(ORDER_TYPE.SINGLE)}
                />
                Single
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="orderType"
                  checked={orderType === ORDER_TYPE.BULK}
                  onChange={() => setOrderType(ORDER_TYPE.BULK)}
                />
                Bulk
              </label>
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Payment Status
            </label>
            <div className={radioGroupClass}>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentStatus"
                  checked={paymentStatus === PAYMENT_STATUS.RECEIVED}
                  onChange={() => setPaymentStatus(PAYMENT_STATUS.RECEIVED)}
                />
                Received
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentStatus"
                  checked={paymentStatus === PAYMENT_STATUS.PENDING}
                  onChange={() => setPaymentStatus(PAYMENT_STATUS.PENDING)}
                />
                Pending
              </label>
            </div>
          </div>

          {/* Shipping Status */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Shipping Status
            </label>
            <div className={radioGroupClass}>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shippingStatus"
                  checked={shippingStatus === PAYMENT_STATUS.PENDING}
                  onChange={() => setShippingStatus(PAYMENT_STATUS.PENDING)}
                />
                Pending
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shippingStatus"
                  checked={shippingStatus === PAYMENT_STATUS.RECEIVED}
                  onChange={() => setShippingStatus(PAYMENT_STATUS.RECEIVED)}
                />
                Received
              </label>
            </div>
          </div>

          {/* Shipping Charge */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Shipping Charge (₹)
            </label>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={shipping}
              onChange={(e) => setShipping(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>

          {/* Price Summary */}
          {selectedVariant && (
            <div className="rounded-md bg-neutral-50 p-3">
              <div className="text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span>Unit Price (reseller)</span>
                  <span>{formatCurrency(unitPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatCurrency(shipping)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 font-medium">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Address Fields */}
          <div className="md:col-span-2">
            <h3 className="mb-2 text-sm font-medium text-neutral-700">Shipping Address</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className={fieldClass}
                placeholder="Full name"
                value={address.name}
                onChange={(e) => handleAddressChange('name', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Email"
                type="email"
                value={address.email}
                onChange={(e) => handleAddressChange('email', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Mobile number"
                value={address.mobileNo}
                onChange={(e) => handleAddressChange('mobileNo', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Address line 1"
                value={address.line1}
                onChange={(e) => handleAddressChange('line1', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Address line 2 (optional)"
                value={address.line2}
                onChange={(e) => handleAddressChange('line2', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Landmark (optional)"
                value={address.landmark}
                onChange={(e) => handleAddressChange('landmark', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Pincode"
                value={address.pincode}
                onChange={(e) => handleAddressChange('pincode', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="City"
                value={address.city}
                onChange={(e) => handleAddressChange('city', e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="State"
                value={address.state}
                onChange={(e) => handleAddressChange('state', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={createOrder.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={
              createOrder.isPending || !selectedProductId || !selectedVariantId || !resellerId
            }
          >
            {createOrder.isPending ? 'Creating…' : 'Create Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
