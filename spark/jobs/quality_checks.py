"""Run local Delta quality checks after dbt has built Gold."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from common import LAKEHOUSE_ROOT, SILVER_ROOT, WAREHOUSE_ROOT, spark_session
from pyspark.sql import functions as F

GOLD_TABLES = (
    "dim_customer",
    "dim_product",
    "dim_date",
    "dim_country",
    "fact_orders",
    "fact_sales",
    "fact_sessions",
    "fact_inventory",
)


def main() -> None:
    spark = spark_session("ecommerce-local-quality")
    events = spark.read.format("delta").load(str(SILVER_ROOT / "events"))
    event_count = events.count()
    distinct_ids = events.select("event_id").distinct().count()
    future_events = events.filter(F.col("event_timestamp") > F.current_timestamp()).count()
    if event_count == 0:
        raise RuntimeError("Silver is empty; run Bronze and Silver before quality checks")
    if distinct_ids != event_count:
        raise RuntimeError(
            f"Silver event_id uniqueness failed: rows={event_count} distinct={distinct_ids}"
        )
    if future_events:
        raise RuntimeError(f"Silver contains {future_events} future-dated events")

    gold_counts: dict[str, int] = {}
    for table in GOLD_TABLES:
        path = WAREHOUSE_ROOT / "gold.db" / table
        if not (path / "_delta_log").exists():
            raise RuntimeError(f"missing Gold Delta table: {table}")
        gold_counts[table] = spark.read.format("delta").load(str(path)).count()

    payload = {
        "checked_at": datetime.now(timezone.utc).isoformat(),  # noqa: UP017 - Spark image uses Python 3.8
        "silver_events": event_count,
        "gold_counts": gold_counts,
        "status": "passed",
    }
    metrics_dir = LAKEHOUSE_ROOT / "metrics"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    (metrics_dir / "quality.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload), flush=True)


if __name__ == "__main__":
    main()
