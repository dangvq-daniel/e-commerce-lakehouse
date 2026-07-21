#!/usr/bin/env bash
set -euo pipefail

for topic in customer_events purchase_events inventory_events refund_events product_events; do
  kafka-topics --bootstrap-server kafka:29092 \
    --create --if-not-exists --topic "$topic" --partitions 3 --replication-factor 1
done

kafka-topics --bootstrap-server kafka:29092 --list

