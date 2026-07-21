SELECT COUNT(DISTINCT order_id) AS orders_today
FROM gold.fact_orders
WHERE order_date = CURRENT_DATE;

