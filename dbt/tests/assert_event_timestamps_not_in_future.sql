select event_id
from {{ ref('stg_events') }}
where event_timestamp > current_timestamp + interval '1 minute'

