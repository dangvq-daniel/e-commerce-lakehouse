SELECT
    COALESCE(
        100.0 * COUNT(*) FILTER (WHERE lifetime_orders > 1) / NULLIF(COUNT(*) FILTER (WHERE lifetime_orders > 0), 0),
        0
    ) AS repeat_customer_rate_pct
FROM gold.dim_customer;

