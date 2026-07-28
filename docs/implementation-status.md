# Implementation status and résumé alignment

## Gap found

The repository contained substantial code for the advertised architecture, but the
previous local Compose path bypassed Spark and Delta:

`Kafka → Python compatibility sink → PostgreSQL → dbt-postgres → Metabase`

Databricks notebooks, dbt models, the Airflow DAG, and Metabase assets existed, but
that did not prove that the complete lakehouse path ran. The public Render demo also
cannot truthfully be described as running Kafka, Databricks, Delta Lake, dbt, Airflow,
or Metabase.

## Current evidence

| Capability | Local development | Public cloud demo |
|---|---|---|
| Python event simulator | Running in Compose | Running when Render is awake |
| Kafka, five topics | Running in Compose | Not deployed |
| PySpark Structured Streaming | Running in Compose | Not deployed |
| Delta Bronze/Silver/Gold | Running in Compose | Not deployed |
| dbt staging/intermediate/Gold | Running against Spark Thrift | Not deployed |
| Airflow orchestration | Available through the `orchestration` profile | Not deployed |
| PostgreSQL serving layer | Running in Compose | Supabase |
| Metabase, 17 questions/4 dashboards | Available through the `orchestration` profile | Replaced by the recruiter dashboard |
| Databricks | Asset Bundle and notebooks are deployable, not continuously hosted | Not deployed |

The local verification path processes generated Kafka records into replayable Delta
Bronze, typed and deduplicated Delta Silver, eight keyed Delta Gold models, and eight
PostgreSQL serving tables. dbt runs 17 models and 37 data tests.

## Résumé wording

Use wording that separates verified local execution from packaged managed-cloud
portability:

> Built a reproducible e-commerce lakehouse with Kafka, PySpark Structured Streaming,
> Delta Lake, dbt, Airflow, PostgreSQL, and Metabase, routing 10 event types across five
> topics into replayable Bronze and validated Silver datasets.
>
> Developed 17 dbt models and 37 quality tests that materialize four fact and four
> dimension tables in Delta Gold, then publish curated data to PostgreSQL for 17 BI
> questions across four dashboards.
>
> Packaged equivalent Databricks notebooks and Asset Bundle jobs while deploying a
> cost-capped Render/Supabase recruiter demo that preserves history without claiming
> the full lakehouse is continuously hosted.

Only change “packaged” to “deployed” after a Databricks workspace run is captured with
job evidence.
