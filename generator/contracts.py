"""Event contract and Kafka routing shared by producer-side components."""

from __future__ import annotations

from collections.abc import Mapping

EVENT_TYPES = {
    "page_view",
    "product_view",
    "search",
    "add_to_cart",
    "remove_from_cart",
    "purchase",
    "refund",
    "inventory_update",
    "user_login",
    "product_review",
}

EVENT_TOPIC = {
    "page_view": "customer_events",
    "product_view": "customer_events",
    "search": "customer_events",
    "add_to_cart": "customer_events",
    "remove_from_cart": "customer_events",
    "user_login": "customer_events",
    "purchase": "purchase_events",
    "refund": "refund_events",
    "inventory_update": "inventory_events",
    "product_review": "product_events",
}

TOPICS = tuple(sorted(set(EVENT_TOPIC.values())))
REQUIRED_FIELDS = ("event_id", "event_type", "timestamp")


class ContractError(ValueError):
    """Raised when an event violates the producer contract."""


def topic_for(event: Mapping[str, object]) -> str:
    """Validate the common envelope and return its destination topic."""
    missing = [field for field in REQUIRED_FIELDS if not event.get(field)]
    if missing:
        raise ContractError(f"event is missing required fields: {', '.join(missing)}")

    event_type = str(event["event_type"])
    if event_type not in EVENT_TYPES:
        raise ContractError(f"unsupported event_type: {event_type}")

    if event_type in {"purchase", "refund"}:
        for field in ("user_id", "product_id", "price", "quantity"):
            if event.get(field) is None:
                raise ContractError(f"{event_type} event is missing {field}")

    return EVENT_TOPIC[event_type]

