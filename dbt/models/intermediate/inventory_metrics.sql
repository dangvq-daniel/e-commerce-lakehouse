with ranked as (
    select
        *,
        row_number() over (
            partition by product_id, warehouse_id order by event_timestamp desc, inventory_event_id desc
        ) as recency_rank
    from {{ ref('stg_inventory') }}
)
select
    product_id,
    warehouse_id,
    event_timestamp as latest_update_at,
    inventory_quantity as current_quantity,
    inventory_delta as latest_delta,
    case
        when inventory_quantity = 0 then 'out_of_stock'
        when inventory_quantity < 20 then 'low_stock'
        else 'in_stock'
    end as stock_status
from ranked
where recency_rank = 1

