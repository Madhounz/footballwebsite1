export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <line x1="32" y1="6" x2="32" y2="58" />
      <circle cx="32" cy="32" r="18" />
      <circle cx="32" cy="32" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} dir="ltr">
      <Mark size={26} />
      <span className="text-[22px] font-semibold tracking-[-0.03em] leading-none">
        ninety<span className="text-accent">′</span>
      </span>
    </span>
  );
}
