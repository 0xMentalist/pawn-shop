import "server-only";

import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/collector-credit.db";

if (url.startsWith("file:")) {
  mkdirSync(dirname(resolve(url.slice(5))), { recursive: true });
}

export const db = drizzle(createClient({ url }), { schema });
