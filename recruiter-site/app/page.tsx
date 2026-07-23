"use client";

import { useEffect, useMemo, useState } from "react";

type RangeKey = "24H" | "7D" | "30D";
type DataView = "performance" | "events";

type Snapshot = {
  revenue: string;
  orders: string;
  aov: string;
  conversion: string;
  chart: number[];
  labels: string[];
  categories: { name: string; value: string; share: number }[];
};

type LiveAnalytics = {
  snapshot: Snapshot;
  recentEvents: { time: string; type: string; id: string; value: string; status: string }[];
  runtime: {
    state: "streaming" | "waking" | "paused";
    freshnessSeconds: number;
    eventsPerMinute: number;
    totalEvents: number;
    lastStartedAt: string | null;
    eventsThisWake: number;
    nextEventInSeconds: number;
    writeCadenceSeconds: number;
    estimatedMonthlyEvents: number;
    eventCap: number;
    retentionDays: number;
    databaseSizeBytes: number;
    databaseQuotaBytes: number;
    databaseWriteGuardBytes: number;
    writePaused: boolean;
  };
};

function friendlyEventType(value: string) {
  return value.replaceAll("_", " ");
}

function megabytes(value: number) {
  return Math.max(0, Math.round(value / 1_000_000));
}

const fallbackSnapshots: Record<RangeKey, Snapshot> = {
  "24H": {
    revenue: "$6,368",
    orders: "96",
    aov: "$66",
    conversion: "15.6%",
    chart: [22, 31, 27, 45, 38, 55, 49, 67, 61, 74, 69, 82],
    labels: ["12a", "2a", "4a", "6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p", "Now"],
    categories: [
      { name: "Electronics", value: "$4.5k", share: 100 },
      { name: "Home & living", value: "$4.2k", share: 92 },
      { name: "Sports", value: "$3.7k", share: 81 },
      { name: "Beauty", value: "$3.1k", share: 68 },
      { name: "Apparel", value: "$2.3k", share: 51 },
    ],
  },
  "7D": {
    revenue: "$42.8k",
    orders: "641",
    aov: "$67",
    conversion: "15.2%",
    chart: [41, 56, 49, 65, 72, 68, 84],
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    categories: [
      { name: "Electronics", value: "$14.1k", share: 100 },
      { name: "Home & living", value: "$10.6k", share: 75 },
      { name: "Sports", value: "$7.4k", share: 53 },
      { name: "Beauty", value: "$6.2k", share: 44 },
      { name: "Apparel", value: "$4.5k", share: 32 },
    ],
  },
  "30D": {
    revenue: "$184k",
    orders: "2,731",
    aov: "$67",
    conversion: "15.4%",
    chart: [38, 44, 47, 51, 49, 56, 61, 58, 64, 69, 73, 78],
    labels: ["W1", "", "", "W2", "", "", "W3", "", "", "W4", "", "Now"],
    categories: [
      { name: "Electronics", value: "$58k", share: 100 },
      { name: "Home & living", value: "$45k", share: 78 },
      { name: "Sports", value: "$34k", share: 59 },
      { name: "Beauty", value: "$27k", share: 47 },
      { name: "Apparel", value: "$20k", share: 34 },
    ],
  },
};

const fallbackEvents = [
  { time: "14:42:18", type: "purchase", id: "84f1c2a7", value: "$184", status: "processed" },
  { time: "14:42:16", type: "inventory_update", id: "fb091da4", value: "2 units", status: "processed" },
  { time: "14:42:13", type: "refund", id: "2cc89fe1", value: "$43", status: "validated" },
  { time: "14:42:09", type: "product_view", id: "a170cc26", value: "1 unit", status: "processed" },
  { time: "14:42:04", type: "add_to_cart", id: "224ecf98", value: "1 unit", status: "processed" },
];

