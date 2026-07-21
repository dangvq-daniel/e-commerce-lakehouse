select
    {{ stable_hash('customer_id') }} as customer_key,
    customer_id,
    first_seen_at,
    last_seen_at,
    country,
    preferred_device,
    lifetime_orders,
    lifetime_gross_revenue,
    lifetime_sessions,
    first_order_at,
    latest_order_at
from {{ ref('customer_metrics') }}
