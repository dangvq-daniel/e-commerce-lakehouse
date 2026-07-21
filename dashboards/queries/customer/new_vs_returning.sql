SELECT
    CASE WHEN first_seen_at::date = CURRENT_DATE THEN 'New' ELSE 'Returning' END AS customer_type,
    COUNT(*) AS customers
FROM gold.dim_customer
WHERE last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY 1;

