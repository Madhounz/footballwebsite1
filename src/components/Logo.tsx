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

/**
 * The name, in the language the reader is reading.
 *
 * A wordmark that stays in Latin on an Arabic page is a sign that the Arabic
 * site is a translation of the English one rather than a site of its own. The
 * mark does not change — it is the same stopwatch either way — and neither
 * does the prime, which means minutes in both languages. Only the word does:
 * ninety becomes تسعون, set a little larger because Arabic letterforms carry
 * less height than Latin ones at the same size, and without the tight Latin
 * tracking, which only makes Arabic harder to read.
 */
export function Wordmark({ locale, className = "" }: { locale?: string; className?: string }) {
  const arabic = locale === "ar";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} dir={arabic ? "rtl" : "ltr"}>
      <Mark size={26} />
      <span
        className={
          arabic
            ? "text-[23px] font-semibold leading-none"
            : "text-[22px] font-semibold leading-none tracking-[-0.03em]"
        }
      >
        {arabic ? "تسعون" : "ninety"}
        <span className="text-accent">′</span>
      </span>
    </span>
  );
}
