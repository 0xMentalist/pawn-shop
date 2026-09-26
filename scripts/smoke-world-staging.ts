import { IDKit, proofOfHuman } from "@worldcoin/idkit-core";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { WORLD_BORROWER_ACTION, worldAuthorizationMessage } from "../src/lib/world";

type McpMessage = { result?: { content?: Array<{ text?: string }> }; error?: { message?: string } };

async function simulatorComplete(connectUrl: string) {
  const response = await fetch("https://simulator.worldcoin.org/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "complete_test_request", arguments: { connect_url: connectUrl } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Simulator HTTP ${response.status}`);
  const text = await response.text();
  const data = text.split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)) as McpMessage).at(-1);
  if (!data || data.error) throw new Error("Simulator MCP request failed.");
  const result = JSON.parse(data.result?.content?.find((item) => item.text)?.text ?? "{}") as { status?: string; stage?: string; outcome?: string; error?: string };
  if (result.status !== "proof_delivered") throw new Error("Simulator did not deliver a proof.");
}

async function main() {
  if (process.env.WORLD_ENVIRONMENT !== "staging") throw new Error("This smoke test requires WORLD_ENVIRONMENT=staging.");
  const appId = process.env.WORLD_APP_ID as `app_${string}` | undefined;
  const rpId = process.env.WORLD_RP_ID;
  if (!appId || !rpId) throw new Error("World app and RP IDs are missing.");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const wallet = privateKeyToAccount(generatePrivateKey());

  // Node's fetch cannot load the SDK's file:// WASM URL. Let the SDK read its
  // bundled module from disk while leaving HTTP bridge requests untouched.
  const networkFetch = globalThis.fetch;
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (input instanceof URL && input.protocol === "file:") {
      return readFile(fileURLToPath(input)).then((bytes) => new Response(bytes, { headers: { "Content-Type": "application/wasm" } }));
    }
    return networkFetch(input, init);
  }) as typeof fetch;

  const signatureResponse = await fetch(new URL("/api/world/rp-signature", base), { method: "POST" });
  if (!signatureResponse.ok) throw new Error(`RP signature endpoint returned ${signatureResponse.status}.`);
  const rp = await signatureResponse.json() as { sig: string; nonce: string; created_at: number; expires_at: number };
  const request = await IDKit.request({
    app_id: appId,
    action: WORLD_BORROWER_ACTION,
    environment: "staging",
    allow_legacy_proofs: false,
    rp_context: { rp_id: rpId, nonce: rp.nonce, created_at: rp.created_at, expires_at: rp.expires_at, signature: rp.sig },
  }).preset(proofOfHuman({ signal: wallet.address }));

  // The connector URI contains the bridge encryption key. Never print or persist it.
  await simulatorComplete(request.connectorURI);
  const completion = await request.pollUntilCompletion({ pollInterval: 1_000, timeout: 120_000 });
  if (!completion.success) throw new Error(`IDKit completion failed: ${completion.error}`);
  const walletSignature = await wallet.signMessage({ message: worldAuthorizationMessage(wallet.address, completion.result.nonce) });
  const verifyResponse = await fetch(new URL("/api/world/verify", base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: wallet.address, walletSignature, idkitResponse: completion.result }),
  });
  const result = await verifyResponse.json() as { verified?: boolean; txHash?: string; error?: string };
  if (!verifyResponse.ok || !result.verified) throw new Error(`Application verification returned ${verifyResponse.status}: ${result.error ?? "no verified result"}`);
  console.log(JSON.stringify({ verified: true, wallet: wallet.address, txHash: result.txHash, protocol: completion.result.protocol_version }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "World staging smoke test failed.");
  process.exitCode = 1;
});
