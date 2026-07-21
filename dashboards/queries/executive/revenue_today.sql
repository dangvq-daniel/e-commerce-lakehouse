SELECT COALESCE(SUM(net_revenue), 0) AS revenue_today
FROM gold.fact_sales
WHERE sale_date = CURRENT_DATE;

