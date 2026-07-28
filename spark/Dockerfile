FROM apache/spark:3.5.6-python3

ENV SPARK_VERSION=3.5.6 \
    DELTA_VERSION=3.3.2 \
    POSTGRES_JDBC_VERSION=42.7.5 \
    SPARK_PACKAGES=org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.6,io.delta:delta-spark_2.12:3.3.2,org.postgresql:postgresql:42.7.5

USER root
COPY spark/prefetch_dependencies.py /opt/ecommerce/spark/prefetch_dependencies.py
RUN mkdir -p /lakehouse /opt/spark/.ivy2 \
    && /opt/spark/bin/spark-submit \
       --master local[1] \
       --packages "${SPARK_PACKAGES}" \
       --conf spark.jars.ivy=/opt/spark/.ivy2 \
       /opt/ecommerce/spark/prefetch_dependencies.py \
    && cp /opt/spark/.ivy2/jars/*.jar /opt/spark/jars/
COPY spark /opt/ecommerce/spark
RUN chown -R 185:0 /lakehouse /opt/ecommerce /opt/spark/.ivy2

USER 185
WORKDIR /opt/ecommerce

EXPOSE 8090 10000 4040

CMD ["python3", "/opt/ecommerce/spark/job_gateway.py"]
