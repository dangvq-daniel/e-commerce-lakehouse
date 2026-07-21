with orders as (
    select
        customer_id,
        count(distinct order_id) as lifetime_orders,
        sum(gross_amount) as lifetime_gross_revenue,
        min(ordered_at) as first_order_at,
        max(ordered_at) as latest_order_at
    from {{ ref('stg_orders') }}
    group by customer_id
),
sessions as (
    select
        customer_id,
        count(distinct session_id) as lifetime_sessions,
        max(event_timestamp) as latest_activity_at
    from {{ ref('stg_events') }}
    where customer_id is not null
    group by customer_id
)
select
    c.customer_id,
    c.first_seen_at,
    c.last_seen_at,
    c.country,
    c.preferred_device,
    coalesce(o.lifetime_orders, 0) as lifetime_orders,
    coalesce(o.lifetime_gross_revenue, 0) as lifetime_gross_revenue,
    o.first_order_at,
    o.latest_order_at,
    coalesce(s.lifetime_sessions, 0) as lifetime_sessions,
    s.latest_activity_at
from {{ ref('stg_customers') }} c
left join orders o using (customer_id)
left join sessions s using (customer_id)

