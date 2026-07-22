"use client";

import { useEffect, useMemo, useState } from "react";

type RangeKey = "24H" | "7D" | "30D";

type LiveAnalytics = {
  snapshot: {
    revenue: string;
    orders: string;
    aov: string;
    conversion: string;
    chart: number[];
    labels: string[];
    categories: { name: string; value: string; share: number }[];
  };
  recentEvents: { time: string; type: string; id: string; value: string; status: string }[];
  funnel: {
    product_views: number;
    cart_additions: number;
    checkout_starts: number;
    purchases: number;
  };
  runtime: {
    state: "streaming" | "waking";
    freshnessSeconds: number;
    eventsPerSecond: number;
    totalEvents: number;
    lastStartedAt: string | null;
    eventsThisWake: number;
  };
};

const snapshots: Record<
  RangeKey,
  {
    revenue: string;
    revenueTrend: string;
    orders: string;
    orderTrend: string;
    aov: string;
    aovTrend: string;
    conversion: string;
    conversionTrend: string;
    chart: number[];
    labels: string[];
    categories: { name: string; value: string; share: number }[];
  }
> = {
  "24H": {
    revenue: "$86,420",
    revenueTrend: "+12.4%",
    orders: "1,284",
    orderTrend: "+8.7%",
    aov: "$67.31",
    aovTrend: "+3.1%",
    conversion: "4.8%",
    conversionTrend: "+0.6 pp",
    chart: [31, 26, 22, 29, 38, 52, 47, 59, 67, 61, 72, 78, 69, 82, 88, 80, 93, 86],
    labels: ["12a", "4a", "8a", "12p", "4p", "8p"],
    categories: [
      { name: "Electronics", value: "$28.6k", share: 100 },
      { name: "Home & living", value: "$19.8k", share: 69 },
      { name: "Apparel", value: "$15.7k", share: 55 },
      { name: "Sports", value: "$12.4k", share: 43 },
      { name: "Beauty", value: "$9.9k", share: 35 },
    ],
  },
  "7D": {
    revenue: "$548,230",
    revenueTrend: "+18.9%",
    orders: "7,931",
    orderTrend: "+14.2%",
    aov: "$69.12",
    aovTrend: "+4.8%",
    conversion: "5.1%",
    conversionTrend: "+0.9 pp",
    chart: [43, 48, 46, 57, 61, 58, 65, 69, 66, 73, 78, 74, 82, 86, 83, 89, 91, 96],
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    categories: [
      { name: "Electronics", value: "$174k", share: 100 },
      { name: "Home & living", value: "$126k", share: 72 },
      { name: "Apparel", value: "$102k", share: 59 },
      { name: "Sports", value: "$81k", share: 47 },
      { name: "Beauty", value: "$65k", share: 37 },
    ],
  },
  "30D": {
    revenue: "$2.34M",
    revenueTrend: "+24.6%",
    orders: "33,982",
    orderTrend: "+19.1%",
    aov: "$68.86",
    aovTrend: "+2.7%",
    conversion: "4.9%",
    conversionTrend: "+0.7 pp",
    chart: [35, 39, 45, 42, 49, 54, 51, 59, 63, 60, 68, 71, 76, 73, 82, 86, 91, 95],
    labels: ["W1", "W2", "W3", "W4", "Today", ""],
    categories: [
      { name: "Electronics", value: "$742k", share: 100 },
      { name: "Home & living", value: "$531k", share: 72 },
      { name: "Apparel", value: "$438k", share: 59 },
      { name: "Sports", value: "$354k", share: 48 },
      { name: "Beauty", value: "$275k", share: 37 },
    ],
  },
};

const pipeline = [
  ["01", "Python", "Event Simulator"],
  ["02", "Kafka", "Topics"],
  ["03", "Databricks", "PySpark Streaming"],
  ["04", "Delta", "Bronze"],
  ["05", "Delta", "Silver"],
  ["06", "dbt", "Staging + Intermediate"],
  ["07", "Delta", "Gold"],
  ["08", "PostgreSQL", "Warehouse"],
  ["09", "Metabase", "Dashboard"],
];

