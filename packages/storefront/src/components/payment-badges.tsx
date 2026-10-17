/**
 * Small row of accepted-payment marks shown at checkout for trust. Lightweight
 * wordmark/CSS renditions (no external logo assets) that read clearly at a
 * glance and sit quietly within the storefront's editorial theme.
 */

function Card({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-[26px] w-[40px] items-center justify-center rounded-[5px] border border-line bg-white shadow-[0_1px_2px_rgba(28,22,16,0.06)]"
    >
      {children}
    </span>
  );
}

export function PaymentBadges({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-[7px] ${className}`}
      aria-label="Accepted payment methods"
    >
      <Card label="Visa">
        <span className="text-[11px] font-black italic tracking-[-.02em] text-[#1a1f71]">VISA</span>
      </Card>
      <Card label="Mastercard">
        <span className="relative inline-flex items-center">
          <span className="h-[13px] w-[13px] rounded-full bg-[#eb001b]" />
          <span className="-ml-[5px] h-[13px] w-[13px] rounded-full bg-[#f79e1b] opacity-90" />
        </span>
      </Card>
      <Card label="RuPay">
        <span className="text-[10px] font-bold tracking-[-.02em]">
          <span className="text-[#097dc6]">Ru</span>
          <span className="text-[#f47216]">Pay</span>
        </span>
      </Card>
      <Card label="UPI">
        <span className="text-[10px] font-extrabold">
          <span className="text-[#097939]">U</span>
          <span className="text-[#ed752e]">P</span>
          <span className="text-[#097939]">I</span>
        </span>
      </Card>
      <Card label="Maestro">
        <span className="relative inline-flex items-center">
          <span className="h-[13px] w-[13px] rounded-full bg-[#0099df]" />
          <span className="-ml-[5px] h-[13px] w-[13px] rounded-full bg-[#ed0006] opacity-85" />
        </span>
      </Card>
    </div>
  );
}
