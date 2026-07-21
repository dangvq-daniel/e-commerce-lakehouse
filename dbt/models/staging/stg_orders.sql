select
    event_id as order_line_id,
    order_id,
    customer_id,
    product_id,
    event_timestamp as ordered_at,
    quantity,
    price as unit_price,
    round(quantity * price, 2) as gross_amount,
    payment_method,
    coalesce(order_status, 'completed') as order_status,
    country,
    device
from {% if target.type == 'databricks' %}{{ source('silver', 'orders') }}{% else %}{{ ref('stg_events') }}{% endif %}
{% if target.type != 'databricks' %}
where event_type = 'purchase'
{% endif %}