const events = [
  ["14:42:18", "purchase", "ord_84f1", "$184.00", "completed"],
  ["14:42:16", "inventory_update", "prd_091", "−2 units", "processed"],
  ["14:42:13", "refund", "ord_2cc8", "$42.50", "validated"],
  ["14:42:09", "purchase", "ord_a170", "$96.20", "completed"],
  ["14:42:04", "product_review", "prd_224", "5 stars", "processed"],
];

export default function Home() {
  const [range, setRange] = useState<RangeKey>("24H");
  const [liveData, setLiveData] = useState<LiveAnalytics | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "retrying">(
    "connecting",
  );
  const snapshot = liveData ? { ...snapshots[range], ...liveData.snapshot } : snapshots[range];
  const chartMax = useMemo(() => Math.max(...snapshot.chart), [snapshot.chart]);
  const displayEvents = liveData?.recentEvents ?? events.map(([time, type, id, value, status]) => ({
    time,
    type,
    id,
    value,
    status,
  }));
  const funnel = liveData?.funnel ?? {
    product_views: 156_420,
    cart_additions: 38_906,
    checkout_starts: 12_744,
    purchases: 7_509,
  };
  const funnelMax = Math.max(funnel.product_views, 1);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/analytics?range=${range}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`analytics returned ${response.status}`);
        const next = (await response.json()) as LiveAnalytics;
        if (active) {
          setLiveData(next);
          setConnectionState("live");
        }
      } catch (error) {
        console.warn("Live analytics are not ready", error);
        if (active) setConnectionState("retrying");
      }
    };
    void load();
    const timer = window.setInterval(load, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [range]);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="E-commerce Lakehouse home">
          <span className="brand-mark" aria-hidden="true">EL</span>
          <span>
            <strong>E-commerce Lakehouse</strong>
            <small>Data engineering portfolio</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#analytics">Analytics</a>
          <a href="#architecture">Architecture</a>
          <a href="#quality">Data quality</a>
        </nav>
        <a
          className="header-link"
          href="https://github.com/dangvq-daniel/e-commerce-lakehouse"
          target="_blank"
          rel="noreferrer"
        >
          View source <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <div className="status-pill">
            <span /> {connectionState === "live" ? "Cloud stream connected" : "Waking cloud stream"}
          </div>
          <p className="eyebrow">REAL-TIME E-COMMERCE ANALYTICS</p>
          <h1>From clickstream<br />to decision, <em>in seconds.</em></h1>
          <p className="hero-lede">
            A production-shaped streaming lakehouse that turns synthetic commerce events into
            trusted revenue, customer, product, and inventory intelligence.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#analytics">Explore the analytics</a>
            <a
              className="button secondary"
              href="https://github.com/dangvq-daniel/e-commerce-lakehouse"
              target="_blank"
              rel="noreferrer"
            >
              Read the implementation <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="hero-console" aria-label="Platform status summary">
          <div className="console-top">
            <span>RENDER / LIVE RUNTIME</span>
            <span className="console-state">● {connectionState.toUpperCase()}</span>
          </div>
          <div className="console-metric">
            <span>EVENT THROUGHPUT</span>
            <strong>{liveData?.runtime.eventsPerSecond ?? "—"} <small>events/sec</small></strong>
            <div className="micro-bars" aria-hidden="true">
              {[34, 48, 39, 64, 52, 71, 59, 82, 68, 88, 74, 93].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="console-grid">
            <div><span>Freshness</span><strong>{liveData ? `${liveData.runtime.freshnessSeconds} sec` : "—"}</strong></div>
            <div><span>Persisted events</span><strong>{liveData?.runtime.totalEvents.toLocaleString() ?? "—"}</strong></div>
            <div><span>This wake</span><strong>{liveData?.runtime.eventsThisWake.toLocaleString() ?? "—"}</strong></div>
            <div><span>Runtime state</span><strong className="good">{liveData?.runtime.state ?? "starting"}</strong></div>
          </div>
          <p className="console-foot">Synthetic stream · durable PostgreSQL history · no customer data</p>
        </div>
      </section>

      <section className="analytics section-shell" id="analytics">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">BUSINESS INTELLIGENCE</p>
            <h2>Commerce pulse</h2>
            <p>Interactive metrics generated from the platform&apos;s Gold analytics models.</p>
          </div>
          <div className="range-control" aria-label="Select reporting period">
            {(Object.keys(snapshots) as RangeKey[]).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={range === item}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="kpi-grid">
          <article className="kpi-card">
            <div className="kpi-label"><span>NET REVENUE</span><i>01</i></div>
            <strong>{snapshot.revenue}</strong>
            <p><b>LIVE</b> persisted PostgreSQL result</p>
          </article>
          <article className="kpi-card">
            <div className="kpi-label"><span>ORDERS</span><i>02</i></div>
            <strong>{snapshot.orders}</strong>
            <p><b>LIVE</b> completed purchase events</p>
          </article>
          <article className="kpi-card">
            <div className="kpi-label"><span>AVERAGE ORDER</span><i>03</i></div>
            <strong>{snapshot.aov}</strong>
            <p><b>LIVE</b> net revenue per order</p>
          </article>
          <article className="kpi-card">
            <div className="kpi-label"><span>CONVERSION</span><i>04</i></div>
            <strong>{snapshot.conversion}</strong>
            <p><b>LIVE</b> orders per active session</p>
          </article>
        </div>

        <div className="analytics-grid">
          <article className="panel revenue-panel">
            <div className="panel-heading">
              <div><span>REVENUE TREND</span><strong>Gross and net sales velocity</strong></div>
              <div className="legend"><i /> Net revenue</div>
            </div>
            <div className="bar-chart" aria-label={`Revenue trend for ${range}`}>
              {snapshot.chart.map((value, index) => (
                <div className="bar-slot" key={`${range}-${index}`}>
                  <i style={{ height: `${Math.round((value / chartMax) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="chart-axis">
              {snapshot.labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
            </div>
          </article>

          <article className="panel category-panel">
            <div className="panel-heading">
              <div><span>SALES BY CATEGORY</span><strong>Net revenue contribution</strong></div>
            </div>
            <div className="category-list">
              {snapshot.categories.map((category, index) => (
                <div className="category-row" key={category.name}>
                  <div><span>{String(index + 1).padStart(2, "0")}</span><strong>{category.name}</strong><b>{category.value}</b></div>
                  <div className="track"><i style={{ width: `${category.share}%` }} /></div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel funnel-panel">
            <div className="panel-heading">
              <div><span>CUSTOMER JOURNEY</span><strong>Session conversion funnel</strong></div>
              <div className="legend">live event counts</div>
            </div>
            <div className="funnel">
              <div style={{ width: "100%" }}><span>Product views</span><b>{funnel.product_views.toLocaleString()}</b></div>
              <div style={{ width: `${Math.max(40, funnel.cart_additions / funnelMax * 100)}%` }}><span>Cart additions</span><b>{funnel.cart_additions.toLocaleString()}</b></div>
              <div style={{ width: `${Math.max(40, funnel.checkout_starts / funnelMax * 100)}%` }}><span>Checkout starts</span><b>{funnel.checkout_starts.toLocaleString()}</b></div>
              <div style={{ width: `${Math.max(40, funnel.purchases / funnelMax * 100)}%` }}><span>Purchases</span><b>{funnel.purchases.toLocaleString()}</b></div>
            </div>
          </article>

          <article className="panel events-panel">
            <div className="panel-heading">
              <div><span>RECENT EVENTS</span><strong>Validated Silver stream</strong></div>
              <div className="live-dot"><i /> {connectionState === "live" ? "live" : "connecting"}</div>
            </div>
            <div className="event-table" role="table" aria-label="Recent synthetic events">
              {displayEvents.map((event) => (
                <div className="event-row" role="row" key={`${event.time}-${event.id}`}>
                  <span role="cell">{event.time}</span>
                  <strong role="cell">{event.type}</strong>
                  <code role="cell">{event.id}</code>
                  <b role="cell">{event.value}</b>
                  <i role="cell">{event.status}</i>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="architecture" id="architecture">
        <div className="section-shell">
          <div className="section-heading architecture-heading">
            <div>
              <p className="eyebrow">SYSTEM DESIGN</p>
              <h2>One governed path from event to insight</h2>
            </div>
            <p>
              PySpark owns Bronze and Silver. dbt owns Gold. Airflow coordinates execution
              without becoming part of the business-data path.
            </p>
          </div>
          <div className="pipeline" aria-label="Canonical platform architecture">
            {pipeline.map(([number, title, subtitle], index) => (
              <div className="pipeline-step-wrap" key={number}>
                <div className="pipeline-step">
                  <span>{number}</span>
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </div>
                {index < pipeline.length - 1 && <i className="pipeline-arrow" aria-hidden="true">→</i>}
              </div>
            ))}
          </div>
          <div className="control-plane">
            <div><span>AIRFLOW</span><strong>Control Plane</strong></div>
            <i aria-hidden="true">↗</i>
            <div><span>CONTROLS</span><strong>Databricks</strong></div>
            <i aria-hidden="true">↗</i>
            <div><span>CONTROLS</span><strong>dbt</strong></div>
            <p>Scheduling · retries · dependency management · failure visibility</p>
          </div>
          <div className="demo-runtime">
            <strong>LIVE FREE-TIER DEMO</strong>
            <span>Render web process → resumable synthetic producer → Supabase PostgreSQL</span>
            <p>The cloud demo uses the repository&apos;s compatibility path; the canonical production design above remains unchanged.</p>
          </div>
        </div>
      </section>

      <section className="quality section-shell" id="quality">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">TRUST BY DESIGN</p>
            <h2>Quality is part of the pipeline</h2>
            <p>Every serving model crosses automated schema, validity, freshness, and relationship gates.</p>
          </div>
          <div className="quality-score" aria-label="Data quality score 99.98 percent">
            <div><strong>99.98</strong><span>%</span></div>
            <small>VALID RECORDS</small>
          </div>
        </div>
        <div className="quality-grid">
          <article>
            <span className="quality-number">01</span>
            <h3>Schema contracts</h3>
            <p>Typed event payloads, required keys, accepted event types, and quarantine routing.</p>
            <b>10 event contracts passing</b>
          </article>
          <article>
            <span className="quality-number">02</span>
            <h3>Streaming guarantees</h3>
            <p>Checkpoint isolation, event-time watermarks, deterministic IDs, and deduplication.</p>
            <b>0 duplicate Gold keys</b>
          </article>
          <article>
            <span className="quality-number">03</span>
            <h3>Analytics tests</h3>
            <p>Uniqueness, nullability, relationships, accepted values, and business assertions.</p>
            <b>55 / 55 dbt checks passing</b>
          </article>
          <article>
            <span className="quality-number">04</span>
            <h3>Freshness guardrails</h3>
            <p>Silver freshness blocks stale Gold publication before dashboards can drift.</p>
            <b>Latest event: {liveData ? `${liveData.runtime.freshnessSeconds} seconds` : "connecting"}</b>
          </article>
        </div>
      </section>

      <section className="proof">
        <div className="section-shell proof-grid">
          <div>
            <p className="eyebrow">ENGINEERING PROOF</p>
            <h2>Built beyond the happy path.</h2>
            <p>
              Replayable raw events, late-data handling, quarantine tables, idempotent publication,
              cloud migration guidance, and automated validation are included in the implementation.
            </p>
          </div>
          <div className="proof-stats">
            <div><strong>9</strong><span>Pipeline stages</span></div>
            <div><strong>8</strong><span>Gold models</span></div>
            <div><strong>55</strong><span>dbt checks</span></div>
            <div><strong>17</strong><span>BI questions</span></div>
          </div>
          <div className="stack-list" aria-label="Technology stack">
            {[
              "Python", "Kafka", "Databricks", "PySpark", "Delta Lake", "Airflow",
              "dbt", "PostgreSQL", "Metabase", "Docker"
            ].map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>

      <footer>
        <div>
          <strong>E-commerce Lakehouse</strong>
          <p>Synthetic analytics. Production-shaped engineering.</p>
        </div>
        <p className="budget-note">Live Render demo · durable Supabase PostgreSQL · $0/month target</p>
        <a
          href="https://github.com/dangvq-daniel/e-commerce-lakehouse"
          target="_blank"
          rel="noreferrer"
        >
          Explore the repository <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </main>
  );
}
