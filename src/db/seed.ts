import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cards, valuationFixtures } from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/collector-credit.db";
if (url.startsWith("file:")) mkdirSync(dirname(resolve(url.slice(5))), { recursive: true });
const client = createClient({ url });
const db = drizzle(client);

await db.insert(cards).values({
  id: "demo-charizard-001",
  name: "Charizard",
  setName: "Base Set",
  year: 1999,
  grader: "PSA",
  grade: "9",
  certificationNumber: "DEMO-CC-001",
  custodyStatus: "simulated_received",
  tokenId: null,
  tokenContract: null,
  imageUrl: null,
}).onConflictDoNothing();

await db.insert(valuationFixtures).values({
  cardId: "demo-charizard-001",
  lastSaleMicroUsdc: 10_400_000_000,
  median30dMicroUsdc: 10_250_000_000,
  appraisedMicroUsdc: 10_000_000_000,
  confidence: "medium",
  updatedAt: new Date(),
}).onConflictDoNothing();

await client.close();
console.log("Seeded the simulated card and valuation fixture.");
