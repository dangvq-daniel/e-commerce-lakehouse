select
    i.inventory_event_id as inventory_event_key,
    p.product_key,
    i.product_id,
    i.warehouse_id,
    i.event_timestamp,
    i.inventory_quantity,
    i.inventory_delta
from {{ ref('stg_inventory') }} i
inner join {{ ref('dim_product') }} p using (product_id)

