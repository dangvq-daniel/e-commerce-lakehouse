select
    o.order_line_id as order_line_key,
    o.order_id,
    c.customer_key,
    p.product_key,
    o.customer_id,
    o.product_id,
    o.ordered_at,
    cast(o.ordered_at as date) as order_date,
    o.quantity,
    o.unit_price,
    o.gross_amount,
    o.payment_method,
    o.order_status,
    o.country,
    o.device
from {{ ref('stg_orders') }} o
inner join {{ ref('dim_customer') }} c using (customer_id)
inner join {{ ref('dim_product') }} p using (product_id)
