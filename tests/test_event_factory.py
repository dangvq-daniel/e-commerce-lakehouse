from generator.contracts import EVENT_TYPES, topic_for
from generator.events import EventFactory, GeneratorConfig


def test_factory_emits_every_supported_event_type() -> None:
    factory = EventFactory(GeneratorConfig(users=20, products=10, seed=7))
    for event_type in EVENT_TYPES:
        event = factory.make(event_type)
        assert event["event_type"] == event_type
        assert event["event_id"].startswith("evt_")
        assert topic_for(event)


def test_seed_produces_repeatable_catalog() -> None:
    first = EventFactory(GeneratorConfig(products=10, seed=99))
    second = EventFactory(GeneratorConfig(products=10, seed=99))
    assert first.products == second.products


def test_purchase_has_positive_value_and_valid_payment_method() -> None:
    factory = EventFactory(GeneratorConfig(seed=3))
    purchase = factory.make("purchase")
    assert purchase["price"] > 0
    assert purchase["quantity"] > 0
    assert purchase["payment_method"] in factory.payment_methods


def test_refund_references_an_existing_purchase() -> None:
    factory = EventFactory(GeneratorConfig(seed=3))
    purchase = factory.make("purchase")
    refund = factory.make("refund")
    assert refund["order_id"] == purchase["order_id"]
    assert refund["product_id"] == purchase["product_id"]