const systemNodes = [
  {
    id: "airflow",
    number: "CTRL",
    title: "Airflow",
    subtitle: "Control Plane",
    group: "Orchestrate",
    kind: "control",
    purpose: "Coordinates work without becoming part of the business-data path.",
    output: "Independent schedules, retries, dependency checks, and operational visibility for Databricks and dbt.",
  },
  {
    id: "simulator",
    number: "01",
    title: "Python",
    subtitle: "Event Simulator",
    group: "Capture",
    kind: "data",
    purpose: "Creates realistic customer, order, refund, inventory, and product activity.",
    output: "Typed synthetic events with related customer, session, product, and order IDs.",
  },
  {
    id: "kafka",
    number: "02",
    title: "Kafka",
    subtitle: "Topics",
    group: "Capture",
    kind: "data",
    purpose: "Decouples producers from consumers and keeps events replayable.",
    output: "Five partitioned streams with durable offsets and ordered records per partition.",
  },
  {
    id: "databricks",
    number: "03",
    title: "Databricks",
    subtitle: "PySpark Streaming",
    group: "Process",
    kind: "data",
    purpose: "Processes events continuously with checkpoints, watermarks, and failure recovery.",
    output: "A governed path into Bronze and validated Silver tables.",
  },
  {
    id: "bronze",
    number: "04",
    title: "Delta",
    subtitle: "Bronze",
    group: "Lakehouse",
    kind: "data",
    purpose: "Preserves the original event envelope before business transformations.",
    output: "Immutable, replayable raw history with ingestion and Kafka metadata.",
  },
  {
    id: "silver",
    number: "05",
    title: "Delta",
    subtitle: "Silver",
    group: "Lakehouse",
    kind: "data",
    purpose: "Normalizes schemas, deduplicates records, and separates invalid data.",
    output: "Trusted domain tables ready for analytics engineering.",
  },
  {
    id: "dbt",
    number: "06",
    title: "dbt",
    subtitle: "Staging + Intermediate",
    group: "Model",
    kind: "data",
    purpose: "Turns Silver data into documented, tested business definitions.",
    output: "Reusable staging views, metrics, lineage, and data-quality tests.",
  },
  {
    id: "gold",
    number: "07",
    title: "Delta",
    subtitle: "Gold",
    group: "Model",
    kind: "data",
    purpose: "Publishes business-ready facts and dimensions at explicit grains.",
    output: "Eight curated models for sales, orders, sessions, inventory, customers, and products.",
  },
  {
    id: "postgres",
    number: "08",
    title: "PostgreSQL",
    subtitle: "Warehouse",
    group: "Serve",
    kind: "data",
    purpose: "Provides a familiar, low-latency serving layer for business intelligence.",
    output: "A query-ready copy of Gold isolated from streaming workloads.",
  },
  {
    id: "metabase",
    number: "09",
    title: "Metabase",
    subtitle: "Dashboard",
    group: "Serve",
    kind: "data",
    purpose: "Makes governed metrics accessible to executives, product teams, and operations.",
    output: "Seventeen saved questions across four decision-focused dashboards.",
  },
];

const systemEdges = [
  { from: "simulator", to: "kafka", kind: "data", path: "M 139 248 L 200 248" },
  { from: "kafka", to: "databricks", kind: "data", path: "M 319 248 L 380 248" },
  { from: "databricks", to: "bronze", kind: "data", path: "M 440 306 L 440 335" },
  { from: "bronze", to: "silver", kind: "data", path: "M 499 393 L 560 393" },
  { from: "silver", to: "dbt", kind: "data", path: "M 679 393 L 720 393" },
  { from: "dbt", to: "gold", kind: "data", path: "M 839 393 L 860 393" },
  { from: "gold", to: "postgres", kind: "data", path: "M 920 451 C 920 468 780 466 740 480" },
  { from: "postgres", to: "metabase", kind: "data", path: "M 799 538 L 860 538" },
  { from: "airflow", to: "databricks", kind: "control", path: "M 640 150 C 640 178 440 158 440 190" },
  { from: "airflow", to: "dbt", kind: "control", path: "M 640 150 C 640 240 780 245 780 335" },
];

