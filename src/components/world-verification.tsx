"use client";

import { useState } from "react";
import { IDKitRequestWidget, mnc, passport, proofOfHuman, selfieCheck, type RpContext } from "@worldcoin/idkit";
import { useSignMessage } from "wagmi";
import type { Address, Hex } from "viem";
import { Button } from "@/components/ui/button";
import { WORLD_BORROWER_ACTION, worldAuthorizationMessage } from "@/lib/world";

type WorldConfig = { appId: string; rpId: string; environment: "production" | "staging" };
type VerificationMethod = "orb" | "passport" | "mnc" | "selfie";

const methods: Array<{ id: VerificationMethod; label: string }> = [
  { id: "orb", label: "Orb" },
  { id: "passport", label: "Passport" },
  { id: "mnc", label: "My Number Card" },
  { id: "selfie", label: "Selfie Check" },
];

export function WorldVerification({ config, wallet, onVerified }: { config: WorldConfig | null; wallet: Address; onVerified: () => void }) {
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext>();
  const [walletSignature, setWalletSignature] = useState<Hex>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState<VerificationMethod>("orb");
  const { signMessageAsync } = useSignMessage();

  const preset = method === "orb" ? proofOfHuman({ signal: wallet })
    : method === "passport" ? passport({ signal: wallet })
    : method === "mnc" ? mnc({ signal: wallet })
    : selfieCheck({ signal: wallet });

  function chooseMethod(next: VerificationMethod) {
    setMethod(next);
    setRpContext(undefined);
    setWalletSignature(undefined);
    setMessage("");
  }

  async function begin() {
    if (!config) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/world/rp-signature", { method: "POST" });
      const result = await response.json() as { sig?: string; nonce?: string; created_at?: number; expires_at?: number; error?: string };
      if (!response.ok || !result.sig || !result.nonce || !result.created_at || !result.expires_at) throw new Error(result.error ?? "Could not start World ID verification.");
      const signature = await signMessageAsync({ message: worldAuthorizationMessage(wallet, result.nonce) });
      setWalletSignature(signature);
      setRpContext({ rp_id: config.rpId, nonce: result.nonce, created_at: result.created_at, expires_at: result.expires_at, signature: result.sig });
      setOpen(true);
    } catch (error) { setMessage(error instanceof Error ? error.message.split("\n")[0] : "World ID could not start."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4 border-t border-border pt-6">
    <fieldset disabled={!config || busy || open}>
      <legend className="mb-3 text-sm font-semibold">World ID</legend>
      <div className="divide-y divide-border border-y border-border">
        {methods.map((option) => <label key={option.id} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-1 text-sm focus-within:rounded-sm focus-within:ring-2 focus-within:ring-ring">
          <span className="font-medium">{option.label}</span>
          <input type="radio" name="world-verification-method" value={option.id} checked={method === option.id} onChange={() => chooseMethod(option.id)} className="size-4 accent-primary" />
        </label>)}
      </div>
    </fieldset>
    <Button type="button" variant="outline" className="w-full" disabled={!config || busy} onClick={() => void begin()}>{busy ? "Preparing verification…" : `Verify with ${methods.find((option) => option.id === method)?.label}`}</Button>
    {!config ? <p role="status" className="text-xs text-muted-foreground">Verification is unavailable right now.</p> : null}
    {message ? <p role="status" className="text-xs">{message}</p> : null}
    {config && rpContext && walletSignature ? <IDKitRequestWidget
      open={open}
      onOpenChange={setOpen}
      app_id={config.appId as `app_${string}`}
      action={WORLD_BORROWER_ACTION}
      rp_context={rpContext}
      allow_legacy_proofs={false}
      preset={preset}
      environment={config.environment}
      handleVerify={async (result) => {
        const response = await fetch("/api/world/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet, walletSignature, idkitResponse: result }) });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "World ID verification failed.");
      }}
      onSuccess={() => { setMessage("Identity verified. You can continue with your loan."); onVerified(); }}
      onError={(code) => setMessage(`World ID verification failed: ${code}`)}
    /> : null}
  </div>;
}
