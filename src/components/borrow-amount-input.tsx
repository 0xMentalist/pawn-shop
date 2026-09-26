"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBorrowAmount, formatUsdc } from "@/lib/loan-math";

export function BorrowAmountInput({ id, value, maximumAmount, valid, disabled = false, onChange }: { id: string; value: string; maximumAmount: bigint; valid: boolean; disabled?: boolean; onChange: (value: string) => void }) {
  const errorId = `${id}-error`;
  return <div>
    <label htmlFor={id} className="text-sm font-semibold">How much would you like to borrow?</label>
    <div className="mt-3 flex items-center gap-3"><div className="relative min-w-0 flex-1"><span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-display text-2xl text-muted-foreground" aria-hidden="true">$</span><Input id={id} type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-invalid={value !== "" && !valid} aria-describedby={value !== "" && !valid ? errorId : undefined} className="h-16 pl-9 font-display text-3xl font-semibold tabular-nums" /></div><Button type="button" variant="outline" className="h-12 shrink-0" disabled={disabled || maximumAmount === 0n} onClick={() => onChange(formatBorrowAmount(maximumAmount))}>Max</Button></div>
    {value !== "" && !valid ? <p id={errorId} className="mt-2 text-sm text-destructive">Enter an amount from $0.01 to {formatUsdc(maximumAmount)}.</p> : null}
    <p className="mt-2 text-sm text-muted-foreground">MockUSDC on Sepolia</p>
  </div>;
}
