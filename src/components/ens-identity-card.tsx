"use client";

import { useState } from "react";
import { ArrowUpRight, Fingerprint } from "lucide-react";
import { parseAbi, toHex, zeroAddress, type Hex } from "viem";
import { normalize, packetToBytes } from "viem/ens";
import { useAccount, useEnsAddress, useEnsText, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ENS_OWNER_ADDRESS,
  ENS_REGISTRATION_TX,
  ENS_REGISTRY_ADDRESS,
  ENS_RESOLVER_ADDRESS,
  ENS_ROOT_NAME,
  ENS_SEPOLIA_CHAIN_ID,
  ENS_SUBREGISTRY_ADDRESS,
  ENS_TEXT_ROLE_KEY,
  ENS_TEXT_ROLE_VALUE,
} from "@/lib/ens";

const registryAbi = parseAbi(["function findOwner(string label) view returns (address)"]);
const resolverAbi = parseAbi([
  "function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)",
  "function setText(bytes name,string key,string value)",
]);
const setTextRole = 1n << 4n;
const dnsName = toHex(packetToBytes(normalize(ENS_ROOT_NAME)));

export function EnsIdentityCard() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: ENS_SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const owner = useReadContract({ address: ENS_REGISTRY_ADDRESS, abi: registryAbi, functionName: "findOwner", args: [ENS_ROOT_NAME.split(".")[0]], chainId: ENS_SEPOLIA_CHAIN_ID });
  const resolved = useEnsAddress({ name: ENS_ROOT_NAME, chainId: ENS_SEPOLIA_CHAIN_ID });
  const role = useReadContract({ address: ENS_RESOLVER_ADDRESS, abi: resolverAbi, functionName: "hasRootRoles", args: [setTextRole, address ?? zeroAddress], chainId: ENS_SEPOLIA_CHAIN_ID, query: { enabled: isConnected } });
  const record = useEnsText({ name: ENS_ROOT_NAME, key: ENS_TEXT_ROLE_KEY, chainId: ENS_SEPOLIA_CHAIN_ID });
  const registered = owner.data?.toLowerCase() === ENS_OWNER_ADDRESS.toLowerCase();
  const resolves = resolved.data?.toLowerCase() === ENS_OWNER_ADDRESS.toLowerCase();
  const canWrite = isConnected && chainId === ENS_SEPOLIA_CHAIN_ID && role.data === true;

  async function demonstratePermission() {
    if (!address || chainId !== ENS_SEPOLIA_CHAIN_ID || !publicClient) return;
    setBusy(true);
    setMessage("");
    try {
      if (!canWrite) {
        try {
          await publicClient.simulateContract({ account: address, address: ENS_RESOLVER_ADDRESS, abi: resolverAbi, functionName: "setText", args: [dnsName, ENS_TEXT_ROLE_KEY, ENS_TEXT_ROLE_VALUE] });
          setMessage("The write simulation succeeded. Refresh the role status before submitting a transaction.");
        } catch {
          setMessage("ENSv2 denied the record update: this wallet lacks the resolver's text-record role. No transaction was sent.");
        }
        return;
      }
      const tx = await writeContractAsync({ address: ENS_RESOLVER_ADDRESS, abi: resolverAbi, functionName: "setText", args: [dnsName, ENS_TEXT_ROLE_KEY, ENS_TEXT_ROLE_VALUE], chainId: ENS_SEPOLIA_CHAIN_ID });
      setHash(tx);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== "success") throw new Error("ENS record transaction reverted.");
      await record.refetch();
      setMessage("Borrower role record published through your ENSv2 permission.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message.split("\n")[0] : "ENS record update failed.");
    } finally { setBusy(false); }
  }

  return <Card>
    <CardHeader>
      <div className="flex items-center gap-2"><Fingerprint className="size-5" aria-hidden="true" /><CardTitle>Borrower name</CardTitle></div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <p className="text-lg font-semibold">{ENS_ROOT_NAME}</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">{ENS_OWNER_ADDRESS}</p>
        <p className="mt-3 text-sm text-muted-foreground">{registered && resolves ? "Ownership and address verified" : "Checking onchain records…"}</p>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div><p className="text-muted-foreground">Subname registry</p><p className="font-medium">Borrower controlled</p><p className="break-all text-xs text-muted-foreground">{ENS_SUBREGISTRY_ADDRESS}</p></div>
        <div><p className="text-muted-foreground">Role record</p><p className="font-medium">{record.data ? `${ENS_TEXT_ROLE_KEY}: ${record.data}` : "Not published yet"}</p></div>
      </div>
      {isConnected ? <p className="text-sm text-muted-foreground">Connected wallet: {role.data === true ? "record access granted" : role.data === false ? "record access denied" : "checking access"}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={!isConnected || chainId !== ENS_SEPOLIA_CHAIN_ID || busy || role.isPending} onClick={() => void demonstratePermission()}>{busy ? "Checking ENS…" : canWrite ? "Publish borrower role" : "Test record permission"}</Button>
        <a className="inline-flex min-h-10 items-center gap-1 rounded-sm text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`https://sepolia.etherscan.io/tx/${ENS_REGISTRATION_TX}`} target="_blank" rel="noopener noreferrer">Registration transaction <ArrowUpRight className="size-3" aria-hidden="true" /></a>
      </div>
      {message ? <p className="text-xs leading-5" role="status">{message}</p> : null}
      {hash ? <a className="inline-flex min-h-10 items-center rounded-sm text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer">View record transaction</a> : null}
    </CardContent>
  </Card>;
}
