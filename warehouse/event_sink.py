"""Kafka-to-PostgreSQL raw sink used by the local development path."""

from __future__ import annotations

import json
import logging
import os
import signal
import time
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import psycopg

from generator.contracts import TOPICS
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

LOGGER = logging.getLogger("ecommerce.event_sink")

CREATE_TABLE_SQL = """
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
"""

INSERT_SQL = """
INSERT INTO raw.events (
    event_id, event_type, event_timestamp, topic, partition_id, kafka_offset, payload, ingested_at
) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
ON CONFLICT DO NOTHING
"""


def database_url() -> str:
    if configured := os.getenv("WAREHOUSE_URL"):
        return configured
    user = os.getenv("POSTGRES_USER", "ecommerce")
    password = os.getenv("POSTGRES_PASSWORD", "ecommerce")
    host = os.getenv("WAREHOUSE_HOST", "localhost")
    port = os.getenv("WAREHOUSE_PORT", "5432")
    database = os.getenv("WAREHOUSE_DB", "warehouse")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def parse_event(value: bytes) -> Mapping[str, Any]:
    event = json.loads(value.decode("utf-8"))
    required = ("event_id", "event_type", "timestamp")
    missing = [field for field in required if not event.get(field)]
    if missing:
        raise ValueError(f"missing event fields: {', '.join(missing)}")
    return event


def connect_database(retries: int = 30) -> psycopg.Connection[Any]:
    for attempt in range(1, retries + 1):
        try:
            connection = psycopg.connect(database_url(), autocommit=False)
            with connection.cursor() as cursor:
                cursor.execute(CREATE_TABLE_SQL)
            connection.commit()
            return connection
        except psycopg.OperationalError:
            if attempt == retries:
                raise
            LOGGER.info("PostgreSQL is not ready (attempt %s/%s)", attempt, retries)
            time.sleep(min(attempt, 5))
    raise RuntimeError("unreachable")


def connect_consumer(retries: int = 30) -> KafkaConsumer:
    servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092").split(",")
    for attempt in range(1, retries + 1):
        try:
            return KafkaConsumer(
                *TOPICS,
                bootstrap_servers=servers,
                group_id=os.getenv("KAFKA_CONSUMER_GROUP", "local-postgres-sink-v1"),
                enable_auto_commit=False,
                auto_offset_reset="earliest",
                consumer_timeout_ms=1_000,
                max_poll_records=500,
            )
        except NoBrokersAvailable:
            if attempt == retries:
                raise
            LOGGER.info("Kafka is not ready (attempt %s/%s)", attempt, retries)
            time.sleep(min(attempt, 5))
    raise RuntimeError("unreachable")


def run() -> None:
    stopping = False

    def request_stop(_signum: int, _frame: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    database = connect_database()
    consumer = connect_consumer()
    LOGGER.info("consuming topics: %s", ", ".join(TOPICS))

    try:
        while not stopping:
            records = consumer.poll(timeout_ms=1_000, max_records=500)
            if not records:
                continue
            try:
                with database.cursor() as cursor:
                    for messages in records.values():
                        for message in messages:
                            try:
                                event = parse_event(message.value)
                                event_time = datetime.fromisoformat(str(event["timestamp"]))
                                cursor.execute(
                                    INSERT_SQL,
                                    (
                                        event["event_id"],
                                        event["event_type"],
                                        event_time,
                                        message.topic,
                                        message.partition,
                                        message.offset,
                                        json.dumps(event),
                                        datetime.now(UTC),
                                    ),
                                )
                            except (ValueError, json.JSONDecodeError):
                                LOGGER.exception(
                                    "discarding malformed message at %s/%s/%s",
                                    message.topic,
                                    message.partition,
                                    message.offset,
                                )
                database.commit()
                consumer.commit()
            except Exception:
                database.rollback()
                LOGGER.exception("batch failed; Kafka offsets were not committed")
                time.sleep(2)
    finally:
        consumer.close(autocommit=False)
        database.close()


def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(message)s")
    run()


if __name__ == "__main__":
    main()

