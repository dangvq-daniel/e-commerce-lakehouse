"""Validate Bronze events and publish idempotent typed Silver Delta tables."""

from __future__ import annotations

import argparse
import os

from common import (
    BRONZE_ROOT,
    CHECKPOINT_ROOT,
    SILVER_ROOT,
    merge_insert_only,
    spark_session,
)
from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import (
    DoubleType,
    IntegerType,
    LongType,
    StringType,
    StructField,
    StructType,
)

EVENT_SCHEMA = StructType(
    [
        StructField("event_id", StringType()),
        StructField("event_type", StringType()),
        StructField("timestamp", StringType()),
        StructField("user_id", LongType()),
        StructField("session_id", StringType()),
        StructField("product_id", LongType()),
        StructField("product_name", StringType()),
        StructField("category", StringType()),
        StructField("price", DoubleType()),
        StructField("quantity", IntegerType()),
        StructField("country", StringType()),
        StructField("device", StringType()),
        StructField("payment_method", StringType()),
        StructField("order_id", StringType()),
        StructField("order_status", StringType()),
        StructField("refund_id", StringType()),
        StructField("refund_reason", StringType()),
        StructField("warehouse_id", StringType()),
        StructField("inventory_quantity", IntegerType()),
        StructField("inventory_delta", IntegerType()),
        StructField("rating", IntegerType()),
    ]
)
VALID_EVENT_TYPES = (
    "page_view",
    "product_view",
    "search",
    "add_to_cart",
    "remove_from_cart",
    "purchase",
    "refund",
    "inventory_update",
    "user_login",
    "product_review",
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--trigger",
        choices=("available-now", "processing-time"),
        default="available-now",
    )
    return parser.parse_args()


def transform_batch(bronze: DataFrame, batch_id: int) -> None:
    parsed = bronze.select(
        F.from_json("raw_payload", EVENT_SCHEMA).alias("event"),
        "raw_payload",
        "topic",
        "partition_id",
        "kafka_offset",
        "_ingestion_time",
    ).select(
        "event.*",
        "raw_payload",
        "topic",
        "partition_id",
        "kafka_offset",
        "_ingestion_time",
    )
    normalized = (
        parsed.withColumn("event_timestamp", F.to_timestamp("timestamp"))
        .drop("timestamp")
        .withColumn(
            "category",
            F.lower(F.regexp_replace(F.trim("category"), r"[^a-zA-Z0-9]+", "_")),
        )
        .withColumn("country", F.initcap(F.trim("country")))
        .withColumn("device", F.lower(F.trim("device")))
        .withColumn("payment_method", F.lower(F.trim("payment_method")))
        .withColumn("order_status", F.lower(F.trim("order_status")))
        .withColumn("refund_reason", F.lower(F.trim("refund_reason")))
    )
    invalid_reason = (
        F.when(F.col("event_id").isNull(), F.lit("missing_event_id"))
        .when(~F.col("event_type").isin(*VALID_EVENT_TYPES), F.lit("invalid_event_type"))
        .when(F.col("event_timestamp").isNull(), F.lit("invalid_timestamp"))
        .when(F.col("event_timestamp") > F.current_timestamp(), F.lit("future_timestamp"))
        .when(
            (F.col("event_type") == "purchase")
            & (F.col("user_id").isNull() | F.col("product_id").isNull()),
            F.lit("missing_purchase_key"),
        )
        .when(
            (F.col("event_type") == "purchase")
            & ((F.col("price") <= 0) | (F.col("quantity") <= 0)),
            F.lit("invalid_purchase_value"),
        )
    )
    classified = normalized.withColumn("_invalid_reason", invalid_reason)
    valid = classified.filter(F.col("_invalid_reason").isNull()).drop(
        "_invalid_reason", "raw_payload"
    )
    valid = valid.dropDuplicates(["event_id"])

    event_columns = [
        "event_id",
        "event_type",
        "event_timestamp",
        "_ingestion_time",
        "topic",
        "partition_id",
        "kafka_offset",
        "user_id",
        "session_id",
        "product_id",
        "product_name",
        "category",
        "price",
        "quantity",
        "country",
        "device",
        "payment_method",
        "order_id",
        "order_status",
        "refund_id",
        "refund_reason",
        "warehouse_id",
        "inventory_quantity",
        "inventory_delta",
        "rating",
    ]
    merge_insert_only(
        valid.select(*event_columns),
        SILVER_ROOT / "events",
        "event_id",
        "silver_events_batch",
    )
    merge_insert_only(
        valid.filter(F.col("event_type") == "purchase").select(
            "event_id",
            "order_id",
            F.col("user_id").alias("customer_id"),
            "product_id",
            "event_timestamp",
            "quantity",
            "price",
            "payment_method",
            "order_status",
            "country",
            "device",
        ),
        SILVER_ROOT / "orders",
        "event_id",
        "silver_orders_batch",
    )
    merge_insert_only(
        valid.filter(F.col("event_type") == "refund").select(
            "event_id",
            "refund_id",
            "order_id",
            F.col("user_id").alias("customer_id"),
            "product_id",
            "event_timestamp",
            "quantity",
            "price",
            "refund_reason",
        ),
        SILVER_ROOT / "refunds",
        "event_id",
        "silver_refunds_batch",
    )
    merge_insert_only(
        valid.filter(F.col("user_id").isNotNull()).select(
            "event_id",
            F.col("user_id").alias("customer_id"),
            "event_timestamp",
            "country",
            "device",
        ),
        SILVER_ROOT / "customer_activity",
        "event_id",
        "silver_customers_batch",
    )
    merge_insert_only(
        valid.filter(F.col("product_id").isNotNull()).select(
            "event_id",
            "product_id",
            "product_name",
            "category",
            "price",
            "event_timestamp",
        ),
        SILVER_ROOT / "product_activity",
        "event_id",
        "silver_products_batch",
    )
    merge_insert_only(
        valid.filter(F.col("event_type") == "inventory_update").select(
            "event_id",
            "product_id",
            "warehouse_id",
            "event_timestamp",
            "inventory_quantity",
            "inventory_delta",
        ),
        SILVER_ROOT / "inventory",
        "event_id",
        "silver_inventory_batch",
    )

    quarantine = (
        classified.filter(F.col("_invalid_reason").isNotNull())
        .withColumn(
            "quarantine_id",
            F.sha2(
                F.concat_ws(
                    ":",
                    "topic",
                    F.col("partition_id").cast("string"),
                    F.col("kafka_offset").cast("string"),
                ),
                256,
            ),
        )
        .select(
            "quarantine_id",
            "raw_payload",
            "topic",
            "partition_id",
            "kafka_offset",
            "_ingestion_time",
            "_invalid_reason",
        )
    )
    merge_insert_only(
        quarantine,
        SILVER_ROOT / "quarantined_events",
        "quarantine_id",
        "silver_quarantine_batch",
    )
    print(f"completed Silver batch {batch_id}", flush=True)


def main() -> None:
    args = arguments()
    spark = spark_session("ecommerce-local-silver")
    bronze = spark.readStream.format("delta").load(str(BRONZE_ROOT / "events"))
    writer = bronze.writeStream.foreachBatch(transform_batch).option(
        "checkpointLocation", str(CHECKPOINT_ROOT / "silver")
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
