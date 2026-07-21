FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml ./
COPY generator ./generator
RUN pip install --no-cache-dir .

USER 65532:65532
ENTRYPOINT ["python", "-m", "generator.event_generator"]

