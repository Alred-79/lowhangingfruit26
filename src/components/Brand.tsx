export function BrandMark({ className = "h-8 w-8", inverse = false }: { className?: string; inverse?: boolean }) {
  const cutout = inverse ? "#172554" : "white";
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path d="M22.7 6.7A11.8 11.8 0 1 0 27.7 11.2" stroke="currentColor" strokeWidth="3.9" strokeLinecap="round" />
      <path d="M20.5 5.4c2.6-.9 5.4-.5 7.6.9 1.4.9 2.6 2.2 3.5 3.7.5.9-.2 2-1.2 2l-5.4-.3-2.6 4.5c-.6 1-2.1.8-2.4-.3l-.8-3.7-2.7-1.8 2.4-2.8 1.6-2.2Z" fill="currentColor" />
      <circle cx="26.6" cy="7.8" r=".85" fill={cutout} />
      <path d="m27.9 10.5.9-.75.9.8" stroke={cutout} strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round" />
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
