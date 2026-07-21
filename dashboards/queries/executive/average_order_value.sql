SELECT COALESCE(AVG(order_total), 0) AS average_order_value
FROM (
    SELECT order_id, SUM(gross_amount) AS order_total
    FROM gold.fact_orders
    WHERE order_date = CURRENT_DATE
    GROUP BY order_id
) orders;

