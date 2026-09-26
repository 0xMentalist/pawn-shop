import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookReceipts } from "@/db/schema";
import { ingestMultiBaasDeliveries } from "@/lib/curvegrid-events";
import { INDEXED_EVENT_NAMES } from "@/lib/event-names";

export const runtime = "nodejs";

function response(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const secret = process.env.CURVEGRID_WEBHOOK_SECRET;
  if (!secret) return response("Curvegrid webhook is not configured.", 503);
  const timestamp = request.headers.get("x-multibaas-timestamp");
  const signature = request.headers.get("x-multibaas-signature");
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^[0-9a-fA-F]{64}$/.test(signature)) return response("Invalid webhook signature.", 401);
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 5 * 60) return response("Webhook timestamp is outside the allowed window.", 401);
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0 || body.length > 1_000_000) return response("Invalid webhook size.", 413);
  const expected = createHmac("sha256", secret).update(body).update(timestamp).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return response("Invalid webhook signature.", 401);

  let deliveries: Array<{ id?: string; event?: string; data?: { event?: { name?: string } } }>;
  try { deliveries = JSON.parse(body.toString("utf8")); } catch { return response("Invalid webhook JSON.", 400); }
  if (!Array.isArray(deliveries) || deliveries.length > 100) return response("Invalid webhook batch.", 400);
  const relevant = deliveries.filter((item) => item.event === "event.emitted" && INDEXED_EVENT_NAMES.has(item.data?.event?.name ?? "") && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 128);
  const pending = new Set<string>();
  for (const delivery of relevant) {
    const id = delivery.id!;
    const [existing] = await db.select().from(webhookReceipts).where(eq(webhookReceipts.deliveryId, id));
    if (existing?.status === "processed") continue;
    if (!existing) await db.insert(webhookReceipts).values({ deliveryId: id, receivedAt: new Date(), status: "received" }).onConflictDoNothing();
    pending.add(id);
  }
  if (pending.size === 0) return NextResponse.json({ accepted: 0 });
  try {
    const indexed = await ingestMultiBaasDeliveries(relevant);
    for (const id of pending) await db.update(webhookReceipts).set({ status: "processed", processedAt: new Date() }).where(eq(webhookReceipts.deliveryId, id));
    return NextResponse.json({ accepted: pending.size, indexed });
  } catch {
    for (const id of pending) await db.update(webhookReceipts).set({ status: "failed" }).where(eq(webhookReceipts.deliveryId, id));
    return response("Event sync failed; retry this webhook.", 502);
  }
}
