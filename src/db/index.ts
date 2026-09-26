import "server-only";

import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/collector-credit.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;

if (process.env.VERCEL && url.startsWith("file:")) {
  throw new Error("A persistent database is required on Vercel. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
}

if (url.startsWith("file:")) {
  mkdirSync(dirname(resolve(url.slice(5))), { recursive: true });
}

export const db = drizzle(createClient({ url, authToken }), { schema });
