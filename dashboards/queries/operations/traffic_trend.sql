SELECT
    DATE_TRUNC('hour', event_timestamp) AS hour,
    COUNT(*) AS events,
    COUNT(DISTINCT session_id) AS sessions
FROM staging.stg_events
WHERE event_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1;

