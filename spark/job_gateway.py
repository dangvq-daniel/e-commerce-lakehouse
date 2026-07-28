"""Small local-only gateway that submits pinned Spark jobs for Airflow."""

from __future__ import annotations

import json
import os
import subprocess
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path("/opt/ecommerce/spark/jobs")
JOB_SCRIPTS = {
    "bronze": ROOT / "bronze_ingestion.py",
    "silver": ROOT / "silver_transform.py",
    "quality": ROOT / "quality_checks.py",
    "publish": ROOT / "publish_gold.py",
}
JOB_LOCK = threading.Lock()


def spark_submit(job_name: str) -> dict[str, object]:
    script = JOB_SCRIPTS[job_name]
    command = [
        "/opt/spark/bin/spark-submit",
        "--master",
        os.getenv("SPARK_MASTER", "local[2]"),
        "--conf",
        "spark.sql.extensions=io.delta.sql.DeltaSparkSessionExtension",
        "--conf",
        "spark.sql.catalog.spark_catalog=org.apache.spark.sql.delta.catalog.DeltaCatalog",
        "--conf",
        f"spark.sql.warehouse.dir={os.getenv('SPARK_WAREHOUSE_DIR', '/lakehouse/warehouse')}",
        str(script),
    ]
    if job_name in {"bronze", "silver"}:
        command.extend(["--trigger", os.getenv("SPARK_TRIGGER_MODE", "available-now")])

    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        env=os.environ.copy(),
        text=True,
        timeout=int(os.getenv("SPARK_JOB_TIMEOUT_SECONDS", "1800")),
    )
    output = f"{completed.stdout}\n{completed.stderr}".strip()
    return {
        "job": job_name,
        "returncode": completed.returncode,
        "ok": completed.returncode == 0,
        "output": output[-40_000:],
    }


class JobHandler(BaseHTTPRequestHandler):
    server_version = "ecommerce-spark-jobs/1.0"

    def send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802
        if urlparse(self.path).path == "/health":
            self.send_json(HTTPStatus.OK, {"status": "ok", "busy": JOB_LOCK.locked()})
            return
        self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if not path.startswith("/jobs/"):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return

        job_name = path[len("/jobs/") :]
        if job_name not in JOB_SCRIPTS:
            self.send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": f"unknown job; choose one of {', '.join(JOB_SCRIPTS)}"},
            )
            return
        if not JOB_LOCK.acquire(blocking=False):
            self.send_json(HTTPStatus.CONFLICT, {"error": "another Spark job is running"})
            return

        try:
            result = spark_submit(job_name)
            status = HTTPStatus.OK if result["ok"] else HTTPStatus.INTERNAL_SERVER_ERROR
            self.send_json(status, result)
        except subprocess.TimeoutExpired as error:
            self.send_json(
                HTTPStatus.GATEWAY_TIMEOUT,
                {"job": job_name, "error": f"job exceeded {error.timeout} seconds"},
            )
        finally:
            JOB_LOCK.release()

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"spark-jobs: {format_string % args}", flush=True)


if __name__ == "__main__":
    port = int(os.getenv("SPARK_JOBS_PORT", "8090"))
    ThreadingHTTPServer(("0.0.0.0", port), JobHandler).serve_forever()
