/** Copper rounded-square check badge — paths from brochure page 26/27. */
export function CheckBadge({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16.5 16.5" className={`shrink-0 ${className}`} aria-hidden="true" focusable="false">
      <rect width="16.5" height="16.5" rx="3.75" fill="var(--color-copper)" />
      <path
        d="M4.2 8.47a1.13 1.13 0 0 1 1.6 0l1.34 1.33 4.54-4.54a1.13 1.13 0 1 1 1.6 1.6l-5.34 5.34a1.13 1.13 0 0 1-1.6 0L4.2 10.07a1.13 1.13 0 0 1 0-1.6Z"
        fill="#fff"
      />
    </svg>
  );
}
