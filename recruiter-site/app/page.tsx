"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  SiApacheairflow,
  SiApachekafka,
  SiApachespark,
  SiDatabricks,
  SiDbt,
  SiMetabase,
  SiPostgresql,
  SiPython,
  SiRender,
  SiSupabase,
} from "react-icons/si";
import {
  FiArrowDown,
  FiArrowRight,
  FiCheck,
  FiChevronRight,
  FiCode,
  FiDatabase,
  FiDownload,
  FiExternalLink,
  FiShield,
} from "react-icons/fi";
import evidence from "@/public/evidence/verified-local-run.json";
import {
  BrandId,
  journeyStages,
  technologyEvidence,
  TechnologyEvidence,
  TechnologyId,
} from "@/lib/platform-evidence";

type RangeKey = "24H" | "7D" | "30D";
type ArchitectureMode = "local" | "cloud";
type AnalyticsView = "performance" | "events";
type EvidenceTab = "summary" | "proof" | "code";

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
    nextEventInSeconds: number;
    writeCadenceSeconds: number;
    eventCap: number;
    retentionDays: number;
    databaseSizeBytes: number;
    databaseQuotaBytes: number;
    writePaused: boolean;
  };
};

type RecentEvent = LiveAnalytics["recentEvents"][number];

const architectureGroups: { step: string; label: string; technologies: TechnologyId[] }[] = [
  { step: "01", label: "Ingest", technologies: ["simulator", "kafka"] },
  { step: "02", label: "Refine", technologies: ["compute", "bronze", "silver"] },
  { step: "03", label: "Model", technologies: ["dbt", "gold"] },
  { step: "04", label: "Serve", technologies: ["postgres", "metabase"] },
];

function signalForEvent(event: RecentEvent) {
  const profiles: Record<string, { label: string; route: string; action: string }> = {
    purchase: {
      label: "Purchase completed",
      route: "Revenue fact recalculated",
      action: `${event.value} added to sales views`,
    },
    refund: {
      label: "Refund issued",
      route: "Net revenue adjusted",
      action: `${event.value} removed from sales views`,
    },
    inventory_update: {
      label: "Inventory changed",
      route: "Stock position recalculated",
      action: "Availability views updated",
    },
    product_view: {
      label: "Product viewed",
      route: "Demand signal recorded",
      action: "Product interest views updated",
    },
    page_view: {
      label: "Page viewed",
      route: "Session activity recorded",
      action: "Traffic views updated",
    },
    add_to_cart: {
      label: "Item added to cart",
      route: "Funnel stage advanced",
      action: "Cart-conversion views updated",
    },
    checkout_started: {
      label: "Checkout started",
      route: "Checkout intent recorded",
      action: "Funnel views updated",
    },
    session_started: {
      label: "Session started",
      route: "Traffic session opened",
      action: "Active-session views updated",
    },
    customer_created: {
      label: "Customer created",
      route: "Customer dimension updated",
      action: "Customer views refreshed",
    },
    customer_signup: {
      label: "Customer signed up",
      route: "Customer dimension updated",
      action: "Acquisition views refreshed",
    },
    product_review: {
      label: "Product reviewed",
      route: "Product engagement recorded",
      action: "Product feedback views updated",
    },
    product_created: {
      label: "Product created",
      route: "Product dimension updated",
      action: "Catalog views refreshed",
    },
    price_update: {
      label: "Product price changed",
      route: "Product dimension updated",
      action: "Pricing views refreshed",
    },
  };
  return profiles[event.type] ?? {
    label: event.type.replaceAll("_", " "),
    route: "Event validated and published",
    action: "Relevant business views refreshed",
  };
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
];

const iconByBrand = {
  python: SiPython,
  kafka: SiApachekafka,
  spark: SiApachespark,
  databricks: SiDatabricks,
  dbt: SiDbt,
  postgres: SiPostgresql,
  metabase: SiMetabase,
  airflow: SiApacheairflow,
  supabase: SiSupabase,
  render: SiRender,
} as const;

