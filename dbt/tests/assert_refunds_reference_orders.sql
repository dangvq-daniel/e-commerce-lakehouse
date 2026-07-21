select r.refund_event_id
from {{ ref('stg_refunds') }} r
left join {{ ref('stg_orders') }} o using (order_id)
where o.order_id is null

