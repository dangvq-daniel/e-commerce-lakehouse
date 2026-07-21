with refunds as (
    select order_id, sum(refund_amount) as refunded_amount
    from {{ ref('stg_refunds') }}
    group by order_id
)
select
    o.order_line_id as sale_key,
    o.order_id,
    c.customer_key,
    p.product_key,
    o.customer_id,
    o.product_id,
    o.ordered_at as sold_at,
    cast(o.ordered_at as date) as sale_date,
    o.quantity,
    o.unit_price,
    o.gross_amount as gross_revenue,
    cast(coalesce(r.refunded_amount, 0) as decimal(14, 2)) as refunded_amount,
    cast(o.gross_amount - coalesce(r.refunded_amount, 0) as decimal(14, 2)) as net_revenue,
    o.payment_method,
    o.country,
    o.device
from {{ ref('stg_orders') }} o
inner join {{ ref('dim_customer') }} c using (customer_id)
inner join {{ ref('dim_product') }} p using (product_id)
left join refunds r using (order_id)
