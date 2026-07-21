"""Orchestrate the E-commerce Lakehouse batch control plane.

Streaming ingestion jobs normally run continuously in Databricks. The optional
job-ID tasks support bounded/available-now jobs. The local compatibility harness
uses the PostgreSQL dbt target when Databricks credentials are not configured.
"""

from __future__ import annotations

import logging
import os
import socket
import subprocess
from datetime import UTC, datetime, timedelta

import psycopg2
import requests
from include.databricks_client import DatabricksJobsClient

from airflow import DAG
from airflow.operators.empty import EmptyOperator
from airflow.operators.python import PythonOperator

LOGGER = logging.getLogger(__name__)
DBT_DIR = "/opt/airflow/dbt"


def validate_kafka() -> None:
    server = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092").split(",")[0]
    host, port = server.rsplit(":", 1)
    with socket.create_connection((host, int(port)), timeout=10):
        LOGGER.info("Kafka endpoint %s is available", server)


def run_databricks_job(job_id_variable: str) -> str | int:
    job_id = os.getenv(job_id_variable)
    host = os.getenv("DATABRICKS_HOST")
    token = os.getenv("DATABRICKS_TOKEN")
    if not all((job_id, host, token)):
        LOGGER.info("%s is not configured; using the local processing path", job_id_variable)
        return "local-mode"
    return DatabricksJobsClient(host=host, token=token).trigger_and_wait(int(job_id))


def run_dbt(*arguments: str) -> None:
    target = os.getenv("DBT_TARGET", "dev")
    command = [
        "dbt",
        *arguments,
        "--target",
        target,
        "--project-dir",
        DBT_DIR,
        "--profiles-dir",
        DBT_DIR,
    ]
    LOGGER.info("running %s", " ".join(command))
    subprocess.run(command, check=True, cwd=DBT_DIR)


def warehouse_connection():
    return psycopg2.connect(
        host=os.getenv("WAREHOUSE_HOST", "postgres"),
        port=int(os.getenv("WAREHOUSE_PORT", "5432")),
        dbname=os.getenv("WAREHOUSE_DB", "warehouse"),
        user=os.getenv("POSTGRES_USER", "ecommerce"),
        password=os.getenv("POSTGRES_PASSWORD", "ecommerce"),
    )


def record_warehouse_load(**context) -> None:
    with warehouse_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT count(*), max(sold_at)
            FROM gold.fact_sales
            """
        )
        gold_row_count, latest_gold_at = cursor.fetchone()
        cursor.execute(
            """
            ALTER TABLE monitoring.pipeline_runs
              ADD COLUMN IF NOT EXISTS gold_row_count BIGINT,
              ADD COLUMN IF NOT EXISTS latest_gold_at TIMESTAMPTZ
            """
        )
        cursor.execute(
            """
            INSERT INTO monitoring.pipeline_runs
                (dag_id, run_timestamp, raw_event_count, latest_event_at,
                 gold_row_count, latest_gold_at, status)
            VALUES (%s, now(), 0, NULL, %s, %s, 'success')
            """,
            (context["dag"].dag_id, gold_row_count, latest_gold_at),
        )
        LOGGER.info(
            "warehouse contains %s Gold sales rows; latest=%s",
            gold_row_count,
            latest_gold_at,
        )


def refresh_metabase() -> str:
    base_url = os.getenv("METABASE_URL", "http://metabase:3000").rstrip("/")
    email = os.getenv("METABASE_ADMIN_EMAIL")
    password = os.getenv("METABASE_ADMIN_PASSWORD")
    if not email or not password:
        LOGGER.info("Metabase credentials are not configured; skipping schema sync")
        return "not-configured"
    session = requests.Session()
    login = session.post(
        f"{base_url}/api/session",
        json={"username": email, "password": password},
        timeout=20,
    )
    if login.status_code >= 400:
        LOGGER.warning("Metabase is not initialized yet; skipping schema sync")
        return "not-ready"
    session.headers["X-Metabase-Session"] = login.json()["id"]
    databases = session.get(f"{base_url}/api/database", timeout=20).json().get("data", [])
    warehouse = next((item for item in databases if item["name"] == "E-commerce Warehouse"), None)
    if not warehouse:
        LOGGER.warning("Metabase warehouse connection is missing")
        return "database-missing"
    response = session.post(f"{base_url}/api/database/{warehouse['id']}/sync_schema", timeout=20)
    response.raise_for_status()
    return "sync-requested"


default_args = {
    "owner": "data-platform",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=2),
    "execution_timeout": timedelta(hours=2),
}

with DAG(
    dag_id="ecommerce_pipeline_dag",
    description="Process Bronze/Silver, build Delta Gold with dbt, publish PostgreSQL, refresh BI",
    start_date=datetime(2026, 1, 1, tzinfo=UTC),
    schedule="*/5 * * * *",
    catchup=False,
    max_active_runs=1,
    default_args=default_args,
    tags=["ecommerce", "streaming", "lakehouse"],
) as dag:
    start = EmptyOperator(task_id="start")
    kafka_available = PythonOperator(
        task_id="validate_kafka_availability", python_callable=validate_kafka
    )
    bronze = PythonOperator(
        task_id="trigger_databricks_bronze",
        python_callable=run_databricks_job,
        op_args=["DATABRICKS_BRONZE_JOB_ID"],
    )
    silver = PythonOperator(
        task_id="trigger_databricks_silver",
        python_callable=run_databricks_job,
        op_args=["DATABRICKS_SILVER_JOB_ID"],
    )
    dbt_models = PythonOperator(
        task_id="execute_dbt_models", python_callable=run_dbt, op_args=["run"]
    )
    dbt_tests = PythonOperator(
        task_id="execute_dbt_tests", python_callable=run_dbt, op_args=["test"]
    )
    data_quality = PythonOperator(
        task_id="run_data_quality_checks",
        python_callable=run_databricks_job,
        op_args=["DATABRICKS_QUALITY_JOB_ID"],
    )
    publish_warehouse = PythonOperator(
        task_id="publish_delta_gold_to_postgres",
        python_callable=run_databricks_job,
        op_args=["DATABRICKS_WAREHOUSE_JOB_ID"],
    )
    audit_warehouse = PythonOperator(
        task_id="audit_warehouse_load", python_callable=record_warehouse_load
    )
    dashboard = PythonOperator(task_id="refresh_dashboard", python_callable=refresh_metabase)
    finish = EmptyOperator(task_id="finish")

    (
        start
        >> kafka_available
        >> bronze
        >> silver
        >> dbt_models
        >> dbt_tests
        >> data_quality
        >> publish_warehouse
        >> audit_warehouse
        >> dashboard
        >> finish
    )
