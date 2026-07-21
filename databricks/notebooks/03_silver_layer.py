# Databricks notebook source
"""Validate, normalize, deduplicate, and publish typed Silver streams."""

# COMMAND ----------

from pyspark.sql import functions as F
from pyspark.sql.types import (
    DoubleType,
    IntegerType,
    LongType,
    StringType,
    StructField,
    StructType,
)

dbutils.widgets.text("catalog", "ecommerce")
dbutils.widgets.text("checkpoint_root", "dbfs:/checkpoints/ecommerce")
dbutils.widgets.text("trigger_interval", "10 seconds")
dbutils.widgets.dropdown("trigger_mode", "processing_time", ["processing_time", "available_now"])

catalog = dbutils.widgets.get("catalog")
checkpoint_root = dbutils.widgets.get("checkpoint_root").rstrip("/")
trigger_interval = dbutils.widgets.get("trigger_interval")
trigger_mode = dbutils.widgets.get("trigger_mode")

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {catalog}.silver")

# COMMAND ----------

event_schema = StructType(
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
        StructField("search_term", StringType()),
        StructField("page_url", StringType()),
        StructField("review_id", StringType()),
        StructField("rating", IntegerType()),
        StructField("login_method", StringType()),
    ]
)

bronze = spark.readStream.table(f"{catalog}.bronze.events")
parsed = bronze.select(
    F.from_json("raw_payload", event_schema).alias("event"),
    "raw_payload",
    "topic",
    "partition_id",
    "kafka_offset",
    "_ingestion_time",
).select("event.*", "raw_payload", "topic", "partition_id", "kafka_offset", "_ingestion_time")

normalized = (
    parsed.withColumn("event_timestamp", F.to_timestamp("timestamp"))
    .drop("timestamp")
    .withColumn(
        "category",
        F.lower(F.regexp_replace(F.trim(F.col("category")), r"[^a-zA-Z0-9]+", "_")),
    )
    .withColumn("country", F.initcap(F.trim(F.col("country"))))
    .withColumn("event_date", F.to_date("event_timestamp"))
)

valid_types = [
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
]

invalid_reason = (
    F.when(F.col("event_id").isNull(), F.lit("missing_event_id"))
    .when(~F.col("event_type").isin(valid_types), F.lit("invalid_event_type"))
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
valid = (
    classified.filter(F.col("_invalid_reason").isNull())
    .drop("_invalid_reason")
    .withWatermark("event_timestamp", "1 day")
    .dropDuplicates(["event_id"])
)
quarantine = classified.filter(F.col("_invalid_reason").isNotNull())

# COMMAND ----------


def write_stream(frame, table: str, checkpoint: str, partition_by: str | None = None):
    writer = (
        frame.writeStream.queryName(f"ecommerce_{table}")
        .format("delta")
        .outputMode("append")
        .option("checkpointLocation", f"{checkpoint_root}/{checkpoint}")
    )
    writer = (
        writer.trigger(availableNow=True)
        if trigger_mode == "available_now"
        else writer.trigger(processingTime=trigger_interval)
    )
    if partition_by:
        writer = writer.partitionBy(partition_by)
    return writer.toTable(f"{catalog}.silver.{table}")


queries = [
    write_stream(valid, "events", "03_silver_events", "event_date"),
    write_stream(quarantine, "quarantined_events", "03_silver_quarantine"),
    write_stream(
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
        "orders",
        "03_silver_orders",
    ),
    write_stream(
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
        "refunds",
        "03_silver_refunds",
    ),
    write_stream(
        valid.filter(F.col("user_id").isNotNull()).select(
            F.col("user_id").alias("customer_id"),
            "event_timestamp",
            "country",
            "device",
        ),
        "customer_activity",
        "03_silver_customer_activity",
    ),
    write_stream(
        valid.filter(F.col("product_id").isNotNull()).select(
            "product_id", "product_name", "category", "price", "event_timestamp"
        ),
        "product_activity",
        "03_silver_product_activity",
    ),
    write_stream(
        valid.filter(F.col("event_type") == "inventory_update").select(
            "event_id",
            "product_id",
            "warehouse_id",
            "event_timestamp",
            "inventory_quantity",
            "inventory_delta",
        ),
        "inventory",
        "03_silver_inventory",
    ),
]

for query in queries:
    query.awaitTermination()
