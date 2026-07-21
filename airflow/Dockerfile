FROM apache/airflow:2.10.4-python3.11

USER root
RUN python -m venv /opt/dbt-venv && chown -R airflow:0 /opt/dbt-venv

USER airflow
COPY --chown=airflow:root airflow/requirements.txt /requirements.txt
COPY --chown=airflow:root airflow/requirements-dbt.txt /requirements-dbt.txt
RUN pip install --no-cache-dir -r /requirements.txt \
    && /opt/dbt-venv/bin/pip install --no-cache-dir -r /requirements-dbt.txt

USER root
RUN ln -s /opt/dbt-venv/bin/dbt /usr/local/bin/dbt
USER airflow
