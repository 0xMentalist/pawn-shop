"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Building2, FilePenLine, ShieldCheck } from "lucide-react";
import { keccak256, parseAbi, stringToHex, toHex, zeroAddress, type Address, type Hex } from "viem";
import { normalize, packetToBytes } from "viem/ens";
import { useAccount, useEnsAddress, useEnsText, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { contracts } from "@/lib/contracts";
import {
  ENS_SEPOLIA_CHAIN_ID, PROTOCOL_ENS_APPRAISER_ADDRESS, PROTOCOL_ENS_APPRAISER_NOTE_KEY,
  PROTOCOL_ENS_APPRAISER_RESOLVER, PROTOCOL_ENS_NAME, PROTOCOL_ENS_OWNER,
  PROTOCOL_ENS_REGISTRATION_TX, PROTOCOL_ENS_SUBREGISTRY,
} from "@/lib/ens";

const resolverAbi = parseAbi([
  "function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)",
  "function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)",
  "function setText(bytes name,string key,string value)",
]);
const noteRole = 1n << 4n;
const noteResource = BigInt(keccak256(stringToHex(PROTOCOL_ENS_APPRAISER_NOTE_KEY)));
const appraiserName = `appraiser.${PROTOCOL_ENS_NAME}`;
const dnsAppraiserName = toHex(packetToBytes(normalize(appraiserName)));

function IdentityRow({ name, expected, description }: { name: string; expected: Address | undefined; description: string }) {
  const resolved = useEnsAddress({ name, chainId: ENS_SEPOLIA_CHAIN_ID });
  const matches = Boolean(expected && resolved.data?.toLowerCase() === expected.toLowerCase());
  return <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
    <div className="min-w-0">
      <p className="font-medium">{name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{resolved.data ?? "Resolving on Sepolia…"}</p>
    </div>
    <Badge variant={matches ? "secondary" : "warning"}>{matches ? "Resolved" : "Checking"}</Badge>
  </div>;
}

export function ProtocolEnsDirectory() {
  const { address, chainId, isConnected } = useAccount();
  const client = usePublicClient({ chainId: ENS_SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const note = useEnsText({ name: appraiserName, key: PROTOCOL_ENS_APPRAISER_NOTE_KEY, chainId: ENS_SEPOLIA_CHAIN_ID });
  const role = useReadContract({ address: PROTOCOL_ENS_APPRAISER_RESOLVER, abi: resolverAbi, functionName: "hasRoles", args: [noteResource, noteRole, address ?? zeroAddress], chainId: ENS_SEPOLIA_CHAIN_ID, query: { enabled: isConnected } });
  const appraiserRole = useReadContract({ address: PROTOCOL_ENS_APPRAISER_RESOLVER, abi: resolverAbi, functionName: "hasRoles", args: [noteResource, noteRole, PROTOCOL_ENS_APPRAISER_ADDRESS ?? zeroAddress], chainId: ENS_SEPOLIA_CHAIN_ID });
  const appraiserRootRole = useReadContract({ address: PROTOCOL_ENS_APPRAISER_RESOLVER, abi: resolverAbi, functionName: "hasRootRoles", args: [noteRole, PROTOCOL_ENS_APPRAISER_ADDRESS ?? zeroAddress], chainId: ENS_SEPOLIA_CHAIN_ID });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  useEffect(() => { if (note.data) setDraft(note.data); }, [note.data]);
  const canWrite = Boolean(isConnected && chainId === ENS_SEPOLIA_CHAIN_ID && role.data === true);
  const scoped = appraiserRole.data === true && appraiserRootRole.data === false;

  async function updateNote() {
    if (!address || chainId !== ENS_SEPOLIA_CHAIN_ID || !client) return;
    const value = draft.trim();
    if (!value || value.length > 160) { setMessage("Enter a note of 1–160 characters."); return; }
    setBusy(true);
    setMessage("");
    try {
      const args = [dnsAppraiserName, PROTOCOL_ENS_APPRAISER_NOTE_KEY, value] as const;
      if (!canWrite) {
        try {
          await client.simulateContract({ account: address, address: PROTOCOL_ENS_APPRAISER_RESOLVER, abi: resolverAbi, functionName: "setText", args });
          setMessage("The simulation succeeded. Refresh permissions before sending a transaction.");
        } catch {
          setMessage("ENSv2 denied this record edit for the connected wallet. No transaction was sent.");
        }
        return;
      }
      const tx = await writeContractAsync({ address: PROTOCOL_ENS_APPRAISER_RESOLVER, abi: resolverAbi, functionName: "setText", args, chainId: ENS_SEPOLIA_CHAIN_ID });
      setHash(tx);
      const receipt = await client.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== "success") throw new Error("ENS record transaction reverted.");
      await note.refetch();
      setMessage("Appraiser disclosure updated on ENSv2 Sepolia.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message.split("\n")[0] : "ENS record update failed.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Building2 className="size-5" aria-hidden="true" /><CardTitle>Protocol directory</CardTitle></div><Badge variant="outline">ENSv2 · Sepolia</Badge></div>
        <CardDescription>The protocol wallet owns the root. Names point to the onchain appraiser signer, lending pool, and auction contract.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 rounded-md bg-secondary/50 p-4"><p className="text-lg font-semibold">{PROTOCOL_ENS_NAME}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">Owner: {PROTOCOL_ENS_OWNER}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">Subregistry: {PROTOCOL_ENS_SUBREGISTRY}</p></div>
        <IdentityRow name={PROTOCOL_ENS_NAME} expected={PROTOCOL_ENS_OWNER} description="Protocol testnet wallet" />
        <IdentityRow name={appraiserName} expected={PROTOCOL_ENS_APPRAISER_ADDRESS} description="Demo valuation signer" />
        <IdentityRow name={`pool.${PROTOCOL_ENS_NAME}`} expected={contracts.pool} description="Lending pool contract" />
        <IdentityRow name={`auction.${PROTOCOL_ENS_NAME}`} expected={contracts.auction} description="Liquidation auction contract" />
        <a href={`https://sepolia.etherscan.io/tx/${PROTOCOL_ENS_REGISTRATION_TX}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1 text-xs underline underline-offset-4">View root registration <ArrowUpRight className="size-3" aria-hidden="true" /></a>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2"><FilePenLine className="size-5" aria-hidden="true" /><CardTitle>Delegated disclosure</CardTitle></div>
        <CardDescription>The appraiser wallet can edit one text key on its dedicated resolver. It cannot edit that resolver’s address record or unrelated text keys.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2"><Badge variant={scoped ? "secondary" : "warning"}><ShieldCheck className="size-3" aria-hidden="true" />{scoped ? "Key-scoped permission verified" : "Checking delegation"}</Badge><Badge variant="outline">Does not authorize valuations</Badge></div>
        <div className="rounded-md bg-secondary/50 p-4"><p className="text-xs text-muted-foreground">Current ENS record · {PROTOCOL_ENS_APPRAISER_NOTE_KEY}</p><p className="mt-2 text-sm">{note.data || "No disclosure published"}</p></div>
        <div className="space-y-2"><label className="text-xs font-medium" htmlFor="appraiser-note">Update disclosure</label><Input id="appraiser-note" value={draft} maxLength={160} onChange={(event) => setDraft(event.target.value)} placeholder="Short appraiser disclosure" /></div>
        <Button type="button" variant="outline" disabled={!isConnected || chainId !== ENS_SEPOLIA_CHAIN_ID || busy || role.isPending || !draft.trim()} onClick={() => void updateNote()}>{busy ? "Checking ENS…" : canWrite ? "Publish with connected wallet" : "Test denied edit"}</Button>
        <p className="text-xs leading-5 text-muted-foreground">Connect the appraiser wallet to publish. An unrelated wallet can test the denied action without spending gas. The protocol owner retains administrative recovery rights.</p>
        {message ? <p className="text-xs leading-5" role="status">{message}</p> : null}
        {hash ? <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-4">View record transaction</a> : null}
      </CardContent>
    </Card>
  </div>;
}
