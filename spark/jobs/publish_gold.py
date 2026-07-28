"""Publish the eight local Delta Gold tables to PostgreSQL through JDBC."""

from __future__ import annotations

import os

from common import WAREHOUSE_ROOT, spark_session

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
    spark = spark_session("ecommerce-local-publish")
    jdbc_url = os.getenv(
        "POSTGRES_JDBC_URL",
        "jdbc:postgresql://postgres:5432/warehouse",
    )
    user = os.getenv("POSTGRES_USER", "ecommerce")
    password = os.getenv("POSTGRES_PASSWORD", "ecommerce")

    driver_manager = spark._sc._gateway.jvm.java.sql.DriverManager
    connection = driver_manager.getConnection(jdbc_url, user, password)
    try:
        statement = connection.createStatement()
        statement.execute("CREATE SCHEMA IF NOT EXISTS gold")
        statement.close()
    finally:
        connection.close()

    properties = {
        "user": user,
        "password": password,
        "driver": "org.postgresql.Driver",
        "batchsize": "10000",
    }
    for table in GOLD_TABLES:
        path = WAREHOUSE_ROOT / "gold.db" / table
        frame = spark.read.format("delta").load(str(path))
        print(f"publishing {table}: {frame.count()} rows", flush=True)
        (
            frame.write.mode("overwrite")
            .option("truncate", "true")
            .jdbc(jdbc_url, f"gold.{table}", properties=properties)
        )


if __name__ == "__main__":
    main()
