# Recruiter cloud demo

The public portfolio application runs as one Render web service and stores all generated
events in Supabase PostgreSQL. Render can spin the process down after idle time; the next
HTTP request wakes it, the instrumentation hook claims a database-backed lease, and the
synthetic producer resumes appending events. Historical rows remain in PostgreSQL across
sleep, restart, and deploy cycles.

## Required configuration

- `DATABASE_URL`: Supabase **Session pooler** connection string (port 5432). Render needs
  the IPv4-compatible pooler, not Supabase's IPv6-only direct endpoint.
- `DEMO_STREAMING_ENABLED`: set to `true` to start the producer with the web process.
- `EVENT_INTERVAL_MS`: delay between events; defaults to 3000 ms.
- `SEED_EVENT_COUNT`: historical events inserted only when the table is empty.

The application creates the `portfolio` schema and its tables idempotently on startup.
It never truncates existing event history.

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
