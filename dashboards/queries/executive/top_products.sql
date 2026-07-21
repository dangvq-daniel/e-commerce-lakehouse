SELECT p.product_name, p.category, SUM(s.quantity) AS units, SUM(s.net_revenue) AS net_revenue
FROM gold.fact_sales s
JOIN gold.dim_product p USING (product_key)
GROUP BY p.product_name, p.category
ORDER BY net_revenue DESC
LIMIT 20;

