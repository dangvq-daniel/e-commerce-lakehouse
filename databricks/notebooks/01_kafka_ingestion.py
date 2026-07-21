# Databricks notebook source
"""Ingest Kafka envelopes into an append-only Delta table.

Run this notebook as a continuous Databricks job. Configuration is supplied via
widgets so the same artifact can be deployed to development and production.
"""

# COMMAND ----------

from pyspark.sql import functions as F

dbutils.widgets.text("catalog", "ecommerce")
dbutils.widgets.text("kafka_bootstrap_servers", "kafka:9092")
dbutils.widgets.text(
    "topics", "customer_events,purchase_events,inventory_events,refund_events,product_events"
)
dbutils.widgets.text("checkpoint_root", "dbfs:/checkpoints/ecommerce")
dbutils.widgets.text("trigger_interval", "10 seconds")
dbutils.widgets.dropdown("trigger_mode", "processing_time", ["processing_time", "available_now"])
dbutils.widgets.dropdown("starting_offsets", "latest", ["latest", "earliest"])

catalog = dbutils.widgets.get("catalog")
bootstrap_servers = dbutils.widgets.get("kafka_bootstrap_servers")
topics = dbutils.widgets.get("topics")
checkpoint_root = dbutils.widgets.get("checkpoint_root").rstrip("/")
trigger_interval = dbutils.widgets.get("trigger_interval")
trigger_mode = dbutils.widgets.get("trigger_mode")
starting_offsets = dbutils.widgets.get("starting_offsets")

# COMMAND ----------

spark.sql(f"CREATE CATALOG IF NOT EXISTS {catalog}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {catalog}.bronze")

kafka_options = {
    "kafka.bootstrap.servers": bootstrap_servers,
    "subscribe": topics,
    "startingOffsets": starting_offsets,
    "failOnDataLoss": "false",
    "maxOffsetsPerTrigger": "1000000",
}

# Add secured-cluster options without embedding credentials in source code, for example:
# kafka_options["kafka.security.protocol"] = "SASL_SSL"
# kafka_options["kafka.sasl.mechanism"] = "PLAIN"
# kafka_options["kafka.sasl.jaas.config"] = dbutils.secrets.get("ecommerce", "kafka-jaas")

raw_kafka = spark.readStream.format("kafka").options(**kafka_options).load()

envelopes = raw_kafka.select(
    F.col("topic"),
    F.col("partition").alias("partition_id"),
    F.col("offset").alias("kafka_offset"),
    F.col("timestamp").alias("kafka_timestamp"),
    F.col("key").cast("string").alias("message_key"),
    F.col("value").cast("string").alias("raw_payload"),
    F.current_timestamp().alias("_ingestion_time"),
    F.current_date().alias("_ingestion_date"),
)

writer = (
    envelopes.writeStream.queryName("ecommerce_kafka_ingestion")
    .format("delta")
    .outputMode("append")
    .option("checkpointLocation", f"{checkpoint_root}/01_kafka_ingestion")
    .partitionBy("_ingestion_date")
)
writer = (
    writer.trigger(availableNow=True)
    if trigger_mode == "available_now"
    else writer.trigger(processingTime=trigger_interval)
)
query = writer.toTable(f"{catalog}.bronze.kafka_events")

query.awaitTermination()
