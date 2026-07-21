# Databricks notebook source
"""Record data-quality results and fail the job on critical violations."""

# COMMAND ----------

from datetime import UTC, datetime

from pyspark.sql import functions as F

dbutils.widgets.text("catalog", "ecommerce")
dbutils.widgets.text("freshness_minutes", "5")

catalog = dbutils.widgets.get("catalog")
freshness_minutes = int(dbutils.widgets.get("freshness_minutes"))
run_at = datetime.now(UTC)

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {catalog}.monitoring")
spark.sql(
    f"""
    CREATE TABLE IF NOT EXISTS {catalog}.monitoring.data_quality_results (
      run_at TIMESTAMP,
      layer STRING,
      table_name STRING,
      check_name STRING,
      status STRING,
      failed_records BIGINT,
      details STRING
    ) USING DELTA
    """
)

# COMMAND ----------


def result(layer, table, check, failed, details):
    return (run_at, layer, table, check, "PASS" if failed == 0 else "FAIL", failed, details)


results = []

bronze = spark.table(f"{catalog}.bronze.events")
silver = spark.table(f"{catalog}.silver.events")
orders = spark.table(f"{catalog}.silver.orders")
gold_sales = spark.table(f"{catalog}.gold.fact_sales")

required_bronze_columns = {
    "event_id",
    "event_type",
    "event_timestamp",
    "raw_payload",
    "_ingestion_time",
}
missing_columns = required_bronze_columns - set(bronze.columns)
results.append(
    result(
        "bronze",
        "events",
        "required_columns",
        len(missing_columns),
        f"missing={sorted(missing_columns)}",
    )
)

duplicate_count = (
    silver.groupBy("event_id").count().filter(F.col("count") > 1).limit(1).count()
)
results.append(
    result("silver", "events", "event_id_unique", duplicate_count, "event_id must be unique")
)

null_order_keys = orders.filter(
    F.col("customer_id").isNull() | F.col("product_id").isNull()
).count()
results.append(
    result(
        "silver", "orders", "required_keys", null_order_keys, "customer_id/product_id not null"
    )
)

invalid_values = orders.filter((F.col("price") <= 0) | (F.col("quantity") <= 0)).count()
results.append(
    result("silver", "orders", "positive_values", invalid_values, "price and quantity > 0")
)

future_events = silver.filter(F.col("event_timestamp") > F.current_timestamp()).count()
results.append(
    result("silver", "events", "timestamp_not_future", future_events, "timestamp <= now")
)

latest = silver.agg(F.max("event_timestamp").alias("latest")).first()["latest"]
stale = (
    1
    if latest is None
    or (run_at.replace(tzinfo=None) - latest).total_seconds()
    > freshness_minutes * 60
    else 0
)
results.append(
    result(
        "silver",
        "events",
        "freshness",
        stale,
        f"latest event must be < {freshness_minutes}m old",
    )
)

invalid_gold_sales = gold_sales.filter(
    (F.col("gross_revenue") < 0)
    | (F.col("refunded_amount") < 0)
    | (F.col("refunded_amount") > F.col("gross_revenue"))
).count()
results.append(
    result(
        "gold",
        "fact_sales",
        "valid_revenue",
        invalid_gold_sales,
        "0 <= refunded_amount <= gross_revenue",
    )
)

schema = (
    "run_at timestamp, layer string, table_name string, check_name string, "
    "status string, failed_records long, details string"
)
spark.createDataFrame(results, schema).write.mode("append").saveAsTable(
    f"{catalog}.monitoring.data_quality_results"
)

failures = [row for row in results if row[4] == "FAIL"]
display(spark.createDataFrame(results, schema))
if failures:
    raise RuntimeError(f"{len(failures)} critical data-quality checks failed: {failures}")
