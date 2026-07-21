SELECT
    p.product_name,
    i.warehouse_id,
    i.inventory_quantity,
    i.inventory_delta,
    i.event_timestamp
FROM gold.fact_inventory i
JOIN gold.dim_product p USING (product_key)
ORDER BY i.event_timestamp DESC
LIMIT 100;

