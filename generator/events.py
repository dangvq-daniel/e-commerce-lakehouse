"""Stateful, reproducible synthetic e-commerce behavior."""

from __future__ import annotations

import math
import random
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


@dataclass(frozen=True)
class GeneratorConfig:
    users: int = 2_000
    products: int = 400
    seed: int | None = None


class EventFactory:
    """Generate related customer, commerce, inventory, and product events.

    Cart and purchase state is retained so purchase and refund events reference
    plausible prior activity instead of being independent random records.
    """

    countries = ("Canada", "United States", "United Kingdom", "Germany", "Australia")
    devices = ("mobile", "desktop", "tablet")
    categories = ("electronics", "home", "apparel", "beauty", "sports", "books")
    payment_methods = ("credit_card", "paypal", "debit_card")
    search_terms = ("wireless", "summer sale", "gift", "running", "home office", "new")
    event_weights = {
        "page_view": 0.20,
        "product_view": 0.25,
        "search": 0.10,
        "add_to_cart": 0.12,
        "remove_from_cart": 0.04,
        "purchase": 0.10,
        "refund": 0.02,
        "inventory_update": 0.05,
        "user_login": 0.07,
        "product_review": 0.05,
    }

    def __init__(self, config: GeneratorConfig | None = None) -> None:
        self.config = config or GeneratorConfig()
        self.random = random.Random(self.config.seed)
        self.products = self._build_products()
        self.carts: dict[int, list[int]] = {}
        self.purchases: list[dict[str, Any]] = []
        self.sessions: dict[int, str] = {}

    def _build_products(self) -> dict[int, dict[str, Any]]:
        products: dict[int, dict[str, Any]] = {}
        for product_id in range(1, self.config.products + 1):
            category = self.random.choice(self.categories)
            price = round(math.exp(self.random.uniform(math.log(5), math.log(1_000))), 2)
            products[product_id] = {
                "product_id": product_id,
                "product_name": f"{category.title()} Product {product_id:04d}",
                "category": category,
                "price": price,
            }
        return products

    def _envelope(self, event_type: str, user_id: int | None = None) -> dict[str, Any]:
        event: dict[str, Any] = {
            "event_id": f"evt_{uuid.UUID(int=self.random.getrandbits(128)).hex}",
            "event_type": event_type,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        if user_id is not None:
            event.update(
                {
                    "user_id": user_id,
                    "session_id": self.sessions.setdefault(
                        user_id, f"ses_{uuid.UUID(int=self.random.getrandbits(128)).hex}"
                    ),
                    "country": self.random.choice(self.countries),
                    "device": self.random.choices(self.devices, weights=(0.62, 0.31, 0.07))[0],
                }
            )
        return event

    def _user(self) -> int:
        # A triangular distribution produces a useful mix of frequent and infrequent users.
        return max(1, int(self.random.triangular(1, self.config.users + 1, 1)))

    def _product(self) -> dict[str, Any]:
        return self.products[self.random.randint(1, self.config.products)]

    def _with_product(self, event: dict[str, Any], product_id: int | None = None) -> dict[str, Any]:
        product = self.products[product_id] if product_id else self._product()
        event.update(product)
        return event

    def make(self, event_type: str | None = None) -> dict[str, Any]:
        event_type = event_type or self.random.choices(
            tuple(self.event_weights), weights=tuple(self.event_weights.values())
        )[0]
        handler = getattr(self, f"_make_{event_type}", None)
        if handler is None:
            raise ValueError(f"unsupported event type: {event_type}")
        return handler()

    def _make_page_view(self) -> dict[str, Any]:
        event = self._envelope("page_view", self._user())
        event["page_url"] = self.random.choice(("/", "/deals", "/account", "/cart"))
        return event

    def _make_product_view(self) -> dict[str, Any]:
        return self._with_product(self._envelope("product_view", self._user()))

    def _make_search(self) -> dict[str, Any]:
        event = self._envelope("search", self._user())
        event["search_term"] = self.random.choice(self.search_terms)
        return event

    def _make_add_to_cart(self) -> dict[str, Any]:
        user_id = self._user()
        product = self._product()
        self.carts.setdefault(user_id, []).append(product["product_id"])
        event = self._with_product(self._envelope("add_to_cart", user_id), product["product_id"])
        event["quantity"] = self.random.choices((1, 2, 3), weights=(0.82, 0.14, 0.04))[0]
        return event

    def _make_remove_from_cart(self) -> dict[str, Any]:
        candidates = [user_id for user_id, cart in self.carts.items() if cart]
        user_id = self.random.choice(candidates) if candidates else self._user()
        product_id = (
            self.carts[user_id].pop()
            if self.carts.get(user_id)
            else self._product()["product_id"]
        )
        return self._with_product(self._envelope("remove_from_cart", user_id), product_id)

    def _make_purchase(self) -> dict[str, Any]:
        candidates = [user_id for user_id, cart in self.carts.items() if cart]
        user_id = self.random.choice(candidates) if candidates else self._user()
        product_id = (
            self.carts[user_id].pop()
            if self.carts.get(user_id)
            else self._product()["product_id"]
        )
        quantity = self.random.choices((1, 2, 3), weights=(0.86, 0.11, 0.03))[0]
        event = self._with_product(self._envelope("purchase", user_id), product_id)
        event.update(
            {
                "order_id": f"ord_{uuid.UUID(int=self.random.getrandbits(128)).hex}",
                "quantity": quantity,
                "payment_method": self.random.choices(
                    self.payment_methods, weights=(0.64, 0.23, 0.13)
                )[0],
                "order_status": "completed",
            }
        )
        self.purchases.append(event.copy())
        return event

    def _make_refund(self) -> dict[str, Any]:
        if not self.purchases:
            self._make_purchase()
        purchase = self.purchases.pop(self.random.randrange(len(self.purchases)))
        event = self._with_product(
            self._envelope("refund", int(purchase["user_id"])), int(purchase["product_id"])
        )
        event.update(
            {
                "order_id": purchase["order_id"],
                "refund_id": f"ref_{uuid.UUID(int=self.random.getrandbits(128)).hex}",
                "quantity": purchase["quantity"],
                "refund_reason": self.random.choice(
                    ("changed_mind", "damaged", "incorrect_item", "late_delivery")
                ),
            }
        )
        return event

    def _make_inventory_update(self) -> dict[str, Any]:
        event = self._with_product(self._envelope("inventory_update"))
        event.update(
            {
                "warehouse_id": f"wh_{self.random.randint(1, 8):02d}",
                "inventory_quantity": self.random.randint(0, 500),
                "inventory_delta": self.random.randint(-20, 50),
            }
        )
        return event

    def _make_user_login(self) -> dict[str, Any]:
        user_id = self._user()
        if self.random.random() < 0.15:
            self.sessions[user_id] = f"ses_{uuid.UUID(int=self.random.getrandbits(128)).hex}"
        event = self._envelope("user_login", user_id)
        event["login_method"] = self.random.choice(("password", "google", "apple"))
        return event

    def _make_product_review(self) -> dict[str, Any]:
        event = self._with_product(self._envelope("product_review", self._user()))
        event.update(
            {
                "review_id": f"rev_{uuid.UUID(int=self.random.getrandbits(128)).hex}",
                "rating": self.random.choices((1, 2, 3, 4, 5), weights=(2, 4, 12, 34, 48))[0],
            }
        )
        return event
