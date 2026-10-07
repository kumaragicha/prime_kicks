'use client';

import { Icon } from '@/components/icon';

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!message) return null;

  return (
    <div
      className={`fixed z-30 top-[89px] right-[24px] bg-accent text-ink rounded-[10px] py-[13px] px-[17px] text-[11px] font-bold flex items-center gap-[8px] shadow-[0_10px_28px_rgba(0,0,0,0.28)] [&_svg]:w-[16px] max-w-[calc(100%-48px)] max-[800px]:top-[78px] max-[800px]:right-[18px] max-[800px]:max-w-[calc(100%-36px)] ${
        visible ? 'animate-[toast-fade-in_0.3s_ease-out]' : 'animate-[toast-fade-out_0.3s_ease-in]'
      }`}
      role="status"
    >
      <Icon name="bag" /> {message}
    </div>
  );
}
