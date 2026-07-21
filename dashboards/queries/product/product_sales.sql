SELECT p.product_name, p.category, SUM(s.quantity) AS units_sold, SUM(s.net_revenue) AS revenue
FROM gold.fact_sales s
JOIN gold.dim_product p USING (product_key)
GROUP BY p.product_name, p.category
ORDER BY revenue DESC
LIMIT 100;

