select
    event_id as inventory_event_id,
    product_id,
    warehouse_id,
    event_timestamp,
    inventory_quantity,
    inventory_delta
from {% if target.type == 'databricks' %}{{ source('silver', 'inventory') }}{% else %}{{ ref('stg_events') }}{% endif %}
{% if target.type != 'databricks' %}
where event_type = 'inventory_update'
{% endif %}
