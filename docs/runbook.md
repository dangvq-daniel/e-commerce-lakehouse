# Operations runbook

## First checks

1. Check service health with `docker compose ps`.
2. Read the most recent logs for `generator`, `event-sink`, and `airflow-scheduler`.
3. Compare the latest `raw.events.event_timestamp` with current UTC time.
4. In Databricks, inspect the streaming query progress and the latest rows in
   `monitoring.data_quality_results`.
5. Determine whether the issue is ingestion lag, processing lag, invalid data, or BI
   synchronization before restarting components.

## No new events

- Verify the producer can reach the broker and that all five topics exist.
- Inspect consumer group lag with `kafka-consumer-groups --bootstrap-server ...
  --describe --group local-postgres-sink-v1`.
- A producer retry is safe. A sink restart is safe because offsets follow database
  commits and inserts are idempotent.
- If a Databricks checkpoint is unavailable, do not delete it as a first response.
  Restore its storage access or start a documented backfill with a new checkpoint.

## Freshness failure

The Databricks check fails when the newest valid Silver event is more than five minutes
old. Confirm whether the source intentionally stopped. If Kafka contains newer offsets,
inspect the Bronze stream; if Bronze is current, inspect quarantine reasons and Silver
progress. dbt must not build or publish Delta Gold while Silver freshness is in error.

## Quarantine growth

Group `silver.quarantined_events` by `_invalid_reason` and deployment time. Preserve the
payload, identify the producer/version, fix the contract violation, then replay affected
Kafka offsets into a new checkpoint. Validate counts before merging corrected records.

## Controlled replay

1. Record affected topics, partitions, offsets, and event-time interval.
2. Pause downstream dbt Gold builds and PostgreSQL publication if the replay changes business aggregates.
3. Run a bounded reader with a new consumer group/checkpoint and explicit starting and
   ending offsets.
4. Deduplicate by `event_id`; never generate replacement IDs for the same event.
5. Re-run quality checks and compare Bronze/Silver/Gold counts and revenue.
6. Resume dbt Gold, PostgreSQL publication, and dashboard refresh; record the replay.

## Reset local development data

`docker compose down` preserves named volumes. A complete reset uses
`docker compose down --volumes` and permanently deletes local Kafka, PostgreSQL,
Metabase, and Airflow state. Use it only when that loss is intended.

## Suggested alerts

- Kafka consumer lag increasing for 10 minutes
- Latest valid event older than 5 minutes
- Any critical quality check failure
- Quarantine ratio above 1% of a 15-minute window
- Airflow DAG failure or duration above its two-hour limit
- Inventory at zero for products with sales in the last hour
- Refund amount above a historical threshold
