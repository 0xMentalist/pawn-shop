import { Shrimp } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("brand-mark inline-flex size-9 shrink-0 items-center justify-center rounded-sm", className)}><Shrimp className="size-[58%]" strokeWidth={1.9} /></span>;
}
