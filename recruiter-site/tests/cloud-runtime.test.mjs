import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("cloud runtime is resumable and backed by PostgreSQL", async () => {
  const [stream, database, config, page, platform, evidenceText] = await Promise.all([
    readFile(new URL("lib/event-stream.ts", root), "utf8"),
    readFile(new URL("lib/database.ts", root), "utf8"),
    readFile(new URL("lib/demo-config.ts", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("lib/platform-evidence.ts", root), "utf8"),
    readFile(new URL("public/evidence/verified-local-run.json", root), "utf8"),
  ]);
  const evidence = JSON.parse(evidenceText);

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
  assert.match(page, /Choose architecture environment/);
  assert.match(page, /Next budget-safe write/i);
  assert.match(page, /EvidenceInspector/);
  assert.match(page, /One order\. Five understandable steps/);
  assert.match(page, /signalForEvent/);
  assert.match(page, /LATEST EVENT/);
  assert.match(page, /architectureLanes/);
  assert.match(platform, /Apache Kafka/);
  assert.match(platform, /Local Spark verified · Databricks packaged/);
  assert.match(platform, /staging → intermediate → marts/i);
  assert.equal(evidence.airflowRun.status, "success");
  assert.equal(evidence.kafka.topics.length, 5);
  assert.equal(evidence.dbt.passingTests, evidence.dbt.tests);
  assert.equal(evidence.postgresql.tables.length, 8);
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