const outcomes = [
  {
    number: "01",
    title: "Capture every decision signal",
    copy: "Clicks, carts, orders, refunds, reviews, and inventory changes share one versioned event contract.",
  },
  {
    number: "02",
    title: "Make the stream trustworthy",
    copy: "Raw history remains replayable while validation, deduplication, and quarantine protect downstream metrics.",
  },
  {
    number: "03",
    title: "Turn events into action",
    copy: "Tested facts and dimensions answer revenue, customer, product, and operational questions consistently.",
  },
];

export default function Home() {
  const [range, setRange] = useState<RangeKey>("24H");
  const [dataView, setDataView] = useState<DataView>("performance");
  const [selectedNodeId, setSelectedNodeId] = useState("simulator");
  const [liveData, setLiveData] = useState<LiveAnalytics | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "retrying">("connecting");
  const [secondsUntilNext, setSecondsUntilNext] = useState(60);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/analytics?range=${range}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`analytics returned ${response.status}`);
        const next = (await response.json()) as LiveAnalytics;
        if (active) {
          setLiveData(next);
          setSecondsUntilNext(next.runtime.nextEventInSeconds);
          setConnectionState("live");
        }
      } catch (error) {
        console.warn("Live analytics are not ready", error);
        if (active) setConnectionState("retrying");
      }
    };

    const refreshWhenVisible = () => {
      if (!document.hidden) void load();
    };

    void load();
    const timer = window.setInterval(refreshWhenVisible, 10_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [range]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsUntilNext((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const snapshot = liveData?.snapshot ?? fallbackSnapshots[range];
  const events = liveData?.recentEvents ?? fallbackEvents;
  const chart = snapshot.chart.slice(-18);
  const labels = snapshot.labels.slice(-18);
  const chartMax = useMemo(() => Math.max(...chart, 1), [chart]);
  const selectedNode = systemNodes.find((node) => node.id === selectedNodeId) ?? systemNodes[1];
  const incomingNodes = systemEdges
    .filter((edge) => edge.to === selectedNode.id)
    .map((edge) => systemNodes.find((node) => node.id === edge.from))
    .filter((node): node is (typeof systemNodes)[number] => Boolean(node));
  const outgoingNodes = systemEdges
    .filter((edge) => edge.from === selectedNode.id)
    .map((edge) => systemNodes.find((node) => node.id === edge.to))
    .filter((node): node is (typeof systemNodes)[number] => Boolean(node));
  const runtime = liveData?.runtime;
  const latestEvent = events[0];
  const streamState = connectionState === "live"
    ? runtime?.state ?? "waking"
    : connectionState;
  const streamLabel = streamState === "streaming"
    ? "Streaming"
    : streamState === "paused"
      ? "Storage guard active"
      : streamState === "retrying"
        ? "Reconnecting"
        : streamState === "waking" ? "Starting stream" : "Connecting";
  const storagePercent = runtime
    ? Math.min(100, Math.round((runtime.databaseSizeBytes / runtime.databaseQuotaBytes) * 100))
    : 0;

  const changeRange = (next: RangeKey) => {
    setConnectionState("connecting");
    setRange(next);
  };

  return (
    <main id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="E-commerce Lakehouse home">
          <span className="brand-mark" aria-hidden="true">EL</span>
          <span className="brand-copy">
            <strong>E-commerce Lakehouse</strong>
            <small>Streaming analytics platform</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#live">Live data</a>
          <a href="#architecture">Architecture</a>
          <a href="#reliability">Reliability</a>
        </nav>
        <a className="source-link" href="https://github.com/dangvq-daniel/e-commerce-lakehouse" target="_blank" rel="noreferrer">
          View source <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="live-badge"><i aria-hidden="true" /> Public demo running on Render</div>
          <p className="eyebrow">REAL-TIME E-COMMERCE ANALYTICS</p>
          <h1 id="hero-title">From raw customer events to decisions teams can trust.</h1>
          <p className="hero-lede">
            A production-shaped data platform that captures commerce activity, improves it through a governed lakehouse,
            and serves clear revenue, customer, product, and inventory insights.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#live">See live data</a>
            <a className="button button-secondary" href="#architecture">Understand the system</a>
          </div>
          <dl className="proof-strip" aria-label="Project scope">
            <div><dt>10</dt><dd>Event types</dd></div>
            <div><dt>9</dt><dd>Pipeline stages</dd></div>
            <div><dt>8</dt><dd>Gold models</dd></div>
            <div><dt>$0</dt><dd>Demo runtime</dd></div>
          </dl>
        </div>

        <aside className="journey-card" aria-label="How a customer action becomes a business decision">
          <div className="journey-head">
            <span>ONE EVENT, END TO END</span>
            <b>Purchase completed</b>
          </div>
          <ol>
            <li><span>01</span><div><strong>Capture</strong><p>Python emits a typed purchase event to Kafka.</p></div></li>
            <li><span>02</span><div><strong>Refine</strong><p>PySpark preserves raw data, then validates and deduplicates it.</p></div></li>
            <li><span>03</span><div><strong>Model</strong><p>dbt applies tested business logic and updates Gold facts.</p></div></li>
            <li><span>04</span><div><strong>Decide</strong><p>PostgreSQL and Metabase expose the result to business users.</p></div></li>
          </ol>
          <p className="journey-note">Airflow coordinates the work without carrying business data.</p>
        </aside>
      </section>

      <section className="product section-shell" id="product" aria-labelledby="product-title">
        <div className="section-intro">
          <p className="eyebrow">THE PRODUCT</p>
          <h2 id="product-title">One dependable path from activity to insight.</h2>
          <p>The platform solves three connected problems so teams do not have to reconcile disconnected pipelines and metrics.</p>
        </div>
        <div className="outcome-grid">
          {outcomes.map((outcome) => (
            <article key={outcome.number}>
              <span>{outcome.number}</span>
              <h3>{outcome.title}</h3>
              <p>{outcome.copy}</p>
            </article>
          ))}
        </div>
        <div className="audience-row">
          <strong>Built for shared understanding</strong>
          <span>Executives track revenue</span>
          <span>Product teams study conversion</span>
          <span>Operations monitor inventory</span>
          <span>Data teams own quality and replay</span>
        </div>
      </section>

      <section className="live-section" id="live" aria-labelledby="live-title">
        <div className="section-shell">
          <div className="live-heading">
            <div>
              <p className="eyebrow">LIVE PRODUCT DEMO</p>
              <h2 id="live-title">The data is moving now.</h2>
              <p>Render appends synthetic events while awake. Supabase provides durable PostgreSQL history across sleep, restart, and deploy cycles.</p>
            </div>
            <div className={`connection-state ${streamState}`} aria-live="polite">
              <i aria-hidden="true" />
              <span>{streamLabel}</span>
            </div>
          </div>

          <div className="stream-monitor" aria-label="How the current synthetic event reaches storage">
            <div className="stream-current">
              <span><i aria-hidden="true" /> Latest persisted event</span>
              <strong>{friendlyEventType(latestEvent.type)}</strong>
              <p><code>{latestEvent.id}</code> written at {latestEvent.time}</p>
            </div>
            <div className="stream-route">
              <div className="route-step"><i>1</i><strong>Generate</strong><small>Python</small></div>
              <div className="route-track" aria-hidden="true"><i key={`generate-${runtime?.totalEvents ?? 0}`} /></div>
              <div className="route-step"><i>2</i><strong>Validate</strong><small>Contract</small></div>
              <div className="route-track" aria-hidden="true"><i key={`validate-${runtime?.totalEvents ?? 0}`} /></div>
              <div className="route-step"><i>3</i><strong>Persist</strong><small>PostgreSQL</small></div>
            </div>
            <div className="next-write">
              <span>NEXT BUDGET-SAFE WRITE</span>
              <strong>{runtime?.writePaused ? "Paused" : `${secondsUntilNext}s`}</strong>
              <small>One event per minute</small>
            </div>
          </div>

          <div className="runtime-bar" aria-label="Live runtime status">
            <div><span>Latest event</span><strong>{runtime ? `${runtime.freshnessSeconds}s ago` : "—"}</strong><small>Refreshes every 10 seconds</small></div>
            <div><span>Write cadence</span><strong>{runtime ? `1 / ${runtime.writeCadenceSeconds}s` : "—"}</strong><small>{runtime?.estimatedMonthlyEvents.toLocaleString() ?? "43,200"} maximum writes / month</small></div>
            <div><span>Stored events</span><strong>{runtime?.totalEvents.toLocaleString() ?? "—"}</strong><small>{runtime ? `${runtime.eventCap.toLocaleString()} row hard cap` : "50,000 row hard cap"}</small></div>
            <div className="storage-budget">
              <span>Database size</span><strong>{runtime ? `${megabytes(runtime.databaseSizeBytes)} MB` : "—"}</strong>
              <em className="storage-meter" aria-hidden="true"><i style={{ width: `${storagePercent}%` }} /></em>
              <small>{storagePercent}% of the 500 MB free quota</small>
            </div>
            <p>{runtime?.retentionDays ?? 35}-day rolling history · writes stop at 200 MB · synthetic data only</p>
          </div>

          <div className="analytics-toolbar">
            <div className="view-tabs" aria-label="Choose analytics view">
              <button type="button" aria-pressed={dataView === "performance"} onClick={() => setDataView("performance")}>Performance</button>
              <button type="button" aria-pressed={dataView === "events"} onClick={() => setDataView("events")}>Latest events</button>
            </div>
            <div className="range-tabs" aria-label="Choose reporting period">
              {(Object.keys(fallbackSnapshots) as RangeKey[]).map((item) => (
                <button key={item} type="button" aria-pressed={range === item} onClick={() => changeRange(item)}>{item}</button>
              ))}
            </div>
          </div>

          <div className="kpi-grid">
            <article><span>Net revenue</span><strong className="metric-value" key={`revenue-${snapshot.revenue}`}>{snapshot.revenue}</strong><small>Purchases less refunds</small></article>
            <article><span>Completed orders</span><strong className="metric-value" key={`orders-${snapshot.orders}`}>{snapshot.orders}</strong><small>Purchase events</small></article>
            <article><span>Average order</span><strong className="metric-value" key={`aov-${snapshot.aov}`}>{snapshot.aov}</strong><small>Net revenue per order</small></article>
            <article><span>Session conversion</span><strong className="metric-value" key={`conversion-${snapshot.conversion}`}>{snapshot.conversion}</strong><small>Orders per active session</small></article>
          </div>

          {dataView === "performance" ? (
            <div className="performance-view">
              <article className="chart-card">
                <div className="card-heading">
                  <div><span>REVENUE OVER TIME</span><h3>{range} sales movement</h3></div>
                  <small>Live PostgreSQL aggregate</small>
                </div>
                <div className="bar-chart" aria-label={`Revenue values for ${range}`}>
                  {chart.map((value, index) => (
                    <div className="bar-column" key={`${range}-${index}-${value}`}>
                      <i style={{ height: `${Math.max(4, Math.round((value / chartMax) * 100))}%`, animationDelay: `${index * 30}ms` }} />
                      <span>{labels[index] && (index === 0 || index === chart.length - 1 || index % 3 === 0) ? labels[index] : ""}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="category-card">
                <div className="card-heading"><div><span>REVENUE MIX</span><h3>Top categories</h3></div></div>
                <div className="category-list">
                  {snapshot.categories.map((category, index) => (
                    <div className="category-item" key={category.name}>
                      <div><b>{String(index + 1).padStart(2, "0")}</b><strong>{category.name}</strong><span>{category.value}</span></div>
                      <i><span style={{ width: `${category.share}%` }} /></i>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : (
            <article className="events-card">
              <div className="card-heading">
                <div><span>RECENT ACTIVITY</span><h3>Latest persisted events</h3></div>
                <small>Refreshes every ten seconds</small>
              </div>
              <div className="event-table" role="table" aria-label="Latest synthetic events">
                <div className="event-row event-header" role="row">
                  <span role="columnheader">Time</span><span role="columnheader">Event</span><span role="columnheader">ID</span><span role="columnheader">Value</span><span role="columnheader">Status</span>
                </div>
                {events.map((event, index) => (
                  <div className={`event-row ${index === 0 ? "event-row-new" : ""}`} role="row" key={`${event.time}-${event.id}`}>
                    <span role="cell">{event.time}</span><strong role="cell">{friendlyEventType(event.type)}</strong><code role="cell">{event.id}</code><b role="cell">{event.value}</b><i role="cell">{event.status}</i>
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>
      </section>

      <section className="architecture section-shell" id="architecture" aria-labelledby="architecture-title">
        <div className="section-intro architecture-intro">
          <p className="eyebrow">SYSTEM DESIGN</p>
          <h2 id="architecture-title">See how the platform actually works.</h2>
          <p>The solid route carries business data. The dashed branch is Airflow&apos;s control plane, independently coordinating Databricks and dbt.</p>
        </div>

        <div className="architecture-map">
          <div className="map-toolbar">
            <div>
              <strong>Production architecture</strong>
              <span>Select a node to inspect its role and immediate connections.</span>
            </div>
            <div className="map-legend" aria-label="Connection legend">
              <span><i className="legend-data" aria-hidden="true" /> Business data</span>
              <span><i className="legend-control" aria-hidden="true" /> Control signal</span>
            </div>
          </div>

          <div className="system-map-canvas" aria-label="Selectable e-commerce lakehouse system graph">
            <div className="map-lane map-lane-control" aria-hidden="true">
              <span>CONTROL PLANE</span><small>Schedules, retries, and monitors</small>
            </div>
            <div className="map-lane map-lane-data" aria-hidden="true">
              <span>DATA PLANE</span><small>Events move through capture, refinement, modeling, and serving</small>
            </div>

            <svg className="map-connections" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="data-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
                <marker id="control-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
              </defs>
              {systemEdges.map((edge) => (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={edge.path}
                  className={`${edge.kind}-edge ${edge.from === selectedNode.id || edge.to === selectedNode.id ? "edge-active" : ""}`}
                  markerEnd={`url(#${edge.kind}-arrow)`}
                />
              ))}
            </svg>

            <div className="system-map-nodes">
              {systemNodes.map((node) => {
                const isRelated = systemEdges.some((edge) =>
                  (edge.from === selectedNode.id && edge.to === node.id)
                  || (edge.to === selectedNode.id && edge.from === node.id));
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`map-node node-${node.id} ${isRelated ? "is-related" : ""}`}
                    aria-pressed={selectedNode.id === node.id}
                    aria-controls="architecture-inspector"
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <span>{node.number} · {node.group}</span>
                    <strong>{node.title}</strong>
                    <small>{node.subtitle}</small>
                  </button>
                );
              })}
              <div className="mobile-control-branch" aria-hidden="true">
                <span>Controls two independent jobs</span>
                <strong>Databricks</strong>
                <i />
                <strong>dbt</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="node-inspector" id="architecture-inspector" aria-live="polite" key={selectedNode.id}>
          <div className="inspector-identity">
            <span>{selectedNode.kind === "control" ? "CONTROL PLANE" : `${selectedNode.number} · ${selectedNode.group.toUpperCase()}`}</span>
            <h3>{selectedNode.title}</h3>
            <p>{selectedNode.subtitle}</p>
          </div>
          <div className="inspector-purpose">
            <span>WHY IT EXISTS</span>
            <strong>{selectedNode.purpose}</strong>
          </div>
          <div className="inspector-output">
            <span>WHAT IT PRODUCES</span>
            <p>{selectedNode.output}</p>
          </div>
          <div className="inspector-links">
            <span>IMMEDIATE CONNECTIONS</span>
            <div>
              {incomingNodes.map((node) => (
                <button key={`from-${node.id}`} type="button" onClick={() => setSelectedNodeId(node.id)}>
                  <i aria-hidden="true">←</i> {node.title}
                </button>
              ))}
              {outgoingNodes.map((node) => (
                <button key={`to-${node.id}`} type="button" onClick={() => setSelectedNodeId(node.id)}>
                  {node.title} <i aria-hidden="true">→</i>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="operating-modes" aria-labelledby="modes-title">
        <div className="section-shell">
          <div className="section-intro">
            <p className="eyebrow">CLEAR TRADE-OFFS</p>
            <h2 id="modes-title">One product, two operating modes.</h2>
            <p>The repository demonstrates the complete platform. The public runtime is deliberately smaller so recruiters can use it within a $5 monthly ceiling.</p>
          </div>
          <div className="mode-grid">
            <article>
              <span className="mode-label">PRODUCTION REFERENCE</span>
              <h3>Built for governed scale</h3>
              <p>Kafka, Databricks, Delta Lake, dbt, PostgreSQL, Metabase, and Airflow implement the complete architecture.</p>
              <ul><li>Replayable event transport</li><li>Bronze, Silver, and Gold ownership</li><li>Independent orchestration control plane</li></ul>
            </article>
            <article className="mode-live">
              <span className="mode-label"><i /> PUBLIC DEMO</span>
              <h3>Built for reliable access</h3>
              <p>Render runs the interface and resumable producer. Supabase keeps event history outside Render&apos;s ephemeral filesystem.</p>
              <ul><li>One event per minute while Render is awake</li><li>50,000-row cap with 35-day rolling retention</li><li>Writes stop automatically at 200 MB</li></ul>
            </article>
          </div>
        </div>
      </section>

      <section className="reliability section-shell" id="reliability" aria-labelledby="reliability-title">
        <div className="section-intro reliability-intro">
          <p className="eyebrow">ENGINEERING BEYOND THE HAPPY PATH</p>
          <h2 id="reliability-title">Designed to recover, explain, and prove.</h2>
          <p>Open a topic to see how the implementation handles real operational concerns.</p>
        </div>
        <div className="accordion-list">
          <details open>
            <summary><span>01</span><strong>Replay and recovery</strong><i>+</i></summary>
            <p>Raw events remain immutable. Checkpoints resume normal processing, while a new consumer group and checkpoint enable controlled replay without mutating history.</p>
          </details>
          <details>
            <summary><span>02</span><strong>Data quality</strong><i>+</i></summary>
            <p>Schema contracts, watermark-based deduplication, quarantine routing, freshness checks, and dbt assertions protect every serving model.</p>
          </details>
          <details>
            <summary><span>03</span><strong>Idempotent publication</strong><i>+</i></summary>
            <p>Kafka offsets commit only after database writes succeed, event IDs prevent duplicates, and Gold publication replaces serving tables only after a complete source frame is ready.</p>
          </details>
          <details>
            <summary><span>04</span><strong>Cost-aware deployment</strong><i>+</i></summary>
            <p>The public service accepts Render cold starts and uses an external PostgreSQL lease. A one-minute cadence, bounded retention, and a 200 MB write guard preserve the behavior recruiters need without risking the 500 MB free database quota.</p>
          </details>
        </div>
      </section>

      <section className="final-cta">
        <div className="section-shell">
          <div><p className="eyebrow">EXPLORE THE IMPLEMENTATION</p><h2>Follow every decision into the code.</h2></div>
          <p>The repository includes event contracts, streaming notebooks, dbt models, Airflow orchestration, dashboard provisioning, tests, and deployment guidance.</p>
          <a className="button button-primary" href="https://github.com/dangvq-daniel/e-commerce-lakehouse" target="_blank" rel="noreferrer">Open GitHub repository <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark" aria-hidden="true">EL</span><span className="brand-copy"><strong>E-commerce Lakehouse</strong><small>Built with synthetic data</small></span></a>
        <p>Render + Supabase public demo · canonical lakehouse architecture in the repository</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
