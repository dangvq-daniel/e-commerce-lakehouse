# Cloud migration plan

The application contract, dbt semantic layer, tests, and dashboard SQL remain portable.
Infrastructure identity, networking, storage paths, cluster policy, and BI provisioning
are environment-specific and should be delivered through IaC.

## Budget recruiter deployment

The public portfolio surface uses Render plus Supabase without redefining the canonical
production architecture. A single free Render web service runs the dashboard and resumes
a low-rate synthetic producer on every process wake. The producer claims a PostgreSQL
lease, creates the schema idempotently, and tops up a small historical baseline without
truncating existing data. It appends events while the web service remains active.
Supabase PostgreSQL preserves those events across Render spin-downs and deploys.
The public producer writes at most once per minute, rotates history after 35 days or
50,000 rows, and stops writing if total database size reaches 200 MB.

This deployment is a live compatibility demonstration, not a claim that the full Kafka,
Databricks, Delta, Airflow, dbt, and Metabase stack can run continuously for $5/month.
The production path remains the diagram in `docs/architecture.md`.

Operational caveats:

- Render free web services sleep after idle time and may take about a minute to wake.
- Render filesystems are ephemeral, so runtime state belongs in PostgreSQL.
- Supabase free projects can pause after a quiet week and can be resumed from its dashboard.
- Render should use Supabase's IPv4-compatible session pooler connection string.
- The dashboard exposes database usage against Supabase's 500 MB free database limit;
  the 200 MB write guard retains headroom for indexes and platform metadata.

## AWS target

| Local/reference component | AWS production service | Migration work |
|---|---|---|
| Kafka | Amazon MSK | Multi-AZ brokers, TLS/SASL IAM, private subnets, schema registry |
| Databricks | Databricks on AWS | PrivateLink, service principal, cluster policies, Unity Catalog |
| Delta storage | S3 + Delta Lake | Separate external locations, KMS encryption, lifecycle and object lock policies |
| Airflow | Amazon MWAA | VPC routes to MSK/Databricks, Secrets Manager backend, remote logs |
| dbt Core | Airflow-managed dbt Core or dbt Cloud | Build and test Delta Gold from Unity Catalog Silver |
| PostgreSQL | Amazon Redshift Serverless | Publish curated Delta Gold through COPY/sharing; never transform Bronze directly |
| Metabase | Amazon QuickSight | Recreate semantic datasets, SPICE refreshes, row-level security, alerts |

Recommended sequence: establish accounts/networking and identities; create MSK and S3
external locations; deploy Unity Catalog and Databricks jobs; dual-publish synthetic
events; validate Bronze/Silver; enable dbt Delta Gold; validate warehouse publication and dashboards; then cut over.

## Azure target

| Local/reference component | Azure production service | Migration work |
|---|---|---|
| Kafka | Event Hubs Kafka endpoint | Kafka protocol settings, throughput units, capture, private endpoints |
| Databricks | Azure Databricks | VNet injection, managed identity, cluster policies, Unity Catalog |
| Delta storage | ADLS Gen2 + Delta Lake | Managed identity ACLs, external locations, lifecycle and immutability |
| Airflow | Managed Airflow or Data Factory | Managed identity, private DNS, Key Vault, monitoring integration |
| dbt Core | Airflow-managed dbt Core or dbt Cloud | Build and test Delta Gold from Unity Catalog Silver |
| PostgreSQL | Synapse SQL | Publish curated Delta Gold with deliberate distribution and partition choices |
| Metabase | Power BI | Certified semantic model, incremental refresh, RLS, deployment pipelines |

## Production controls common to both

- Terraform/Bicep/CloudFormation owns resources; Asset Bundles own Databricks code/jobs.
- Workload identity replaces tokens where supported; secrets live in the cloud secret
  manager and are referenced, never copied into source or Airflow variables as plaintext.
- Separate development, staging, and production accounts/subscriptions and catalogs.
- Blue/green consumer groups and independent checkpoints allow a schema migration to be
  validated before switching downstream readers.
- Centralize logs, metrics, lineage, audit trails, cost tags, and data-quality results.
- Define retention by layer: short Kafka buffer, governed long-lived Bronze, optimized
  Silver, and rebuildable Gold.
- Add PII classification, masking, deletion workflows, least-privilege grants, and a
  documented recovery-time/recovery-point objective before real customer data arrives.
