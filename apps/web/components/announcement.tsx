'use client';

import { Icon } from '@/components/icon';
import { useAuthCart } from '@/lib/hooks';

export function Announcement() {
  const { user } = useAuthCart();

  // The free-shipping promo is a customer offer — resellers have their own terms,
  // so the banner is hidden for RESELLER accounts.
  if (user?.role === 'RESELLER') return null;

  return (
    <div className="h-[34px] bg-[#111] text-white flex items-center justify-center gap-[18px] text-[10px] tracking-[.07em] uppercase max-[800px]:h-[30px] max-[800px]:text-[8px] max-[800px]:gap-[10px]">
      Free express shipping on orders over ₹10,000{' '}
      <span className="text-accent flex items-center gap-[6px] [&_svg]:w-[13px] [&_svg]:h-[13px] max-[800px]:hidden">
        Shop the latest <Icon name="arrow" />
      </span>
    </div>
  );
}
