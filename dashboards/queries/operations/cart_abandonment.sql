SELECT
    COALESCE(
        100.0 * COUNT(*) FILTER (WHERE cart_additions > 0 AND purchases = 0)
        / NULLIF(COUNT(*) FILTER (WHERE cart_additions > 0), 0),
        0
    ) AS cart_abandonment_rate_pct
FROM gold.fact_sessions;

