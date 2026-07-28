"""Capture recruiter-facing proof from the running local lakehouse.

Run after a successful Airflow DAG:
    python scripts/capture_portfolio_evidence.py
"""

from __future__ import annotations

import csv
import io
import json
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "recruiter-site" / "public" / "evidence" / "verified-local-run.json"


def compose_exec(service: str, *arguments: str) -> str:
    completed = subprocess.run(
        ["docker", "compose", "exec", "-T", service, *arguments],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return completed.stdout.replace("\x00", "").strip()


def beeline(sql: str) -> list[list[str]]:
    output = compose_exec(
        "spark-thrift",
        "/opt/spark/bin/beeline",
        "-u",
        "jdbc:hive2://localhost:10000/default",
        "--silent=true",
        "--showHeader=false",
        "--outputformat=csv2",
        "-e",
        sql,
    )
    lines = []
    for line in output.splitlines():
        line = re.sub(r"^0:\s+jdbc:[^>]+>\s*", "", line)
        line = re.sub(r"^[. ]+>\s*", "", line).strip()
        if line and not line.startswith(("[WARN]", "Connecting", "Connected", "Closing")):
            lines.append(line)
    return list(csv.reader(io.StringIO("\n".join(lines))))


def psql(database: str, query: str) -> list[list[str]]:
    output = compose_exec(
        "postgres",
        "psql",
        "-U",
        "ecommerce",
        "-d",
        database,
        "-At",
        "-F",
        "|",
        "-c",
        query,
    )
    return [line.split("|") for line in output.splitlines() if line]


def main() -> None:
    evidence = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    evidence["capturedAt"] = datetime.now(UTC).replace(microsecond=0).isoformat()

    topic_output = compose_exec(
        "kafka",
        "kafka-topics",
        "--bootstrap-server",
        "kafka:29092",
        "--describe",
    )
    topics = []
    for line in topic_output.splitlines():
        match = re.match(r"Topic: (\S+).*PartitionCount: (\d+)", line)
        if match:
            topics.append({"name": match.group(1), "partitions": int(match.group(2))})
    evidence["kafka"]["topics"] = sorted(topics, key=lambda item: item["name"])

    counts = dict(
        (name, int(count))
        for name, count in beeline(
            "select 'bronze.events', count(*) from bronze.events "
            "union all select 'silver.events', count(*) from silver.events "
            "union all select 'gold.fact_sales', count(*) from gold.fact_sales"
        )
    )
    evidence["spark"]["bronzeInputRows"] = counts["bronze.events"]
    evidence["spark"]["silverOutputRows"] = counts["silver.events"]
    evidence["spark"]["validationYieldPercent"] = round(
        counts["silver.events"] / max(counts["bronze.events"], 1) * 100,
        1,
    )
    for layer in evidence["delta"]["layers"]:
        key = {
            "Bronze": "bronze.events",
            "Silver": "silver.events",
            "Gold": "gold.fact_sales",
        }[layer["name"]]
        layer["rows"] = counts[key]

    table_query = """
    select table_name,
      (xpath('/row/c/text()',
        query_to_xml(format('select count(*) as c from gold.%I', table_name),
        false, true, '')))[1]::text::bigint
    from information_schema.tables
    where table_schema='gold'
    order by table_name
    """
    evidence["postgresql"]["tables"] = [
        {"name": name, "rows": int(rows)} for name, rows in psql("warehouse", table_query)
    ]

    run_query = """
    select run_id, state, start_date, end_date
    from dag_run
    where dag_id='ecommerce_pipeline_dag' and state='success'
    order by end_date desc limit 1
    """
    run_id, state, started_at, finished_at = psql("airflow", run_query)[0]
    evidence["airflowRun"].update(
        {
            "runId": run_id,
            "status": state,
            "startedAt": started_at,
            "finishedAt": finished_at,
        }
    )
    task_query = f"""
    select task_id, state,
      round(extract(epoch from (end_date-start_date))::numeric, 1)
    from task_instance
    where dag_id='ecommerce_pipeline_dag' and run_id='{run_id}'
      and task_id not in ('start', 'finish')
    order by start_date
    """
    tasks = [
        {"name": name, "status": task_state, "durationSeconds": float(duration)}
        for name, task_state, duration in psql("airflow", task_query)
    ]
    evidence["airflowRun"]["tasks"] = tasks
    durations = {task["name"]: task["durationSeconds"] for task in tasks}
    evidence["spark"]["bronzeDurationSeconds"] = durations.get("build_delta_bronze")
    evidence["spark"]["silverDurationSeconds"] = durations.get("build_delta_silver")

    ARTIFACT.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {ARTIFACT.relative_to(ROOT)} from Airflow run {run_id}")


if __name__ == "__main__":
    main()
