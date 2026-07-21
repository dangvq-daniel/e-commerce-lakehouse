SELECT
    p.product_name,
    COUNT(*) FILTER (WHERE e.event_type = 'product_view') AS product_views,
    COUNT(*) FILTER (WHERE e.event_type = 'purchase') AS purchases,
    COALESCE(
        100.0 * COUNT(*) FILTER (WHERE e.event_type = 'purchase')
        / NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'product_view'), 0),
        0
    ) AS conversion_rate_pct
FROM staging.stg_events e
JOIN gold.dim_product p USING (product_id)
GROUP BY p.product_name
ORDER BY conversion_rate_pct DESC
LIMIT 100;

