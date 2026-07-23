function boundedInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const candidate = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(candidate)) return fallback;
  return Math.min(Math.max(Math.round(candidate), minimum), maximum);
}

// The public demo favors a readable, budget-safe pulse over high-volume generation.
export const eventIntervalMs = boundedInteger("EVENT_INTERVAL_MS", 60_000, 60_000, 300_000);
export const streamHeartbeatMs = 15_000;
export const maxEventRows = boundedInteger("MAX_EVENT_ROWS", 50_000, 5_000, 100_000);
export const eventRetentionDays = boundedInteger("EVENT_RETENTION_DAYS", 35, 30, 45);

// Supabase Free currently allows 500 MB of database size. Stop demo writes at 40%
// so platform metadata, indexes, and future schema changes retain ample headroom.
export const supabaseFreeDatabaseQuotaBytes = 500_000_000;
export const databaseWriteGuardBytes = boundedInteger(
  "DATABASE_WRITE_GUARD_BYTES",
  200_000_000,
  100_000_000,
  400_000_000,
);
