{{ config(
    materialized='delta_merge' if target.type == 'spark' else ('incremental' if target.type == 'databricks' else 'table'),
    file_format='delta',
    incremental_strategy='merge',
    unique_key='product_key'
) }}

select
    {{ stable_hash('product_id') }} as product_key,
    product_id,
    product_name,
    category,
    current_price,
    first_seen_at,
    last_seen_at
from {{ ref('stg_products') }}
