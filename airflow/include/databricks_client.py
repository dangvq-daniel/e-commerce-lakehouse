"""Minimal Databricks Jobs API client with polling and explicit failure handling."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import requests

LOGGER = logging.getLogger(__name__)
TERMINAL_STATES = {"TERMINATED", "SKIPPED", "INTERNAL_ERROR"}
SUCCESS_RESULTS = {"SUCCESS"}


@dataclass
class DatabricksJobsClient:
    host: str
    token: str
    poll_seconds: int = 20
    timeout_seconds: int = 7_200

    def __post_init__(self) -> None:
        self.host = self.host.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        response = self.session.request(method, f"{self.host}{path}", timeout=30, **kwargs)
        response.raise_for_status()
        return response.json()

    def trigger_and_wait(self, job_id: int, notebook_params: dict[str, str] | None = None) -> int:
        payload: dict[str, Any] = {"job_id": job_id}
        if notebook_params:
            payload["notebook_params"] = notebook_params
        run_id = int(self._request("POST", "/api/2.1/jobs/run-now", json=payload)["run_id"])
        LOGGER.info("triggered Databricks job %s as run %s", job_id, run_id)

        deadline = time.monotonic() + self.timeout_seconds
        while time.monotonic() < deadline:
            run = self._request("GET", "/api/2.1/jobs/runs/get", params={"run_id": run_id})
            state = run.get("state", {})
            lifecycle = state.get("life_cycle_state")
            result = state.get("result_state")
            LOGGER.info("Databricks run %s state=%s result=%s", run_id, lifecycle, result)
            if lifecycle in TERMINAL_STATES:
                if result not in SUCCESS_RESULTS:
                    message = state.get("state_message", "no state message")
                    raise RuntimeError(f"Databricks run {run_id} failed: {result}: {message}")
                return run_id
            time.sleep(self.poll_seconds)
        raise TimeoutError(f"Databricks run {run_id} exceeded {self.timeout_seconds}s")

