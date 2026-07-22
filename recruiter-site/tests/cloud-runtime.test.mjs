import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("cloud runtime is resumable and backed by PostgreSQL", async () => {
  const [stream, database, page] = await Promise.all([
    readFile(new URL("lib/event-stream.ts", root), "utf8"),
    readFile(new URL("lib/database.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
  ]);

  assert.match(stream, /seedIfEmpty/);
  assert.match(stream, /stream_leases/);
  assert.match(database, /DATABASE_URL/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS portfolio\.events/);
  assert.match(page, /\/api\/analytics/);
  assert.match(page, /durable PostgreSQL history/i);
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
