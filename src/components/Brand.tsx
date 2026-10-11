// The Rounds mark and wordmark. No server imports: safe in client and server components.

/** The Rounds mark: a patient at the centre of shells of facts (the disclosure orb, flattened). */
export function Mark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-brand-700" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" className="text-white" />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" className="text-white" />
      <circle cx="16" cy="16" r="2.6" className="fill-[oklch(0.82_0.15_168)]" />
      <circle cx="22.5" cy="16" r="1.6" className="fill-white" />
      <circle cx="9.6" cy="10.4" r="1.3" className="fill-white/60" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <Mark />
      <span className="font-display text-[19px] font-semibold tracking-tight text-ink">Rounds</span>
    </span>
  );
}
