select
    session_id,
    customer_id,
    min(event_timestamp) as started_at,
    max(event_timestamp) as ended_at,
    count(*) as event_count,
    count(*) filter (where event_type = 'product_view') as product_views,
    count(*) filter (where event_type = 'add_to_cart') as cart_additions,
    count(*) filter (where event_type = 'purchase') as purchases,
    max(country) as country,
    max(device) as device
from {{ ref('stg_events') }}
where session_id is not null
group by session_id, customer_id

