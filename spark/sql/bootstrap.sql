CREATE DATABASE IF NOT EXISTS bronze LOCATION '/lakehouse/warehouse/bronze.db';
CREATE DATABASE IF NOT EXISTS silver LOCATION '/lakehouse/warehouse/silver.db';
CREATE DATABASE IF NOT EXISTS gold LOCATION '/lakehouse/warehouse/gold.db';
CREATE DATABASE IF NOT EXISTS staging LOCATION '/lakehouse/warehouse/staging.db';
CREATE DATABASE IF NOT EXISTS intermediate LOCATION '/lakehouse/warehouse/intermediate.db';
CREATE DATABASE IF NOT EXISTS snapshots LOCATION '/lakehouse/warehouse/snapshots.db';

CREATE TABLE IF NOT EXISTS bronze.events (
  topic STRING,
  partition_id INT,
  kafka_offset BIGINT,
  kafka_timestamp TIMESTAMP,
  message_key STRING,
  raw_payload STRING,
  _ingestion_time TIMESTAMP,
  _ingestion_date DATE
) USING DELTA LOCATION '/lakehouse/bronze/events';

CREATE TABLE IF NOT EXISTS silver.events (
  event_id STRING,
  event_type STRING,
  event_timestamp TIMESTAMP,
  _ingestion_time TIMESTAMP,
  topic STRING,
  partition_id INT,
  kafka_offset BIGINT,
  user_id BIGINT,
  session_id STRING,
  product_id BIGINT,
  product_name STRING,
  category STRING,
  price DOUBLE,
  quantity INT,
  country STRING,
  device STRING,
  payment_method STRING,
  order_id STRING,
  order_status STRING,
  refund_id STRING,
  refund_reason STRING,
  warehouse_id STRING,
  inventory_quantity INT,
  inventory_delta INT,
  rating INT
) USING DELTA LOCATION '/lakehouse/silver/events';

CREATE TABLE IF NOT EXISTS silver.orders (
  event_id STRING,
  order_id STRING,
  customer_id BIGINT,
  product_id BIGINT,
  event_timestamp TIMESTAMP,
  quantity INT,
  price DOUBLE,
  payment_method STRING,
  order_status STRING,
  country STRING,
  device STRING
) USING DELTA LOCATION '/lakehouse/silver/orders';

CREATE TABLE IF NOT EXISTS silver.refunds (
  event_id STRING,
  refund_id STRING,
  order_id STRING,
  customer_id BIGINT,
  product_id BIGINT,
  event_timestamp TIMESTAMP,
  quantity INT,
  price DOUBLE,
  refund_reason STRING
) USING DELTA LOCATION '/lakehouse/silver/refunds';

CREATE TABLE IF NOT EXISTS silver.customer_activity (
  event_id STRING,
  customer_id BIGINT,
  event_timestamp TIMESTAMP,
  country STRING,
  device STRING
) USING DELTA LOCATION '/lakehouse/silver/customer_activity';

CREATE TABLE IF NOT EXISTS silver.product_activity (
  event_id STRING,
  product_id BIGINT,
  product_name STRING,
  category STRING,
  price DOUBLE,
  event_timestamp TIMESTAMP
) USING DELTA LOCATION '/lakehouse/silver/product_activity';

CREATE TABLE IF NOT EXISTS silver.inventory (
  event_id STRING,
  product_id BIGINT,
  warehouse_id STRING,
  event_timestamp TIMESTAMP,
  inventory_quantity INT,
  inventory_delta INT
) USING DELTA LOCATION '/lakehouse/silver/inventory';

CREATE TABLE IF NOT EXISTS silver.quarantined_events (
  quarantine_id STRING,
  raw_payload STRING,
  topic STRING,
  partition_id INT,
  kafka_offset BIGINT,
  _ingestion_time TIMESTAMP,
  _invalid_reason STRING
) USING DELTA LOCATION '/lakehouse/silver/quarantined_events';
