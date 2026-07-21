select
    product_id,
    {% if target.type == 'databricks' %}
    max_by(product_name, event_timestamp) as product_name,
    max_by(category, event_timestamp) as category,
    max_by(price, event_timestamp) as current_price,
    {% else %}
    (array_agg(product_name order by event_timestamp desc) filter (where product_name is not null))[1] as product_name,
    (array_agg(category order by event_timestamp desc) filter (where category is not null))[1] as category,
    (array_agg(price order by event_timestamp desc) filter (where price is not null))[1] as current_price,
    {% endif %}
    min(event_timestamp) as first_seen_at,
    max(event_timestamp) as last_seen_at
from {% if target.type == 'databricks' %}{{ source('silver', 'product_activity') }}{% else %}{{ ref('stg_events') }}{% endif %}
where product_id is not null
group by product_id
