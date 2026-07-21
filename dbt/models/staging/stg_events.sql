{% if target.type == 'databricks' %}

select
    event_id,
    event_type,
    event_timestamp,
    _ingestion_time as ingested_at,
    topic,
    partition_id,
    kafka_offset,
    user_id as customer_id,
    session_id,
    product_id,
    product_name,
    category,
    cast(price as decimal(14, 2)) as price,
    quantity,
    country,
    device,
    payment_method,
    order_id,
    order_status,
    refund_id,
    refund_reason,
    warehouse_id,
    inventory_quantity,
    inventory_delta,
    rating
from {{ source('silver', 'events') }}

{% else %}

select
    event_id,
    event_type,
    event_timestamp,
    ingested_at,
    topic,
    partition_id,
    kafka_offset,
    nullif(payload ->> 'user_id', '')::bigint as customer_id,
    nullif(payload ->> 'session_id', '') as session_id,
    nullif(payload ->> 'product_id', '')::bigint as product_id,
    nullif(payload ->> 'product_name', '') as product_name,
    lower(regexp_replace(trim(payload ->> 'category'), '[^a-zA-Z0-9]+', '_', 'g')) as category,
    nullif(payload ->> 'price', '')::numeric(14, 2) as price,
    nullif(payload ->> 'quantity', '')::integer as quantity,
    initcap(trim(payload ->> 'country')) as country,
    lower(nullif(payload ->> 'device', '')) as device,
    lower(nullif(payload ->> 'payment_method', '')) as payment_method,
    nullif(payload ->> 'order_id', '') as order_id,
    lower(nullif(payload ->> 'order_status', '')) as order_status,
    nullif(payload ->> 'refund_id', '') as refund_id,
    lower(nullif(payload ->> 'refund_reason', '')) as refund_reason,
    nullif(payload ->> 'warehouse_id', '') as warehouse_id,
    nullif(payload ->> 'inventory_quantity', '')::integer as inventory_quantity,
    nullif(payload ->> 'inventory_delta', '')::integer as inventory_delta,
    nullif(payload ->> 'rating', '')::integer as rating
from {{ source('raw', 'events') }}

{% endif %}
