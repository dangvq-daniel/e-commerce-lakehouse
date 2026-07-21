#!/usr/bin/env bash
set -euo pipefail

for database in warehouse metabaseapp; do
  exists="$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only \
    --command "SELECT 1 FROM pg_database WHERE datname = '$database'")"
  if [[ -z "$exists" ]]; then
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      --command "CREATE DATABASE $database"
  fi
done

