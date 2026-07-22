import { randomUUID } from "node:crypto";
import { initializeDatabase, requireDatabase } from "./database";

type DemoEvent = {
  event_id: string;
  event_type: string;
  event_timestamp: Date;
  customer_id: string;
  session_id: string;
  product_id: string | null;
  category: string | null;
  amount: number | null;
  quantity: number | null;
  status: string;
  payload: Record<string, string | number | boolean>;
};

const categories = ["Electronics", "Home & living", "Apparel", "Sports", "Beauty"];
const eventTypes = [
  "page_view",
  "page_view",
  "page_view",
  "page_view",
  "page_view",
  "page_view",
  "page_view",
  "page_view",
  "page_view",
  "page_view",
  "product_view",
  "product_view",
  "product_view",
  "product_view",
  "product_view",
  "product_view",
  "product_view",
  "product_view",
  "add_to_cart",
  "add_to_cart",
  "add_to_cart",
  "add_to_cart",
  "checkout_started",
  "checkout_started",
  "purchase",
  "inventory_update",
  "inventory_update",
  "product_review",
  "customer_signup",
  "refund",
];

const ownerId = `${process.env.RENDER_INSTANCE_ID ?? "local"}-${randomUUID()}`;
let started = false;
let sequence = 0;

function pick<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function makeEvent(at = new Date()): DemoEvent {
  sequence += 1;
  const eventType = pick(eventTypes);
  const customerNumber = Math.floor(Math.random() * 2_000) + 1;
  const productNumber = Math.floor(Math.random() * 400) + 1;
  const quantity = Math.floor(Math.random() * 3) + 1;
  const category = pick(categories);
  const isMoneyEvent = eventType === "purchase" || eventType === "refund";
  const amount = isMoneyEvent
    ? Number((quantity * (18 + Math.random() * 210)).toFixed(2))
    : null;
  const productId = ["customer_signup", "login", "page_view"].includes(eventType)
    ? null
    : `prd_${String(productNumber).padStart(3, "0")}`;

  return {
    event_id: randomUUID(),
    event_type: eventType,
    event_timestamp: at,
    customer_id: `cus_${String(customerNumber).padStart(4, "0")}`,
    session_id: `ses_${customerNumber}_${Math.floor(at.getTime() / 900_000)}`,
    product_id: productId,
    category: productId ? category : null,
    amount,
    quantity: productId ? quantity : null,
    status: eventType === "refund" ? "validated" : "processed",
    payload: {
      source: "render-resumable-demo",
      sequence,
      synthetic: true,
    },
  };
}

async function insertEvents(events: DemoEvent[]) {
  const db = requireDatabase();
  await db`
    INSERT INTO portfolio.events ${db(
      events,
      "event_id",
      "event_type",
      "event_timestamp",
      "customer_id",
      "session_id",
      "product_id",
      "category",
      "amount",
      "quantity",
      "status",
      "payload",
    )}
    ON CONFLICT (event_id) DO NOTHING
  `;
}

async function seedIfEmpty() {
  const db = requireDatabase();
  const [{ count }] = await db<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM portfolio.events
  `;
  if (count > 0) return;

  const seedCount = Math.min(Number(process.env.SEED_EVENT_COUNT ?? 1_500), 5_000);
  const now = Date.now();
  const events = Array.from({ length: seedCount }, () => {
    const age = Math.random() * 30 * 24 * 60 * 60 * 1_000;
    return makeEvent(new Date(now - age));
  }).sort((a, b) => a.event_timestamp.getTime() - b.event_timestamp.getTime());

  for (let offset = 0; offset < events.length; offset += 250) {
    await insertEvents(events.slice(offset, offset + 250));
  }
}

async function claimLease() {
  const db = requireDatabase();
  const claimed = await db`
    INSERT INTO portfolio.stream_leases (
      lease_name, owner_id, expires_at, last_started_at
    ) VALUES (
      'render-web-stream', ${ownerId}, NOW() + INTERVAL '30 seconds', NOW()
    )
    ON CONFLICT (lease_name) DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      expires_at = EXCLUDED.expires_at,
      last_started_at = CASE
        WHEN portfolio.stream_leases.owner_id = EXCLUDED.owner_id
          THEN portfolio.stream_leases.last_started_at
        ELSE NOW()
      END,
      events_written = CASE
        WHEN portfolio.stream_leases.owner_id = EXCLUDED.owner_id
          THEN portfolio.stream_leases.events_written
        ELSE 0
      END
    WHERE portfolio.stream_leases.expires_at < NOW()
       OR portfolio.stream_leases.owner_id = EXCLUDED.owner_id
    RETURNING owner_id
  `;
  return claimed.length === 1;
}

async function tick() {
  if (!(await claimLease())) return;
  const db = requireDatabase();
  const event = makeEvent();
  await insertEvents([event]);
  await db`
    UPDATE portfolio.stream_leases
    SET last_event_at = ${event.event_timestamp},
        events_written = events_written + 1,
        expires_at = NOW() + INTERVAL '30 seconds'
    WHERE lease_name = 'render-web-stream' AND owner_id = ${ownerId}
  `;
}

export async function startEventStream() {
  if (started || process.env.DEMO_STREAMING_ENABLED === "false") return;
  started = true;

  try {
    await initializeDatabase();
    await seedIfEmpty();
    await tick();
  } catch (error) {
    started = false;
    console.error("Unable to start the demo event stream", error);
    return;
  }

  const intervalMs = Math.max(Number(process.env.EVENT_INTERVAL_MS ?? 3_000), 1_000);
  const timer = setInterval(() => {
    void tick().catch((error) => console.error("Demo event tick failed", error));
  }, intervalMs);
  timer.unref();
  console.log(`Synthetic event stream started; interval=${intervalMs}ms owner=${ownerId}`);
}
