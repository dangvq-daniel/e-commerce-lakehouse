select
    customer_id,
    min(event_timestamp) as first_seen_at,
    max(event_timestamp) as last_seen_at,
    {% if target.type == 'databricks' %}
    max_by(country, event_timestamp) as country,
    max_by(device, event_timestamp) as preferred_device
    {% else %}
    (array_agg(country order by event_timestamp desc) filter (where country is not null))[1] as country,
    (array_agg(device order by event_timestamp desc) filter (where device is not null))[1] as preferred_device
    {% endif %}
from {% if target.type == 'databricks' %}{{ source('silver', 'customer_activity') }}{% else %}{{ ref('stg_events') }}{% endif %}
where customer_id is not null
group by customer_id
