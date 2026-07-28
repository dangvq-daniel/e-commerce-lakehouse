export type TechnologyId =
  | "simulator"
  | "kafka"
  | "compute"
  | "bronze"
  | "silver"
  | "dbt"
  | "gold"
  | "postgres"
  | "metabase"
  | "airflow";

export type BrandId =
  | "python"
  | "kafka"
  | "spark"
  | "databricks"
  | "delta"
  | "dbt"
  | "postgres"
  | "metabase"
  | "airflow"
  | "supabase"
  | "render";

export type TechnologyEvidence = {
  id: TechnologyId;
  name: string;
  subtitle: string;
  brands: BrandId[];
  plane: "data" | "control";
  status: string;
  role: string;
  why: string;
  input: string;
  output: string;
  metrics: { label: string; value: string }[];
  artifactLabel: string;
  artifactPath: string;
  sourceHref: string;
  codeLanguage: string;
  code: string;
};

const repo = "https://github.com/dangvq-daniel/e-commerce-lakehouse/blob/main";

export const technologyEvidence: TechnologyEvidence[] = [
  {
    id: "simulator",
    name: "Python simulator",
    subtitle: "Behavior-driven event producer",
    brands: ["python"],
    plane: "data",
    status: "Implemented",
    role: "Produces related customer, session, order, refund, product, and inventory events.",
    why: "A stateful producer creates realistic joins and lifecycle behavior instead of isolated random rows.",
    input: "Seeded customer and product state",
    output: "Ten versioned event types",
    metrics: [
      { label: "Event types", value: "10" },
      { label: "Customers", value: "2,000" },
      { label: "Products", value: "400" },
    ],
    artifactLabel: "Producer implementation",
    artifactPath: "generator/events.py",
    sourceHref: `${repo}/generator/events.py`,
    codeLanguage: "python",
    code: `event = factory.make(event_type)
producer.send(
    TOPIC_BY_EVENT[event["event_type"]],
    key=event["event_id"].encode(),
    value=event,
)`,
  },
  {
    id: "kafka",
    name: "Apache Kafka",
    subtitle: "Five partitioned event streams",
    brands: ["kafka"],
    plane: "data",
    status: "Verified locally",
    role: "Buffers domain events and decouples the simulator from downstream processing.",
    why: "Durable offsets make bounded processing and controlled replay possible without modifying source history.",
    input: "JSON events keyed by event_id",
    output: "Ordered records with topic, partition, and offset",
    metrics: [
      { label: "Topics", value: "5 active" },
      { label: "Partitions", value: "15 total" },
      { label: "Producer rate", value: "5 events/s" },
    ],
    artifactLabel: "Topic bootstrap",
    artifactPath: "kafka/topics/create-topics.sh",
    sourceHref: `${repo}/kafka/topics/create-topics.sh`,
    codeLanguage: "shell",
    code: `purchase event
  → purchase_events
  → partition 0..2
  → PySpark Bronze consumer`,
  },
  {
    id: "compute",
    name: "PySpark compute",
    subtitle: "Local Spark verified · Databricks packaged",
    brands: ["spark", "databricks"],
    plane: "data",
    status: "Verified locally",
    role: "Runs checkpointed Structured Streaming ingestion and typed Silver transformations.",
    why: "Spark provides distributed stream processing; the same PySpark contracts can move to Databricks managed compute.",
    input: "Kafka records and Bronze Delta changes",
    output: "Bronze envelopes, Silver domains, quarantine",
    metrics: [
      { label: "Bronze input", value: "11,912 rows" },
      { label: "Silver output", value: "9,060 rows" },
      { label: "Validation yield", value: "76.1%" },
    ],
    artifactLabel: "Silver streaming job",
    artifactPath: "spark/jobs/silver_transform.py",
    sourceHref: `${repo}/spark/jobs/silver_transform.py`,
    codeLanguage: "python",
    code: `bronze = spark.readStream.format("delta").load(BRONZE_PATH)
(
  bronze.writeStream
    .foreachBatch(transform_batch)
    .option("checkpointLocation", SILVER_CHECKPOINT)
    .trigger(availableNow=True)
    .start()
)`,
  },
  {
    id: "bronze",
    name: "Delta Bronze",
    subtitle: "Immutable source history",
    brands: ["delta"],
    plane: "data",
    status: "Verified locally",
    role: "Preserves the original payload together with Kafka coordinates and ingestion timestamps.",
    why: "Raw history supports audit, debugging, schema evolution, and replay into corrected downstream logic.",
    input: "Kafka key, payload, timestamp, partition, offset",
    output: "Replayable Delta event envelopes",
    metrics: [
      { label: "Rows captured", value: "11,912" },
      { label: "Write mode", value: "Append" },
      { label: "Recovery", value: "Checkpointed" },
    ],
    artifactLabel: "Bronze ingestion",
    artifactPath: "spark/jobs/bronze_ingestion.py",
    sourceHref: `${repo}/spark/jobs/bronze_ingestion.py`,
    codeLanguage: "python",
    code: `envelopes.writeStream
  .format("delta")
  .outputMode("append")
  .option("checkpointLocation", "/lakehouse/checkpoints/bronze")
  .option("path", "/lakehouse/bronze/events")`,
  },
  {
    id: "silver",
    name: "Delta Silver",
    subtitle: "Validated domain data",
    brands: ["delta"],
    plane: "data",
    status: "Verified locally",
    role: "Parses schemas, normalizes values, rejects invalid records, and deduplicates by event_id.",
    why: "A trusted boundary prevents malformed events and duplicate delivery from corrupting business metrics.",
    input: "Bronze raw_payload",
    output: "events, orders, refunds, customers, products, inventory",
    metrics: [
      { label: "Valid events", value: "9,060" },
      { label: "Domain tables", value: "6" },
      { label: "Deduplication", value: "event_id" },
    ],
    artifactLabel: "Validation rules",
    artifactPath: "spark/jobs/silver_transform.py",
    sourceHref: `${repo}/spark/jobs/silver_transform.py`,
    codeLanguage: "python",
    code: `valid = classified
  .filter(col("_invalid_reason").isNull())
  .dropDuplicates(["event_id"])

merge_insert_only(valid, SILVER_EVENTS, "event_id")`,
  },
  {
    id: "dbt",
    name: "dbt",
    subtitle: "Staging → intermediate → marts",
    brands: ["dbt"],
    plane: "data",
    status: "Verified locally",
    role: "Defines documented business transformations, model lineage, and data-quality assertions.",
    why: "Analytics logic becomes modular, reviewable, tested, and independent from ingestion code.",
    input: "Typed Silver domain tables",
    output: "Four dimensions and four facts",
    metrics: [
      { label: "Models", value: "17" },
      { label: "Tests", value: "37 / 37" },
      { label: "Gold models", value: "8" },
    ],
    artifactLabel: "Sales fact model",
    artifactPath: "dbt/models/marts/fact_sales.sql",
    sourceHref: `${repo}/dbt/models/marts/fact_sales.sql`,
    codeLanguage: "sql",
    code: `select
  o.order_line_id as sale_key,
  c.customer_key,
  p.product_key,
  o.gross_amount - coalesce(r.refunded_amount, 0) as net_revenue
from {{ ref('stg_orders') }} o
join {{ ref('dim_customer') }} c using (customer_id)`,
  },
  {
    id: "gold",
    name: "Delta Gold",
    subtitle: "Analytics-ready facts and dimensions",
    brands: ["delta"],
    plane: "data",
    status: "Verified locally",
    role: "Materializes stable business grains for sales, orders, sessions, inventory, customers, products, dates, and countries.",
    why: "Explicit grains and surrogate keys let BI users answer questions without rebuilding transformation logic.",
    input: "dbt staging and intermediate models",
    output: "8 keyed Delta tables",
    metrics: [
      { label: "Sales rows", value: "928" },
      { label: "Facts", value: "4" },
      { label: "Dimensions", value: "4" },
    ],
    artifactLabel: "Delta merge materialization",
    artifactPath: "dbt/macros/materializations/delta_merge.sql",
    sourceHref: `${repo}/dbt/macros/materializations/delta_merge.sql`,
    codeLanguage: "sql",
    code: `merge into {{ target_relation }} as target
using {{ temp_relation }} as source
  on source.{{ unique_key }} = target.{{ unique_key }}
when matched then update set *
when not matched then insert *`,
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    subtitle: "Serving warehouse",
    brands: ["postgres"],
    plane: "data",
    status: "Verified locally",
    role: "Publishes a query-friendly copy of Gold for dashboards and downstream consumers.",
    why: "The BI workload is isolated from streaming compute while retaining familiar SQL access.",
    input: "Eight Delta Gold tables over Spark JDBC",
    output: "gold schema in PostgreSQL",
    metrics: [
      { label: "Published tables", value: "8" },
      { label: "Sales rows", value: "928" },
      { label: "Load strategy", value: "Transactional swap" },
    ],
    artifactLabel: "Gold publisher",
    artifactPath: "spark/jobs/publish_gold.py",
    sourceHref: `${repo}/spark/jobs/publish_gold.py`,
    codeLanguage: "python",
    code: `spark.table(f"gold.{table_name}")
  .write.format("jdbc")
  .option("url", POSTGRES_JDBC_URL)
  .option("dbtable", f"gold.{table_name}")
  .mode("overwrite")
  .save()`,
  },
  {
    id: "metabase",
    name: "Metabase",
    subtitle: "Business intelligence",
    brands: ["metabase"],
    plane: "data",
    status: "Verified locally",
    role: "Turns governed warehouse tables into decision-focused dashboards and saved questions.",
    why: "Executives and operating teams consume consistent metrics without needing access to Spark or Delta.",
    input: "PostgreSQL gold schema",
    output: "Executive, Customer, Product, Operations dashboards",
    metrics: [
      { label: "Dashboards", value: "4" },
      { label: "Questions", value: "17" },
      { label: "Provisioning", value: "Idempotent API" },
    ],
    artifactLabel: "Dashboard manifest",
    artifactPath: "dashboards/dashboard_manifest.yml",
    sourceHref: `${repo}/dashboards/dashboard_manifest.yml`,
    codeLanguage: "yaml",
    code: `- name: Executive Dashboard
  cards:
    - Revenue Today
    - Orders Today
    - Revenue Trend
    - Top Categories
    - Top Products`,
  },
  {
    id: "airflow",
    name: "Apache Airflow",
    subtitle: "Control plane",
    brands: ["airflow"],
    plane: "control",
    status: "Last run succeeded",
    role: "Coordinates availability checks, Spark jobs, dbt, quality gates, publication, audit, and dashboard refresh.",
    why: "Operational dependencies, retries, schedules, and execution history stay separate from the data path.",
    input: "Schedule plus service health",
    output: "Observable, retryable pipeline runs",
    metrics: [
      { label: "Tasks", value: "12" },
      { label: "Last run", value: "Success" },
      { label: "Run time", value: "2m 25s" },
    ],
    artifactLabel: "Pipeline DAG",
    artifactPath: "airflow/dags/ecommerce_pipeline_dag.py",
    sourceHref: `${repo}/airflow/dags/ecommerce_pipeline_dag.py`,
    codeLanguage: "python",
    code: `kafka_available
  >> bronze
  >> silver
  >> source_freshness
  >> dbt_models
  >> dbt_tests
  >> publish_warehouse
  >> dashboard`,
  },
];

