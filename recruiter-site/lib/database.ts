import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

export const databaseConfigured = Boolean(databaseUrl);

export const sql = databaseUrl
  ? postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 20,
      prepare: false,
      ssl: "require",
    })
  : null;

export async function initializeDatabase() {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured");
  }

  await sql`CREATE SCHEMA IF NOT EXISTS portfolio`;
  await sql`
    CREATE TABLE IF NOT EXISTS portfolio.events (
      event_id UUID PRIMARY KEY,
      event_type TEXT NOT NULL,
      event_timestamp TIMESTAMPTZ NOT NULL,
      customer_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      product_id TEXT,
      category TEXT,
      amount NUMERIC(12, 2),
      quantity INTEGER,
      status TEXT NOT NULL,
      payload JSONB NOT NULL,
      ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS portfolio_events_timestamp_idx
    ON portfolio.events (event_timestamp DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS portfolio_events_type_timestamp_idx
    ON portfolio.events (event_type, event_timestamp DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS portfolio.stream_leases (
      lease_name TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_event_at TIMESTAMPTZ,
      events_written BIGINT NOT NULL DEFAULT 0
    )
  `;
}

export function requireDatabase() {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured");
  }
  return sql;
}
