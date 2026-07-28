"""Shared configuration and Delta merge helpers for the local lakehouse."""

from __future__ import annotations

import os
import re
from pathlib import Path

from pyspark.sql import DataFrame, SparkSession

LAKEHOUSE_ROOT = Path(os.getenv("LAKEHOUSE_ROOT", "/lakehouse"))
BRONZE_ROOT = LAKEHOUSE_ROOT / "bronze"
SILVER_ROOT = LAKEHOUSE_ROOT / "silver"
CHECKPOINT_ROOT = LAKEHOUSE_ROOT / "checkpoints"
WAREHOUSE_ROOT = LAKEHOUSE_ROOT / "warehouse"


def spark_session(app_name: str) -> SparkSession:
    return (
        SparkSession.builder.appName(app_name)
        .config("spark.sql.session.timeZone", "UTC")
        .getOrCreate()
    )


def merge_insert_only(frame: DataFrame, path: Path, key: str, view_name: str) -> None:
    """Insert unseen records into an existing Delta table."""
    if not frame.take(1):
        return
    if not re.fullmatch(r"[a-z][a-z0-9_]*", view_name):
        raise ValueError(f"unsafe temporary view name: {view_name}")

    frame.createOrReplaceTempView(view_name)
    frame.sparkSession.sql(
        f"""
        MERGE INTO delta.`{path.as_posix()}` AS target
        USING {view_name} AS source
        ON target.{key} = source.{key}
        WHEN NOT MATCHED THEN INSERT *
        """
    )
