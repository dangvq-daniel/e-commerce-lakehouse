# Databricks notebook source
"""Publish dbt-built Delta Gold tables to the PostgreSQL serving warehouse."""

# COMMAND ----------

dbutils.widgets.text("catalog", "ecommerce")
dbutils.widgets.text("postgres_jdbc_url", "jdbc:postgresql://postgres:5432/warehouse")
dbutils.widgets.text("postgres_secret_scope", "ecommerce")
dbutils.widgets.text("postgres_user_key", "warehouse-user")
dbutils.widgets.text("postgres_password_key", "warehouse-password")

catalog = dbutils.widgets.get("catalog")
jdbc_url = dbutils.widgets.get("postgres_jdbc_url")
secret_scope = dbutils.widgets.get("postgres_secret_scope")
user = dbutils.secrets.get(secret_scope, dbutils.widgets.get("postgres_user_key"))
password = dbutils.secrets.get(secret_scope, dbutils.widgets.get("postgres_password_key"))

gold_tables = (
    "dim_customer",
    "dim_product",
    "dim_date",
    "dim_country",
    "fact_orders",
    "fact_sales",
    "fact_sessions",
    "fact_inventory",
)

# COMMAND ----------

# Spark can create a missing table through JDBC, but the destination schema must exist.
driver_manager = spark._sc._gateway.jvm.java.sql.DriverManager
connection = driver_manager.getConnection(jdbc_url, user, password)
try:
    statement = connection.createStatement()
    statement.execute("CREATE SCHEMA IF NOT EXISTS gold")
    statement.close()
finally:
    connection.close()

properties = {
    "user": user,
    "password": password,
    "driver": "org.postgresql.Driver",
    "batchsize": "10000",
}

published_counts = {}
for table in gold_tables:
    frame = spark.table(f"{catalog}.gold.{table}")
    published_counts[table] = frame.count()
    (
        frame.write.mode("overwrite")
        .option("truncate", "true")
        .jdbc(jdbc_url, f"gold.{table}", properties=properties)
    )

dbutils.jobs.taskValues.set(key="published_counts", value=published_counts)
display(spark.createDataFrame(published_counts.items(), "table_name string, row_count long"))

