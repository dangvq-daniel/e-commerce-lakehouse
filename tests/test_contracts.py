from datetime import UTC, datetime

import pytest

from generator.contracts import ContractError, topic_for


def test_topic_routing() -> None:
    event = {
        "event_id": "evt_1",
        "event_type": "product_view",
        "timestamp": datetime.now(UTC).isoformat(),
    }
    assert topic_for(event) == "customer_events"


def test_commerce_events_require_line_item_fields() -> None:
    event = {
        "event_id": "evt_1",
        "event_type": "purchase",
        "timestamp": datetime.now(UTC).isoformat(),
    }
    with pytest.raises(ContractError, match="user_id"):
        topic_for(event)


def test_unknown_event_type_is_rejected() -> None:
    with pytest.raises(ContractError, match="unsupported"):
        topic_for({"event_id": "1", "event_type": "mystery", "timestamp": "now"})

