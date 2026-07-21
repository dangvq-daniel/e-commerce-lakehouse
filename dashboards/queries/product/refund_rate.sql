SELECT
    COALESCE(100.0 * SUM(refunded_amount) / NULLIF(SUM(gross_revenue), 0), 0) AS refund_rate_pct
FROM gold.fact_sales;

