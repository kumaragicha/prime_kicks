'use client';

import { api, type ParsedAddress } from '@/lib/api';
import { useAddOrderAddress } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { Button } from '@prime-kicks/ui';
import { useState } from 'react';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

const emptyAddress: ParsedAddress = {
  name: '',
  email: '',
  altMobileNo: '',
  mobileNo: '',
  line1: '',
  line2: '',
  landmark: '',
  pincode: '',
  city: '',
  state: '',
};

/**
 * Shown on an order that has no delivery address (reseller one-click checkout).
 * Paste an address block, parse it, review the parsed fields below, then save.
 */
export function OrderAddressForm({ orderId }: { orderId: string }) {
  const toast = useToast();
  const addAddress = useAddOrderAddress();
  const [block, setBlock] = useState('');
  const [parsing, setParsing] = useState(false);
  const [address, setAddress] = useState<ParsedAddress>(emptyAddress);
  const [parsed, setParsed] = useState(false);

  const set = (field: keyof ParsedAddress, value: string) =>
    setAddress((prev) => ({ ...prev, [field]: value }));

  async function onParse() {
    if (!block.trim()) return toast.error('Paste an address block first.');
    setParsing(true);
    try {
      const { parsed: p } = await api.parseAddress(block);
      setAddress({ ...emptyAddress, ...p });
      setParsed(true);
      toast.success('Address parsed — review the details below.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not parse the address.');
    } finally {
      setParsing(false);
    }
  }

  function onSave() {
    addAddress.mutate(
      { id: orderId, address },
      {
        onSuccess: () => toast.success('Address saved — pushing the order to Shipmozo.'),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save the address.'),
      },
    );
  }

  const input = (field: keyof ParsedAddress, label: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      <input
        className={fieldClass}
        value={address[field]}
        onChange={(e) => set(field, e.target.value)}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        No delivery address on this order. Paste the full address block to add one.
      </p>

      <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3">
        <textarea
          className={`${fieldClass} min-h-[110px] resize-y bg-white`}
          placeholder={
            'Example:\nJohn Doe\n9876543210\n123 Main Street, Apartment 4B\nNear City Mall\nMumbai, Maharashtra 400001'
          }
          value={block}
          onChange={(e) => setBlock(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={onParse} disabled={parsing || !block.trim()}>
            {parsing ? 'Parsing…' : 'Parse address'}
          </Button>
        </div>
      </div>

      {parsed && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Parsed address
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {input('name', 'Full name')}
            {input('email', 'Email (optional)')}
            {input('mobileNo', 'Mobile number')}
            {input('altMobileNo', 'Alternative mobile (optional)')}
          </div>
          {input('line1', 'Address line 1')}
          {input('line2', 'Address line 2 / landmark')}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {input('pincode', 'Pincode')}
            {input('city', 'City')}
            {input('state', 'State')}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={onSave} disabled={addAddress.isPending}>
              {addAddress.isPending ? 'Saving…' : 'Save address'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
