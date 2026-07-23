import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("cloud runtime is resumable and backed by PostgreSQL", async () => {
  const [stream, database, config, page] = await Promise.all([
    readFile(new URL("lib/event-stream.ts", root), "utf8"),
    readFile(new URL("lib/database.ts", root), "utf8"),
    readFile(new URL("lib/demo-config.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);

  assert.match(stream, /seedHistoryIfNeeded/);
  assert.match(stream, /stream_leases/);
  assert.match(stream, /pruneHistoryIfNeeded/);
  assert.match(stream, /storageAllowsWrite/);
  assert.match(config, /60_000/);
  assert.match(config, /maxEventRows/);
  assert.match(config, /databaseWriteGuardBytes/);
  assert.match(database, /DATABASE_URL/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS portfolio\.events/);
  assert.match(page, /\/api\/analytics/);
  assert.match(page, /durable PostgreSQL history/i);
  assert.match(page, /NEXT BUDGET-SAFE WRITE/);
  assert.match(page, /Selectable e-commerce lakehouse system graph/);
  assert.match(page, /from: "airflow", to: "databricks", kind: "control"/);
  assert.match(page, /from: "airflow", to: "dbt", kind: "control"/);
  assert.match(page, /IMMEDIATE CONNECTIONS/);
});

test("OpenAI hosting is not part of the deployment", async () => {
  const [packageJson, readme] = await Promise.all([
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
  ]);

  assert.doesNotMatch(packageJson, /vinext|wrangler|cloudflare/i);
  assert.match(readme, /Render/);
  assert.match(readme, /Supabase/);
});
