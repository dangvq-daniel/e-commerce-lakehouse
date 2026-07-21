# Event data contract

All timestamps are ISO-8601 UTC values. IDs are strings except `user_id` and
`product_id`, which are positive integers. Producers may add fields; consumers must
ignore fields they do not recognize.

## Common envelope

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event_id` | string | yes | Globally unique idempotency key |
| `event_type` | string | yes | One of the ten supported event types |
| `timestamp` | string | yes | Event creation time in UTC |
| `user_id` | integer | customer events | Stable customer identifier |
| `session_id` | string | customer events | Current browsing session |
| `country` | string | customer events | Simulated customer country |
| `device` | string | customer events | `mobile`, `desktop`, or `tablet` |

## Topic routing and fields

| Topic | Event type | Important type-specific fields |
|---|---|---|
| `customer_events` | `page_view` | `page_url` |
| `customer_events` | `product_view` | product fields |
| `customer_events` | `search` | `search_term` |
| `customer_events` | `add_to_cart` | product fields, `quantity` |
| `customer_events` | `remove_from_cart` | product fields |
| `customer_events` | `user_login` | `login_method` |
| `purchase_events` | `purchase` | `order_id`, product fields, `quantity`, `payment_method`, `order_status` |
| `refund_events` | `refund` | `refund_id`, `order_id`, product fields, `quantity`, `refund_reason` |
| `inventory_events` | `inventory_update` | product fields, `warehouse_id`, `inventory_quantity`, `inventory_delta` |
| `product_events` | `product_review` | product fields, `review_id`, `rating` |

Product fields are `product_id`, `product_name`, `category`, and `price`. A refund
references a prior generated purchase. Purchases and refunds require a positive price
and quantity. Inventory quantity can be zero; inventory delta can be negative.

## Compatibility policy

- Adding an optional field is backward-compatible.
- Removing or changing a field type requires a new contract version and coordinated
  consumer rollout.
- Reusing an `event_id` for different content is forbidden.
- Unknown event types are rejected by the producer contract and quarantined by Silver.
- Consumers use Kafka topic/partition/offset as transport lineage, not as a business key.

