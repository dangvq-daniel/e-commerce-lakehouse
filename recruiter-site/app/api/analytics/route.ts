import { initializeDatabase, requireDatabase } from "@/lib/database";
import {
  databaseWriteGuardBytes,
  eventIntervalMs,
  eventRetentionDays,
  maxEventRows,
  supabaseFreeDatabaseQuotaBytes,
} from "@/lib/demo-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ranges = { "24H": 24, "7D": 24 * 7, "30D": 24 * 30 } as const;
type RangeKey = keyof typeof ranges;

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100_000 ? 2 : 0,
  }).format(value);
}

function eventValue(event: { event_type: string; amount: number | null; quantity: number | null }) {
  if (event.amount !== null) return money(event.amount);
  if (event.quantity !== null) return `${event.quantity} unit${event.quantity === 1 ? "" : "s"}`;
  return "—";
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("range")?.toUpperCase() as RangeKey;
  const range = requested in ranges ? requested : "24H";
  const hours = ranges[range];

  try {
    await initializeDatabase();
    const db = requireDatabase();
    const [summary] = await db<{
      revenue: number;
      orders: number;
      sessions: number;
      latest_event_at: string | null;
      total_events: number;
      events_last_five_minutes: number;
      database_size_bytes: number;
    }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN amount WHEN event_type = 'refund' THEN -amount ELSE 0 END), 0)::float AS revenue,
        COUNT(*) FILTER (WHERE event_type = 'purchase')::int AS orders,
        COUNT(DISTINCT session_id)::int AS sessions,
        MAX(event_timestamp)::text AS latest_event_at,
        (SELECT COUNT(*)::int FROM portfolio.events) AS total_events,
        COUNT(*) FILTER (WHERE event_timestamp >= NOW() - INTERVAL '5 minutes')::int AS events_last_five_minutes,
        pg_database_size(current_database())::float AS database_size_bytes
      FROM portfolio.events
      WHERE event_timestamp >= NOW() - (${hours} * INTERVAL '1 hour')
    `;
    const categories = await db<{ name: string; revenue: number }[]>`
      SELECT COALESCE(category, 'Uncategorized') AS name,
        COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN amount ELSE 0 END), 0)::float AS revenue
      FROM portfolio.events
      WHERE event_timestamp >= NOW() - (${hours} * INTERVAL '1 hour')
        AND event_type = 'purchase'
      GROUP BY category
      ORDER BY revenue DESC
      LIMIT 5
    `;
    const recent = await db<{
      event_timestamp: string;
      event_type: string;
      event_id: string;
      amount: number | null;
      quantity: number | null;
      status: string;
    }[]>`
      SELECT event_timestamp::text, event_type, event_id::text,
        amount::float, quantity, status
      FROM portfolio.events
      ORDER BY event_timestamp DESC
      LIMIT 5
    `;
    const chart = await db<{ bucket: string; revenue: number }[]>`
      SELECT
        CASE
          WHEN ${hours} <= 24 THEN date_trunc('hour', event_timestamp)
          ELSE date_trunc('day', event_timestamp)
        END::text AS bucket,
        COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN amount WHEN event_type = 'refund' THEN -amount ELSE 0 END), 0)::float AS revenue
      FROM portfolio.events
      WHERE event_timestamp >= NOW() - (${hours} * INTERVAL '1 hour')
      GROUP BY 1
      ORDER BY 1
    `;
    const [stream] = await db<{
      last_started_at: string | null;
      last_event_at: string | null;
      events_written: number;
    }[]>`
      SELECT last_started_at::text, last_event_at::text, events_written::int
      FROM portfolio.stream_leases
      WHERE lease_name = 'render-web-stream'
    `;

    const aov = summary.orders ? summary.revenue / summary.orders : 0;
    const conversion = summary.sessions ? (summary.orders / summary.sessions) * 100 : 0;
    const maxCategory = Math.max(...categories.map((item) => item.revenue), 1);
    const latestMs = summary.latest_event_at
      ? Date.now() - new Date(summary.latest_event_at).getTime()
      : Number.POSITIVE_INFINITY;
    const writePaused = summary.database_size_bytes >= databaseWriteGuardBytes;

    return Response.json({
      range,
      generatedAt: new Date().toISOString(),
      snapshot: {
        revenue: money(summary.revenue),
        orders: summary.orders.toLocaleString("en-US"),
        aov: money(aov),
        conversion: `${conversion.toFixed(1)}%`,
        chart: chart.map((point) => Math.max(point.revenue, 0)),
        labels: chart.map((point) => new Date(point.bucket).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          ...(hours <= 24 ? { hour: "numeric" } : {}),
        })),
        categories: categories.map((item) => ({
          name: item.name,
          value: money(item.revenue),
          share: Math.max(3, Math.round((item.revenue / maxCategory) * 100)),
        })),
      },
      recentEvents: recent.map((event) => ({
        time: new Date(event.event_timestamp).toLocaleTimeString("en-US", { hour12: false }),
        type: event.event_type,
        id: event.event_id.slice(0, 8),
        value: eventValue(event),
        status: event.status,
      })),
      runtime: {
        state: writePaused
          ? "paused"
          : latestMs < eventIntervalMs + 30_000 ? "streaming" : "waking",
        freshnessSeconds: Number.isFinite(latestMs) ? Math.max(0, Math.round(latestMs / 1_000)) : 0,
        eventsPerMinute: Number((summary.events_last_five_minutes / 5).toFixed(1)),
        totalEvents: summary.total_events,
        lastStartedAt: stream?.last_started_at ?? null,
        eventsThisWake: stream?.events_written ?? 0,
        nextEventInSeconds: Number.isFinite(latestMs)
          ? Math.max(0, Math.ceil((eventIntervalMs - latestMs) / 1_000))
          : 0,
        writeCadenceSeconds: Math.round(eventIntervalMs / 1_000),
        estimatedMonthlyEvents: Math.round((30 * 24 * 60 * 60 * 1_000) / eventIntervalMs),
        eventCap: maxEventRows,
        retentionDays: eventRetentionDays,
        databaseSizeBytes: Math.round(summary.database_size_bytes),
        databaseQuotaBytes: supabaseFreeDatabaseQuotaBytes,
        databaseWriteGuardBytes,
        writePaused,
      },
    });
  } catch (error) {
    console.error("Analytics query failed", error);
    return Response.json({ error: "Database unavailable", detail: String(error) }, { status: 503 });
  }
}
