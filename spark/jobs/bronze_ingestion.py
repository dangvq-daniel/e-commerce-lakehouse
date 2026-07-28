"""Consume Kafka with Structured Streaming and preserve immutable Bronze envelopes."""

from __future__ import annotations

import argparse
import os

from common import BRONZE_ROOT, CHECKPOINT_ROOT, spark_session
from pyspark.sql import functions as F


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--trigger",
        choices=("available-now", "processing-time"),
        default="available-now",
    )
    return parser.parse_args()


def main() -> None:
    args = arguments()
    spark = spark_session("ecommerce-local-bronze")
    topics = os.getenv(
        "KAFKA_TOPICS",
        "customer_events,purchase_events,inventory_events,refund_events,product_events",
    )
    kafka = (
        spark.readStream.format("kafka")
        .option(
            "kafka.bootstrap.servers",
            os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092"),
        )
        .option("subscribe", topics)
        .option("startingOffsets", os.getenv("KAFKA_STARTING_OFFSETS", "earliest"))
        .option("failOnDataLoss", "false")
        .option("maxOffsetsPerTrigger", os.getenv("KAFKA_MAX_OFFSETS_PER_TRIGGER", "10000"))
        .load()
    )

    envelopes = kafka.select(
        "topic",
        F.col("partition").alias("partition_id"),
        F.col("offset").alias("kafka_offset"),
        F.col("timestamp").alias("kafka_timestamp"),
        F.col("key").cast("string").alias("message_key"),
        F.col("value").cast("string").alias("raw_payload"),
        F.current_timestamp().alias("_ingestion_time"),
        F.current_date().alias("_ingestion_date"),
    )
    writer = (
        envelopes.writeStream.queryName("local_bronze_ingestion")
        .format("delta")
        .outputMode("append")
        .option("checkpointLocation", str(CHECKPOINT_ROOT / "bronze"))
        .option("path", str(BRONZE_ROOT / "events"))
    )
    writer = (
        writer.trigger(availableNow=True)
        if args.trigger == "available-now"
        else writer.trigger(
            processingTime=os.getenv("SPARK_PROCESSING_INTERVAL", "10 seconds")
        )
    )
    writer.start().awaitTermination()


if __name__ == "__main__":
    main()
