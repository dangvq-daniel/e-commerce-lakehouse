select order_line_key
from {{ ref('fact_orders') }}
where unit_price <= 0 or quantity <= 0 or gross_amount <= 0

