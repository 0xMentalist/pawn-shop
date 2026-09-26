import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("brand-mark inline-flex size-9 shrink-0 items-center justify-center rounded-sm", className)}>
    <svg viewBox="0 0 48 48" className="size-[68%]" fill="currentColor" aria-hidden="true">
      <circle cx="24" cy="12" r="6.5" />
      <circle cx="14" cy="31" r="6.5" />
      <circle cx="34" cy="31" r="6.5" />
    </svg>
  </span>;
}
