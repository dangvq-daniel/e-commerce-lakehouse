select
    cast(o.ordered_at as date) as order_date,
    p.category,
    o.product_id,
    count(distinct o.order_id) as orders,
    sum(o.quantity) as units_sold,
    sum(o.gross_amount) as gross_revenue,
    avg(o.gross_amount) as average_order_line_value
from {{ ref('stg_orders') }} o
left join {{ ref('stg_products') }} p using (product_id)
group by 1, 2, 3