export const dataEdges: [TechnologyId, TechnologyId][] = [
  ["simulator", "kafka"],
  ["kafka", "compute"],
  ["compute", "bronze"],
  ["bronze", "silver"],
  ["silver", "dbt"],
  ["dbt", "gold"],
  ["gold", "postgres"],
  ["postgres", "metabase"],
];

export const controlEdges: [TechnologyId, TechnologyId][] = [
  ["airflow", "compute"],
  ["airflow", "dbt"],
  ["airflow", "postgres"],
  ["airflow", "metabase"],
];

export const journeyStages = [
  {
    id: "produce",
    step: "01",
    label: "Order placed",
    technology: "Python",
    brand: "python" as BrandId,
    explanation: "A simulated mobile shopper in Germany completes an electronics purchase.",
    proof: "Stateful producer created event evt_23b020…",
    record: `{
  "event_type": "purchase",
  "order_id": "ord_cc83d8...",
  "customer_id": 757,
  "product_id": 153,
  "price": 7.37,
  "quantity": 1
}`,
  },
  {
    id: "publish",
    step: "02",
    label: "Event published",
    technology: "Kafka",
    brand: "kafka" as BrandId,
    explanation: "The producer routes the keyed event to purchase_events, one of five three-partition topics.",
    proof: "Producer → purchase_events → Spark Bronze consumer",
    record: `topic: purchase_events
key: evt_23b020fa...
partitions: 3
configured rate: 5 events/s`,
  },
  {
    id: "bronze",
    step: "03",
    label: "Raw history saved",
    technology: "Delta Bronze",
    brand: "delta" as BrandId,
    explanation: "Structured Streaming appends the untouched JSON plus Kafka lineage and ingestion time.",
    proof: "11,912 immutable envelopes captured",
    record: `{
  "topic": "purchase_events",
  "partition_id": 1,
  "kafka_offset": 284,
  "raw_payload": "{\\"event_id\\":\\"evt_23b020...\\"}",
  "_ingestion_time": "2026-07-28T02:15:05Z"
}`,
  },
  {
    id: "silver",
    step: "04",
    label: "Order validated",
    technology: "Delta Silver",
    brand: "delta" as BrandId,
    explanation: "The event is typed, normalized, checked, and merged once by event_id.",
    proof: "9,060 valid events · 76.1% validation yield",
    record: `{
  "event_id": "evt_23b020...",
  "order_id": "ord_cc83d8...",
  "customer_id": 757,
  "product_id": 153,
  "price": 7.37,
  "order_status": "completed"
}`,
  },
  {
    id: "model",
    step: "05",
    label: "Business fact built",
    technology: "dbt + Delta Gold",
    brand: "dbt" as BrandId,
    explanation: "dbt resolves customer and product keys, then calculates gross, refunded, and net revenue.",
    proof: "fact_sales · 17 models · 37/37 tests",
    record: `{
  "sale_key": "evt_23b020...",
  "gross_revenue": 7.37,
  "refunded_amount": 0.00,
  "net_revenue": 7.37
}`,
  },
  {
    id: "serve",
    step: "06",
    label: "Warehouse published",
    technology: "PostgreSQL",
    brand: "postgres" as BrandId,
    explanation: "The Gold model is published into a serving schema built for familiar, low-latency SQL.",
    proof: "8 tables · 928 fact_sales rows",
    record: `select order_id, net_revenue
from gold.fact_sales
where sale_key = 'evt_23b020...';

→ ord_cc83d8... | 7.37`,
  },
  {
    id: "decide",
    step: "07",
    label: "Decision updated",
    technology: "Metabase",
    brand: "metabase" as BrandId,
    explanation: "The same curated fact contributes to revenue, order, category, product, and customer views.",
    proof: "17 questions across 4 dashboards",
    record: `Executive dashboard
Net revenue      +$7.37
Completed orders +1
Category         Electronics
Country          Germany`,
  },
];
