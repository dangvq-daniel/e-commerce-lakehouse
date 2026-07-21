select
    {{ stable_hash('product_id') }} as product_key,
    product_id,
    product_name,
    category,
    current_price,
    first_seen_at,
    last_seen_at
from {{ ref('stg_products') }}
