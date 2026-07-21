SELECT customer_id, country, lifetime_orders, lifetime_gross_revenue
FROM gold.dim_customer
ORDER BY lifetime_gross_revenue DESC
LIMIT 100;

