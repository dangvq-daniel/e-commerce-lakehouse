SELECT COUNT(DISTINCT customer_id) AS active_users
FROM staging.stg_events
WHERE event_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

