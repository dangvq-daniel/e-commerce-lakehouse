select
    event_id as refund_event_id,
    refund_id,
    order_id,
    customer_id,
    product_id,
    event_timestamp as refunded_at,
    quantity,
    price as unit_price,
    round(quantity * price, 2) as refund_amount,
    refund_reason
from {% if target.type == 'databricks' %}{{ source('silver', 'refunds') }}{% else %}{{ ref('stg_events') }}{% endif %}
{% if target.type != 'databricks' %}
where event_type = 'refund'
{% endif %}
