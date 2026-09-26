import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("brand-mark inline-flex size-10 shrink-0 items-center justify-center rounded-xl", className)}>
    <svg viewBox="0 0 48 48" className="size-[78%]" fill="none" aria-hidden="true">
      <circle cx="24" cy="9" r="5" fill="currentColor" />
      <circle cx="14" cy="17" r="5" fill="currentColor" />
      <circle cx="34" cy="17" r="5" fill="currentColor" />
      <rect x="10" y="16" width="28" height="27" rx="9" fill="currentColor" />
      <circle cx="19" cy="28" r="1.8" fill="var(--brand-mark-bg)" />
      <circle cx="29" cy="28" r="1.8" fill="var(--brand-mark-bg)" />
      <path d="M19.5 34c2.5 2.6 6.5 2.6 9 0" stroke="var(--brand-mark-bg)" strokeLinecap="round" strokeWidth="2.3" />
    </svg>
  </span>;
}
