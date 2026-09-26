import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cards, valuationFixtures } from "./schema";
import { DEMO_CARDS } from "../lib/demo-cards";

const url = process.env.DATABASE_URL ?? "file:./data/collector-credit.db";
if (url.startsWith("file:")) mkdirSync(dirname(resolve(url.slice(5))), { recursive: true });
const client = createClient({ url });
const db = drizzle(client);

for (const card of DEMO_CARDS) {
  await db.insert(cards).values({
    id: card.id,
    name: card.name,
    setName: card.setName,
    year: card.year,
    grader: card.grader,
    grade: card.grade,
    certificationNumber: card.certificationNumber,
    custodyStatus: "simulated_received",
    tokenId: null,
    tokenContract: null,
    imageUrl: card.imageUrl,
  }).onConflictDoUpdate({ target: cards.id, set: { imageUrl: card.imageUrl } });

  await db.insert(valuationFixtures).values({
    cardId: card.id,
    lastSaleMicroUsdc: card.valueMicroUsdc,
    median30dMicroUsdc: 0,
    appraisedMicroUsdc: card.valueMicroUsdc,
    confidence: "low",
    updatedAt: new Date(),
  }).onConflictDoUpdate({ target: valuationFixtures.cardId, set: {
    lastSaleMicroUsdc: card.valueMicroUsdc,
    median30dMicroUsdc: 0,
    appraisedMicroUsdc: card.valueMicroUsdc,
    confidence: "low",
    updatedAt: new Date(),
  } });
}

await client.close();
console.log("Seeded the simulated cards and grade-matched last-auction-sale snapshots.");
