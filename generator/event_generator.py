"""CLI entrypoint that continuously publishes synthetic events to Kafka."""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import signal
import time
from collections.abc import Sequence

from generator.contracts import topic_for
from generator.events import EventFactory, GeneratorConfig
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

LOGGER = logging.getLogger("ecommerce.generator")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bootstrap-servers",
        default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
    )
    parser.add_argument("--rate", type=float, default=float(os.getenv("EVENT_RATE", "5")))
    parser.add_argument(
        "--jitter", type=float, default=float(os.getenv("EVENT_RATE_JITTER", "0.25"))
    )
    parser.add_argument("--users", type=int, default=int(os.getenv("EVENT_USERS", "2000")))
    parser.add_argument("--products", type=int, default=int(os.getenv("EVENT_PRODUCTS", "400")))
    parser.add_argument("--seed", type=int, default=int(os.getenv("EVENT_SEED", "42")))
    parser.add_argument("--max-events", type=int, default=0, help="0 means run continuously")
    return parser


def connect(bootstrap_servers: str, retries: int = 30) -> KafkaProducer:
    for attempt in range(1, retries + 1):
        try:
            return KafkaProducer(
                bootstrap_servers=bootstrap_servers.split(","),
                value_serializer=lambda value: json.dumps(value).encode("utf-8"),
                key_serializer=lambda value: value.encode("utf-8"),
                acks="all",
                retries=10,
                linger_ms=25,
            )
        except NoBrokersAvailable:
            if attempt == retries:
                raise
            LOGGER.info("Kafka is not ready (attempt %s/%s)", attempt, retries)
            time.sleep(min(attempt, 5))
    raise RuntimeError("unreachable")


def run(args: argparse.Namespace) -> int:
    if args.rate <= 0:
        raise ValueError("event rate must be greater than zero")
    factory = EventFactory(
        GeneratorConfig(users=args.users, products=args.products, seed=args.seed)
    )
    producer = connect(args.bootstrap_servers)
    stop = False

    def request_stop(_signum: int, _frame: object) -> None:
        nonlocal stop
        stop = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)

    sent = 0
    try:
        while not stop and (not args.max_events or sent < args.max_events):
            event = factory.make()
            topic = topic_for(event)
            producer.send(topic, key=event["event_id"], value=event)
            sent += 1
            if sent % 100 == 0:
                producer.flush()
                LOGGER.info("published %s events", sent)
            interval = 1 / args.rate
            time.sleep(max(0.001, interval * random.uniform(1 - args.jitter, 1 + args.jitter)))
    finally:
        producer.flush(timeout=10)
        producer.close(timeout=10)
    LOGGER.info("generator stopped after publishing %s events", sent)
    return sent


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(message)s")
    return run(build_parser().parse_args(argv))


if __name__ == "__main__":
    main()
