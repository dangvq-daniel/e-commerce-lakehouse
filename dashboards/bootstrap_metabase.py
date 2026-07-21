"""Idempotently initialize Metabase and provision dashboards from a manifest."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import requests
import yaml

LOGGER = logging.getLogger("metabase.bootstrap")
ROOT = Path(__file__).parent


class Metabase:
    def __init__(self) -> None:
        self.base_url = os.getenv("METABASE_URL", "http://metabase:3000").rstrip("/")
        self.email = os.getenv("METABASE_ADMIN_EMAIL", "admin@example.com")
        self.password = os.getenv("METABASE_ADMIN_PASSWORD", "metabase123!")
        self.session = requests.Session()

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.session.request(method, f"{self.base_url}{path}", timeout=30, **kwargs)
        response.raise_for_status()
        return response.json() if response.content else None

    def initialize(self) -> None:
        properties = self.request("GET", "/api/session/properties")
        setup_token = properties.get("setup-token")
        if setup_token:
            LOGGER.info("performing first-time Metabase setup")
            self.request(
                "POST",
                "/api/setup",
                json={
                    "token": setup_token,
                    "user": {
                        "email": self.email,
                        "first_name": os.getenv("METABASE_ADMIN_FIRST_NAME", "Data"),
                        "last_name": os.getenv("METABASE_ADMIN_LAST_NAME", "Admin"),
                        "password": self.password,
                    },
                    "prefs": {
                        "site_name": "E-commerce Analytics",
                        "site_locale": "en",
                        "allow_tracking": False,
                    },
                    "database": self.database_payload(),
                },
            )
        login = self.request(
            "POST", "/api/session", json={"username": self.email, "password": self.password}
        )
        self.session.headers["X-Metabase-Session"] = login["id"]

    @staticmethod
    def database_payload() -> dict[str, Any]:
        return {
            "engine": "postgres",
            "name": "E-commerce Warehouse",
            "details": {
                "host": os.getenv("WAREHOUSE_HOST", "postgres"),
                "port": int(os.getenv("WAREHOUSE_PORT", "5432")),
                "dbname": os.getenv("WAREHOUSE_DB", "warehouse"),
                "user": os.getenv("POSTGRES_USER", "ecommerce"),
                "password": os.getenv("POSTGRES_PASSWORD", "ecommerce"),
                "ssl": False,
                "advanced-options": False,
            },
        }

    def warehouse_id(self) -> int:
        response = self.request("GET", "/api/database")
        databases = response.get("data", response) if isinstance(response, dict) else response
        existing = next(
            (database for database in databases if database["name"] == "E-commerce Warehouse"), None
        )
        if existing:
            return int(existing["id"])
        return int(self.request("POST", "/api/database", json=self.database_payload())["id"])

    def dashboard_id(self, name: str, description: str) -> int:
        response = self.request("GET", "/api/dashboard")
        dashboards = response.get("data", response) if isinstance(response, dict) else response
        existing = next((dashboard for dashboard in dashboards if dashboard["name"] == name), None)
        if existing:
            return int(existing["id"])
        return int(
            self.request(
                "POST",
                "/api/dashboard",
                json={"name": name, "description": description, "parameters": []},
            )["id"]
        )

    def card_id(self, name: str, query_path: str, display: str, database_id: int) -> int:
        response = self.request("GET", "/api/card")
        cards = response.get("data", response) if isinstance(response, dict) else response
        existing = next((card for card in cards if card["name"] == name), None)
        if existing:
            return int(existing["id"])
        sql = (ROOT / "queries" / query_path).read_text(encoding="utf-8").strip().rstrip(";")
        payload = {
            "name": name,
            "description": f"Provisioned from dashboards/queries/{query_path}",
            "display": display,
            "dataset_query": {
                "type": "native",
                "database": database_id,
                "native": {"query": sql, "template-tags": {}},
            },
            "visualization_settings": {},
            "collection_id": None,
        }
        return int(self.request("POST", "/api/card", json=payload)["id"])

    def attach_card(self, dashboard_id: int, card_id: int, position: int) -> None:
        dashboard = self.request("GET", f"/api/dashboard/{dashboard_id}")
        attached_ids = {
            item.get("card", {}).get("id") for item in dashboard.get("dashcards", [])
        }
        if card_id in attached_ids:
            return
        self.request(
            "POST",
            f"/api/dashboard/{dashboard_id}/cards",
            json={
                "cardId": card_id,
                "row": (position // 2) * 4,
                "col": (position % 2) * 9,
                "sizeX": 9,
                "sizeY": 4,
                "parameter_mappings": [],
            },
        )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    manifest = yaml.safe_load((ROOT / "dashboard_manifest.yml").read_text(encoding="utf-8"))
    metabase = Metabase()
    metabase.initialize()
    database_id = metabase.warehouse_id()
    for dashboard_config in manifest["dashboards"]:
        dashboard_id = metabase.dashboard_id(
            dashboard_config["name"], dashboard_config["description"]
        )
        for position, card_config in enumerate(dashboard_config["cards"]):
            card_id = metabase.card_id(database_id=database_id, **card_config)
            metabase.attach_card(dashboard_id, card_id, position)
        LOGGER.info("provisioned dashboard: %s", dashboard_config["name"])


if __name__ == "__main__":
    main()

