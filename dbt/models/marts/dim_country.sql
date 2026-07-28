{{ config(
    materialized='delta_merge' if target.type == 'spark' else ('incremental' if target.type == 'databricks' else 'table'),
    file_format='delta',
    incremental_strategy='merge',
    unique_key='country_key'
) }}

select
    {{ stable_hash('country') }} as country_key,
    country,
    count(*) as observed_events
from {{ ref('stg_events') }}
where country is not null
group by country
