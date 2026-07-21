select
    {{ stable_hash('country') }} as country_key,
    country,
    count(*) as observed_events
from {{ ref('stg_events') }}
where country is not null
group by country
