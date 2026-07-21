with bounds as (
    select
        coalesce(cast(min(event_timestamp) as date), current_date) as min_date,
        coalesce(cast(max(event_timestamp) as date), current_date) as max_date
    from {{ ref('stg_events') }}
),
dates as (
    {% if target.type == 'databricks' %}
    select explode(sequence(min_date, max_date, interval 1 day)) as date_key
    from bounds
    {% else %}
    select generate_series(min_date, max_date, interval '1 day')::date as date_key
    from bounds
    {% endif %}
)
select
    date_key,
    cast(extract(year from date_key) as integer) as year,
    cast(extract(quarter from date_key) as integer) as quarter,
    cast(extract(month from date_key) as integer) as month,
    cast(extract(day from date_key) as integer) as day,
    {% if target.type == 'databricks' %}
    date_format(date_key, 'EEEE') as day_name,
    dayofweek(date_key) in (1, 7) as is_weekend
    {% else %}
    trim(to_char(date_key, 'Day')) as day_name,
    extract(isodow from date_key) in (6, 7) as is_weekend
    {% endif %}
from dates
