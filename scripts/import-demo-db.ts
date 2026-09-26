import { createClient, type InStatement } from "@libsql/client/node";

const targetUrl = process.env.TURSO_DATABASE_URL ?? process.env.TARGET_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.TARGET_DATABASE_AUTH_TOKEN;
if (!targetUrl || (!targetUrl.startsWith("file:") && !authToken)) {
  throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before importing the local demo database.");
}

const source = createClient({ url: process.env.SOURCE_DATABASE_URL ?? "file:./data/collector-credit.db" });
const target = createClient({ url: targetUrl, authToken });
const tables = [
  ["cards", "id"],
  ["valuation_fixtures", "card_id"],
  ["identity_authorizations", "id"],
  ["chain_events", "id"],
  ["webhook_receipts", "delivery_id"],
  ["indexer_cursors", "id"],
] as const;

try {
  for (const [table, primaryKey] of tables) {
    const rows = await source.execute(`SELECT * FROM "${table}"`);
    const columns = rows.columns;
    if (columns.length === 0) continue;
    const columnSql = columns.map((column) => `"${column}"`).join(", ");
    const updates = columns.filter((column) => column !== primaryKey)
      .map((column) => `"${column}" = excluded."${column}"`).join(", ");
    const sql = `INSERT INTO "${table}" (${columnSql}) VALUES (${columns.map(() => "?").join(", ")}) ON CONFLICT("${primaryKey}") DO UPDATE SET ${updates}`;
    for (let start = 0; start < rows.rows.length; start += 100) {
      const statements: InStatement[] = rows.rows.slice(start, start + 100).map((row) => ({
        sql,
        args: columns.map((column) => row[column] ?? null),
      }));
      await target.batch(statements, "write");
    }
    console.log(`${table}: ${rows.rows.length} rows imported`);
  }
} finally {
  await Promise.all([source.close(), target.close()]);
}
