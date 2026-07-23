# Recruiter cloud demo

[Live application](https://ecommerce-lakehouse-demo.onrender.com)

The public portfolio application runs as one Render web service and stores all generated
events in Supabase PostgreSQL. Render can spin the process down after idle time; the next
HTTP request wakes it, the instrumentation hook claims a database-backed lease, and the
synthetic producer resumes appending events. Historical rows remain in PostgreSQL across
sleep, restart, and deploy cycles.

## Required configuration

- `DATABASE_URL`: Supabase **Session pooler** connection string (port 5432). Render needs
  the IPv4-compatible pooler, not Supabase's IPv6-only direct endpoint.
- `DEMO_STREAMING_ENABLED`: set to `true` to start the producer with the web process.
- `EVENT_INTERVAL_MS`: delay between events; defaults to and is clamped at a minimum of 60000 ms.
- `SEED_EVENT_COUNT`: minimum historical baseline; only missing events are added.
- `MAX_EVENT_ROWS`: hard event-table cap; defaults to 50000 rows.
- `EVENT_RETENTION_DAYS`: rolling history window; defaults to 35 days.
- `DATABASE_WRITE_GUARD_BYTES`: total database size that pauses writes; defaults to 200000000 bytes.

The application creates the `portfolio` schema and its tables idempotently on startup.
It never truncates the table wholesale. Maintenance rotates only events older than the
retention window or rows beyond the configured cap, and the dashboard reports current
database usage against the 500 MB Supabase Free quota.

## Local verification

```powershell
$env:DATABASE_URL = "postgresql://..."
npm ci
npm run build
npm test
npm start
```

Open `http://localhost:3000`. The health check is `/api/health`, and the live dashboard
payload is `/api/analytics?range=24H`.

## Deployment

The root [`render.yaml`](../render.yaml) defines the free Render web service. Keep
`DATABASE_URL` secret in Render; do not commit it.
