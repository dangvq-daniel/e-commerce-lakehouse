\connect warehouse

CREATE SCHEMA IF NOT EXISTS raw;

CREATE TABLE IF NOT EXISTS raw.events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    topic TEXT NOT NULL,
    partition_id INTEGER NOT NULL,
    kafka_offset BIGINT NOT NULL,
    payload JSONB NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (topic, partition_id, kafka_offset)
);

CREATE INDEX IF NOT EXISTS ix_raw_events_type_timestamp
    ON raw.events (event_type, event_timestamp DESC);

CREATE SCHEMA IF NOT EXISTS monitoring;

CREATE TABLE IF NOT EXISTS monitoring.pipeline_runs (
    run_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dag_id TEXT NOT NULL,
    run_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_event_count BIGINT NOT NULL,
    latest_event_at TIMESTAMPTZ,
    gold_row_count BIGINT,
    latest_gold_at TIMESTAMPTZ,
    status TEXT NOT NULL
);
