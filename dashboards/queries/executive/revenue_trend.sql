SELECT
    sale_date,
    SUM(net_revenue) AS net_revenue,
    SUM(gross_revenue) AS gross_revenue
FROM gold.fact_sales
WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sale_date
ORDER BY sale_date;

