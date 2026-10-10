export function BrandMark({ className = "h-8 w-8", inverse = false }: { className?: string; inverse?: boolean }) {
  const cutout = inverse ? "#172554" : "white";
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <circle cx="15.5" cy="16" r="11.4" stroke="currentColor" strokeWidth="4" />
      <path d="M18.5 4.6h12v6.1l-4-.45 3.25 3.35-2.5 1.9-4.2-5.3-1.65 5.2h-2.8Z" fill="currentColor" />
      <path d="m30.6 10.15-4 .05 3.1 3.1Z" fill={cutout} />
      <circle cx="26.4" cy="7.35" r=".85" fill={cutout} />
    </svg>
  );
}

export function Logo({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${inverse ? "text-white" : "text-brand-700"}`}>
      <BrandMark inverse={inverse} className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <span className={`${compact ? "text-base" : "text-xl"} font-bold tracking-[-0.045em]`}>poscere</span>
    </span>
  );
}