function BrandMark({ brand, compact = false }: { brand: BrandId; compact?: boolean }) {
  if (brand === "delta") {
    return (
      <span className={`brand-mark brand-delta ${compact ? "compact" : ""}`} aria-label="Delta Lake">
        <Image src="/brand/delta-lake-logo.png" alt="" width={36} height={36} />
      </span>
    );
  }
  const Icon = iconByBrand[brand];
  return (
    <span className={`brand-mark brand-${brand} ${compact ? "compact" : ""}`} aria-label={brand}>
      <Icon aria-hidden="true" />
    </span>
  );
}

function SectionHeader({
  number,
  eyebrow,
  title,
  copy,
}: {
  number: string;
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="section-header">
      <span className="chapter-number">{number}</span>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function ArchitectureTechnology({
  technology,
  selected,
  onSelect,
}: {
  technology: TechnologyEvidence;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`architecture-technology ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      aria-controls="evidence-inspector"
      onClick={onSelect}
    >
      <span className="node-brands">
        {technology.brands.map((brand) => <BrandMark key={brand} brand={brand} compact />)}
      </span>
      <span>
        <strong>{technology.name}</strong>
      </span>
    </button>
  );
}

function KafkaProof() {
  return (
    <div className="proof-special">
      <div className="topic-list">
        {evidence.kafka.topics.map((topic) => (
          <div key={topic.name}>
            <span className="live-dot" />
            <strong>{topic.name}</strong>
            <small>{topic.partitions} partitions</small>
          </div>
        ))}
      </div>
      <div className="producer-consumer">
        <span>Python producer</span><FiArrowRight /><strong>purchase_events</strong><FiArrowRight /><span>Spark consumer</span>
      </div>
      <pre><code>{JSON.stringify(evidence.kafka.example.payload, null, 2)}</code></pre>
    </div>
  );
}

function ComputeProof() {
  return (
    <div className="job-proof">
      <div className="job-summary">
        <span>Kafka / Bronze</span><strong>{evidence.spark.bronzeInputRows.toLocaleString()}</strong><small>input rows</small>
        <FiArrowRight />
        <span>Validated Silver</span><strong>{evidence.spark.silverOutputRows.toLocaleString()}</strong><small>output rows</small>
      </div>
      <div className="execution-bars">
        <div><span>Bronze ingestion</span><i style={{ width: "35%" }} /><strong>{evidence.spark.bronzeDurationSeconds}s</strong></div>
        <div><span>Silver transform</span><i style={{ width: "92%" }} /><strong>{evidence.spark.silverDurationSeconds}s</strong></div>
      </div>
      <p className="honesty-note"><SiDatabricks /> Databricks notebooks and an Asset Bundle are packaged; this captured run used local Apache Spark.</p>
    </div>
  );
}

function DbtProof() {
  return (
    <div className="proof-special">
      <div className="lineage-track" aria-label="dbt model lineage">
        {evidence.dbt.lineage.map((model, index) => (
          <div key={model}>
            <span>{model}</span>
            {index < evidence.dbt.lineage.length - 1 ? <FiArrowRight /> : null}
          </div>
        ))}
      </div>
      <div className="test-score">
        <span><FiCheck /> dbt test</span>
        <strong>{evidence.dbt.passingTests} / {evidence.dbt.tests} passing</strong>
        <i><span style={{ width: `${(evidence.dbt.passingTests / evidence.dbt.tests) * 100}%` }} /></i>
      </div>
    </div>
  );
}

function AirflowProof() {
  const stages = [
    ["01", "Capture", "Spark writes Bronze + Silver"],
    ["02", "Model", "dbt builds Gold"],
    ["03", "Check", "Quality gates must pass"],
    ["04", "Publish", "PostgreSQL is refreshed"],
  ];
  return (
    <div className="simple-dag" aria-label="Airflow pipeline sequence">
      {stages.map(([step, label, output], index) => (
        <div key={label}>
          <span className="task-state"><FiCheck /></span>
          <span><small>{step}</small><strong>{label}</strong><p>{output}</p></span>
          {index < stages.length - 1 ? <FiArrowRight className="dag-arrow" /> : null}
        </div>
      ))}
    </div>
  );
}

function PostgresProof() {
  return (
    <div className="proof-special">
      <div className="warehouse-tables">
        {evidence.postgresql.tables.map((table) => (
          <div key={table.name}><FiDatabase /><span>{table.name}</span><strong>{table.rows.toLocaleString()}</strong></div>
        ))}
      </div>
      <pre><code>{evidence.postgresql.exampleQuery}</code></pre>
    </div>
  );
}

function EvidenceInspector({
  technology,
  activeTab,
  onTabChange,
}: {
  technology: TechnologyEvidence;
  activeTab: EvidenceTab;
  onTabChange: (tab: EvidenceTab) => void;
}) {
  return (
    <article className="evidence-inspector" id="evidence-inspector" key={technology.id} aria-live="polite">
      <div className="inspector-heading">
        <div className="proof-brand">
          {technology.brands.map((brand) => <BrandMark key={brand} brand={brand} />)}
        </div>
        <div>
          <span className="status-pill"><FiCheck /> {technology.status}</span>
          <h3>{technology.name}</h3>
          <p>{technology.subtitle}</p>
        </div>
      </div>

      <div className="evidence-tabs" role="tablist" aria-label={`${technology.name} evidence`}>
        {(["summary", "proof", "code"] as EvidenceTab[]).map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            key={tab}
            onClick={() => onTabChange(tab)}
          >
            {tab === "proof" ? "Run proof" : tab}
          </button>
        ))}
      </div>

      <div className={`inspector-body ${activeTab}`}>
        {activeTab === "summary" ? (
          <>
            <p className="inspector-purpose">{technology.role}</p>

            <div className="io-flow">
              <div><span>INPUT</span><strong>{technology.input}</strong></div>
              <FiArrowRight />
              <div><span>OUTPUT</span><strong>{technology.output}</strong></div>
            </div>

          </>
        ) : null}

        {activeTab === "proof" ? (
          <div className="inspector-proof">
            {technology.id === "kafka" ? <KafkaProof /> : null}
            {technology.id === "compute" ? <ComputeProof /> : null}
            {technology.id === "dbt" ? <DbtProof /> : null}
            {technology.id === "airflow" ? <AirflowProof /> : null}
            {technology.id === "postgres" ? <PostgresProof /> : null}
            {!["kafka", "compute", "dbt", "airflow", "postgres"].includes(technology.id) ? (
              <div className="artifact-proof">
                <FiCheck />
                <span>CAPTURED IMPLEMENTATION</span>
                <strong>{technology.metrics.map((metric) => `${metric.label}: ${metric.value}`).join(" · ")}</strong>
                <p>The downloadable evidence file records this output from the verified local run.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "code" ? (
          <div className="code-artifact">
            <div><FiCode /><span>{technology.artifactLabel}</span><code>{technology.artifactPath}</code></div>
            <pre><code>{technology.code}</code></pre>
          </div>
        ) : null}
      </div>

      <a className="inspector-source" href={technology.sourceHref} target="_blank" rel="noreferrer">
        Open implementation <FiExternalLink />
      </a>
    </article>
  );
}

function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="bar-chart" aria-label="Revenue trend">
      {values.map((value, index) => (
        <div key={`${labels[index]}-${index}`}>
          <i style={{ height: `${Math.max(5, (value / max) * 100)}%` }} />
          <span>{labels[index]}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [range, setRange] = useState<RangeKey>("24H");
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>("performance");
  const [liveData, setLiveData] = useState<LiveAnalytics | null>(null);
  const [secondsUntilNext, setSecondsUntilNext] = useState(60);
  const [journeyIndex, setJourneyIndex] = useState(0);
  const [selectedTechnology, setSelectedTechnology] = useState<TechnologyId>("kafka");
  const [architectureMode, setArchitectureMode] = useState<ArchitectureMode>("local");
  const [evidenceTab, setEvidenceTab] = useState<EvidenceTab>("summary");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/analytics?range=${range}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`analytics returned ${response.status}`);
        const next = (await response.json()) as LiveAnalytics;
        if (!cancelled) {
          setLiveData(next);
          setSecondsUntilNext(next.runtime.nextEventInSeconds);
        }
      } catch {
        if (!cancelled) setLiveData(null);
      }
    };
    void load();
    const refresh = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [range]);

  useEffect(() => {
    const countdown = window.setInterval(() => {
      setSecondsUntilNext((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(countdown);
  }, []);

  const snapshot = liveData?.snapshot ?? fallbackSnapshots[range];
  const recentEvents = liveData?.recentEvents ?? fallbackEvents;
  const latestEvent = recentEvents[0] ?? fallbackEvents[0];
  const liveSignal = signalForEvent(latestEvent);
  const runtime = liveData?.runtime;
  const currentJourney = journeyStages[journeyIndex];
  const selectedNode = useMemo(
    () => technologyEvidence.find((technology) => technology.id === selectedTechnology) ?? technologyEvidence[1],
    [selectedTechnology],
  );
  const airflow = technologyEvidence.find((technology) => technology.id === "airflow")!;
  const technologyById = (id: TechnologyId) =>
    technologyEvidence.find((technology) => technology.id === id)!;
  const selectTechnology = (id: TechnologyId) => {
    setSelectedTechnology(id);
    setEvidenceTab("summary");
  };
  const storagePercent = runtime
    ? Math.min(100, Math.round((runtime.databaseSizeBytes / runtime.databaseQuotaBytes) * 100))
    : 0;

  return (
    <main id="top">
      <header className="site-header">
        <a className="identity" href="#top" aria-label="E-commerce Lakehouse home">
          <span>EL</span>
          <div><strong>E-commerce Lakehouse</strong><small>Data engineering portfolio</small></div>
        </a>
        <nav aria-label="Portfolio chapters">
          <a href="#business"><span>01</span> Business</a>
          <a href="#journey"><span>02</span> Journey</a>
          <a href="#engineering"><span>03</span> Engineering</a>
          <a href="#analytics"><span>04</span> Analytics</a>
          <a href="#reliability"><span>05</span> Reliability</a>
        </nav>
        <a className="source-link" href="https://github.com/dangvq-daniel/e-commerce-lakehouse" target="_blank" rel="noreferrer">
          Source <FiExternalLink />
        </a>
      </header>

      <section className="hero section-shell" id="business" aria-labelledby="business-title">
        <div className="hero-copy">
          <div className="live-label"><span className="live-dot" /> Public demo online · full stack verified locally</div>
          <p className="eyebrow">01 · ONE VERIFIED ORDER, END TO END</p>
          <h1 id="business-title">Follow one order through a modern data platform.</h1>
          <p className="hero-lead">
            See an actual purchase become a governed sales fact, then inspect the code, metrics, and run evidence
            behind every step.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#journey">Trace the order <FiArrowRight /></a>
            <a className="button secondary" href="#engineering">Inspect the proof</a>
          </div>
          <p className="hero-proof"><FiCheck /> Verified locally from raw event through published sales fact.</p>
        </div>
        <aside
          className="order-to-action"
          aria-label="Latest live business signal"
          aria-live="polite"
          key={`${latestEvent.id}-${latestEvent.time}`}
        >
          <div className="signal-heading">
            <span className="brief-kicker">LIVE BUSINESS SIGNAL</span>
            <span className="verified-badge"><span className="live-dot" /> {latestEvent.status}</span>
          </div>
          <div className="signal-order">
            <div><span>LATEST EVENT</span><code>{latestEvent.id}</code></div>
            <strong>{latestEvent.value}</strong>
            <p>{latestEvent.time} · {latestEvent.type.replaceAll("_", " ")}</p>
          </div>
          <div className="signal-flow">
            <div><span>01</span><p><small>EVENT RECEIVED</small><strong>{liveSignal.label}</strong></p></div>
            <FiArrowDown />
            <div><span>02</span><p><small>PIPELINE ACTION</small><strong>{liveSignal.route}</strong></p></div>
            <FiArrowDown />
            <div><span>03</span><p><small>BUSINESS EFFECT</small><strong>{liveSignal.action}</strong></p></div>
          </div>
          <p className="signal-result"><FiShield /> Refreshed from durable PostgreSQL event history.</p>
        </aside>
      </section>

      <section className="business-kpis" aria-label="Live public demo KPIs">
        <div className="section-shell kpi-strip">
          <div><span>Net revenue · {range}</span><strong>{snapshot.revenue}</strong><small>Purchases less refunds</small></div>
          <div><span>Completed orders</span><strong>{snapshot.orders}</strong><small>Transactional demand</small></div>
          <div className="stream-kpi">
            <span>Public demo stream</span>
            <strong><i className="live-dot" /> {runtime?.state ?? "waking"}</strong>
            <small>{runtime ? `${runtime.totalEvents.toLocaleString()} durable events` : "Connecting to Supabase"}</small>
          </div>
        </div>
      </section>

      <section className="journey section-shell" id="journey" aria-labelledby="journey-title">
        <SectionHeader
          number="02"
          eyebrow="DATA JOURNEY"
          title="One order. Five understandable steps."
          copy="Move from the customer action to the business decision. Each step shows only the record, owner, and proof needed to understand the change."
        />
        <div className="order-passport">
          <span>TRACE ID</span><code>evt_23b020fa530b31170bb76f376b608492</code>
          <span>ORDER</span><code>ord_cc83d8c1bc032a018d449bf3754b97f6</code>
          <strong>Verified local record</strong>
        </div>
        <div className="journey-workspace">
          <div className="journey-rail" role="tablist" aria-label="Order journey stages">
            {journeyStages.map((stage, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={journeyIndex === index}
                key={stage.id}
                onClick={() => setJourneyIndex(index)}
              >
                <span>{stage.step}</span>
                <BrandMark brand={stage.brand} compact />
                <div><strong>{stage.label}</strong><small>{stage.technology}</small></div>
                <FiChevronRight />
              </button>
            ))}
          </div>
          <article className="journey-detail" key={currentJourney.id}>
            <div className="journey-title-row">
              <BrandMark brand={currentJourney.brand} />
              <div><span>STAGE {currentJourney.step}</span><h3>{currentJourney.label}</h3></div>
            </div>
            <p>{currentJourney.explanation}</p>
            <div className="journey-proof"><FiCheck /><span>IMPLEMENTATION FOOTPRINT</span><strong>{currentJourney.proof}</strong></div>
            <div className="record-window">
              <div><span /><span /><span /><strong>{currentJourney.technology} output</strong></div>
              <pre><code>{currentJourney.record}</code></pre>
            </div>
            <div className="journey-controls">
              <span>{journeyIndex + 1} of {journeyStages.length}</span>
              <button
                type="button"
                onClick={() => setJourneyIndex((journeyIndex + 1) % journeyStages.length)}
              >
                {journeyIndex === journeyStages.length - 1 ? "Restart journey" : "Next transformation"} <FiArrowRight />
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="engineering" id="engineering" aria-labelledby="engineering-title">
        <div className="section-shell">
          <SectionHeader
            number="03"
            eyebrow="LAKEHOUSE ENGINEERING"
            title="Four stages. One readable system."
            copy="Select a technology to inspect its responsibility, run evidence, and source."
          />

          <div className="engineering-summary">
            <div className="engineering-summary-heading">
              <span className="summary-icon"><FiShield /></span>
              <div>
                <span>VERIFIED LOCAL RUN</span>
                <strong>Every technology links to captured evidence and working code.</strong>
              </div>
            </div>
            <a href="/evidence/verified-local-run.json" download><FiDownload /> Evidence JSON</a>
          </div>

          <div className="environment-tabs" aria-label="Choose architecture environment">
            <button type="button" aria-pressed={architectureMode === "local"} onClick={() => setArchitectureMode("local")}>
              <strong>Full local lakehouse</strong><span>Verified end to end</span>
            </button>
            <button type="button" aria-pressed={architectureMode === "cloud"} onClick={() => setArchitectureMode("cloud")}>
              <strong>Public cloud demo</strong><span>Render + Supabase</span>
            </button>
          </div>

          {architectureMode === "local" ? (
            <div className="architecture-workspace">
              <div className="architecture-overview">
                <div className="architecture-overview-heading">
                  <div>
                    <span>END-TO-END DATA FLOW</span>
                    <h3>Ingest, refine, model, serve.</h3>
                  </div>
                  <p>Choose a technology</p>
                </div>

                <button
                  type="button"
                  className={`architecture-control ${selectedTechnology === airflow.id ? "selected" : ""}`}
                  onClick={() => selectTechnology(airflow.id)}
                >
                  <BrandMark brand="airflow" />
                  <span><small>CONTROL PLANE</small><strong>Airflow schedules and retries the workflow</strong></span>
                </button>

                <div className="architecture-flow" aria-label="Data plane architecture">
                  {architectureGroups.map((group) => (
                    <article className="architecture-zone" key={group.step}>
                      <span className="zone-step">{group.step}</span>
                      <h4>{group.label}</h4>
                      <div className="zone-technology-list">
                        {group.technologies.map((id) => (
                          <ArchitectureTechnology
                            key={id}
                            technology={technologyById(id)}
                            selected={selectedTechnology === id}
                            onSelect={() => selectTechnology(id)}
                          />
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <EvidenceInspector technology={selectedNode} activeTab={evidenceTab} onTabChange={setEvidenceTab} />
            </div>
          ) : (
            <div className="cloud-proof">
              <div className="cloud-flow">
                <article><em>01</em><BrandMark brand="render" /><span>Render</span><strong>Resumable event simulator</strong><small>1 budget-safe write / minute</small></article>
                <article><em>02</em><BrandMark brand="supabase" /><span>Supabase</span><strong>Durable PostgreSQL history</strong><small>{runtime?.totalEvents.toLocaleString() ?? "Live"} stored events</small></article>
                <article><em>03</em><BrandMark brand="render" /><span>Render</span><strong>Recruiter data product</strong><small>Live analytics + proof artifact</small></article>
              </div>
              <div className="cloud-boundary">
                <FiShield />
                <div>
                  <strong>Cost boundary: intentionally not the full architecture</strong>
                  <p>Kafka, Spark/Databricks, Delta, dbt, Airflow, and Metabase are proven by the captured local run—not falsely represented as free-tier cloud services.</p>
                </div>
              </div>
              <div className="cloud-metrics">
                <div><span>Write cadence</span><strong>1 / {runtime?.writeCadenceSeconds ?? 60}s</strong></div>
                <div><span>Storage used</span><strong>{storagePercent}%</strong></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="analytics section-shell" id="analytics" aria-labelledby="analytics-title">
        <SectionHeader
          number="04"
          eyebrow="BUSINESS ANALYTICS"
          title="Curated facts become decisions, not just charts."
          copy="The public demo reads durable PostgreSQL history. Every view is paired with the business question it answers."
        />
        <div className="analytics-toolbar">
          <div role="group" aria-label="Choose analytics view">
            <button type="button" aria-pressed={analyticsView === "performance"} onClick={() => setAnalyticsView("performance")}>Performance</button>
            <button type="button" aria-pressed={analyticsView === "events"} onClick={() => setAnalyticsView("events")}>Latest events</button>
          </div>
          <div role="group" aria-label="Choose reporting period">
            {(["24H", "7D", "30D"] as RangeKey[]).map((key) => (
              <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}>{key}</button>
            ))}
          </div>
        </div>

        {analyticsView === "performance" ? (
          <div className="analytics-grid">
            <article className="trend-card">
              <div className="card-heading"><div><span>EXECUTIVE QUESTION</span><h3>Is commercial performance healthy?</h3></div><strong>{snapshot.revenue}</strong></div>
              <BarChart values={snapshot.chart} labels={snapshot.labels} />
              <div className="decision-caption"><FiCheck /><p><strong>Decision output</strong> Compare revenue movement with order volume and average order value before investigating category mix.</p></div>
            </article>
            <article className="category-card">
              <div className="card-heading"><div><span>MERCHANDISING QUESTION</span><h3>Which categories drive revenue?</h3></div></div>
              <div className="category-list">
                {snapshot.categories.map((category, index) => (
                  <div key={category.name}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{category.name}</strong>
                    <i><span style={{ width: `${category.share}%` }} /></i>
                    <b>{category.value}</b>
                  </div>
                ))}
              </div>
              <div className="decision-caption"><FiCheck /><p><strong>Decision output</strong> Prioritize stock, campaigns, and product analysis around the highest-value categories.</p></div>
            </article>
          </div>
        ) : (
          <article className="event-table-card">
            <div className="event-table-heading">
              <div><span className="live-dot" /><strong>Live PostgreSQL event history</strong></div>
              <p>Next budget-safe write in <strong>{runtime?.writePaused ? "paused" : `${secondsUntilNext}s`}</strong></p>
            </div>
            <div className="event-table">
              <div className="event-row table-head"><span>Time</span><span>Event</span><span>Event ID</span><span>Value</span><span>Status</span></div>
              {recentEvents.map((event) => (
                <div className="event-row" key={`${event.id}-${event.time}`}>
                  <code>{event.time}</code><strong>{event.type.replaceAll("_", " ")}</strong><code>{event.id}</code><span>{event.value}</span><em>{event.status}</em>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>

      <section className="reliability" id="reliability" aria-labelledby="reliability-title">
        <div className="section-shell">
          <SectionHeader
            number="05"
            eyebrow="ENGINEERING RELIABILITY"
            title="One DAG, four responsibilities."
            copy="Airflow coordinates the work; it does not transform the data. Read the run from left to right, then see the two recovery paths that protect the result."
          />
          <div className="dag-story">
            <div className="dag-story-heading">
              <div><BrandMark brand="airflow" /><span><small>LAST VERIFIED RUN</small><strong>Completed successfully</strong></span></div>
              <p>Airflow controls order and retries. Spark and dbt perform the work.</p>
            </div>
            <div className="dag-sequence" aria-label="Airflow DAG">
              {[
                ["01", "Capture", "Kafka → Bronze and Silver"],
                ["02", "Model", "Silver → dbt → Gold"],
                ["03", "Validate", "Quality checks approve Gold"],
                ["04", "Publish", "Gold → PostgreSQL"],
              ].map(([step, label, output], index) => (
                <article key={label}>
                  <span>{step}</span>
                  <div><i><FiCheck /></i><strong>{label}</strong><p>{output}</p></div>
                  {index < 3 ? <FiArrowRight /> : null}
                </article>
              ))}
            </div>
          </div>
          <div className="recovery-paths">
            <article>
              <span>IF DATA IS INVALID</span>
              <strong>Quarantine it, keep Bronze intact.</strong>
              <p>The valid stream continues while the rejected record keeps its failure reason for investigation.</p>
            </article>
            <article>
              <span>IF A TASK FAILS</span>
              <strong>Retry from the last durable boundary.</strong>
              <p>Kafka offsets, Spark checkpoints, and keyed merges prevent a retry from duplicating business facts.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div>
          <p className="eyebrow">EXPLORE THE IMPLEMENTATION</p>
          <h2>The diagrams are now entry points into working code.</h2>
          <p>Review the captured evidence, follow the repository artifacts, or run the complete lakehouse locally with Docker Compose.</p>
        </div>
        <div>
          <a className="button primary" href="https://github.com/dangvq-daniel/e-commerce-lakehouse" target="_blank" rel="noreferrer">
            Open repository <FiExternalLink />
          </a>
          <a className="button secondary" href="/evidence/verified-local-run.json">
            Evidence artifact <FiDownload />
          </a>
        </div>
      </section>

      <footer>
        <a className="identity" href="#top"><span>EL</span><div><strong>E-commerce Lakehouse</strong><small>Synthetic data · documented evidence</small></div></a>
        <p>Render + Supabase public demo · full local lakehouse in the repository</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
