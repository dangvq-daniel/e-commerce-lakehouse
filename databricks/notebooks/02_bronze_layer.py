# Databricks notebook source
"""Extract routing fields while retaining the immutable original payload."""

# COMMAND ----------

from pyspark.sql import functions as F

dbutils.widgets.text("catalog", "ecommerce")
dbutils.widgets.text("checkpoint_root", "dbfs:/checkpoints/ecommerce")
dbutils.widgets.text("trigger_interval", "10 seconds")
dbutils.widgets.dropdown("trigger_mode", "processing_time", ["processing_time", "available_now"])

catalog = dbutils.widgets.get("catalog")
checkpoint_root = dbutils.widgets.get("checkpoint_root").rstrip("/")
trigger_interval = dbutils.widgets.get("trigger_interval")
trigger_mode = dbutils.widgets.get("trigger_mode")

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {catalog}.bronze")

# COMMAND ----------

envelopes = spark.readStream.table(f"{catalog}.bronze.kafka_events")

bronze_events = envelopes.select(
    F.get_json_object("raw_payload", "$.event_id").alias("event_id"),
    F.get_json_object("raw_payload", "$.event_type").alias("event_type"),
    F.to_timestamp(F.get_json_object("raw_payload", "$.timestamp")).alias("event_timestamp"),
    "topic",
    "partition_id",
    "kafka_offset",
    "kafka_timestamp",
    "raw_payload",
    "_ingestion_time",
    "_ingestion_date",
)

writer = (
    bronze_events.writeStream.queryName("ecommerce_bronze_events")
    .format("delta")
    .outputMode("append")
    .option("checkpointLocation", f"{checkpoint_root}/02_bronze_events")
    .partitionBy("_ingestion_date")
)
writer = (
    writer.trigger(availableNow=True)
    if trigger_mode == "available_now"
    else writer.trigger(processingTime=trigger_interval)
)
query = writer.toTable(f"{catalog}.bronze.events")

query.awaitTermination()
