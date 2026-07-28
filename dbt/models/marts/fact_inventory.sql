{{ config(
    materialized='delta_merge' if target.type == 'spark' else ('incremental' if target.type == 'databricks' else 'table'),
    file_format='delta',
    incremental_strategy='merge',
    unique_key='inventory_event_key'
) }}

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
