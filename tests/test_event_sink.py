import json

import pytest

from warehouse.event_sink import parse_event


def test_parse_event_decodes_valid_payload() -> None:
    payload = json.dumps(
        {"event_id": "evt_1", "event_type": "page_view", "timestamp": "2026-01-01T00:00:00Z"}
    ).encode()
    assert parse_event(payload)["event_id"] == "evt_1"


def test_parse_event_rejects_incomplete_payload() -> None:
    with pytest.raises(ValueError, match="event_type"):
        parse_event(b'{"event_id":"evt_1","timestamp":"now"}')

