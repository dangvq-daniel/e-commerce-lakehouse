SELECT
    EXTRACT(HOUR FROM event_timestamp)::integer AS hour_of_day,
    COUNT(*) AS events,
    COUNT(*) FILTER (WHERE event_type = 'purchase') AS purchases
FROM staging.stg_events
WHERE event_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1;

