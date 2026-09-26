import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/collector-credit.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
const base = {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
};

export default url.startsWith("file:")
  ? defineConfig({ ...base, dialect: "sqlite", dbCredentials: { url } })
  : defineConfig({ ...base, dialect: "turso", dbCredentials: { url, authToken } });
