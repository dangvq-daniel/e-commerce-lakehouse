{% snapshot customer_snapshot %}

{{
    config(
      target_schema='snapshots',
      unique_key='customer_id',
      strategy='check',
      check_cols=['country', 'preferred_device']
    )
}}

select * from {{ ref('stg_customers') }}

{% endsnapshot %}

