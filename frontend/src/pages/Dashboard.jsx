import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import LiveTicker from "@/components/LiveTicker";
import { fetchKPIs, fetchWells, fetchCases, fetchMemoryQuality } from "@/lib/api";
import { ArrowRightIcon, DropIcon, WarningIcon, ClockCounterClockwiseIcon, CurrencyDollarIcon, GitDiffIcon, ChartLineIcon, DnaIcon, BooksIcon, LightbulbFilamentIcon } from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip, CartesianGrid } from "recharts";

const KpiCard = ({ label, value, sub, icon: Icon, tone = "amber", testId }) => (
  <div className="border border-[#262626] bg-[#121212] p-5" data-testid={testId}>
    <div className="flex justify-between items-start">
      <div className="text-[10px] text-[#71717A] tracking-[0.25em]">{label}</div>
      <Icon size={18} className={tone === "danger" ? "text-[#FF3B30]" : tone === "success" ? "text-[#34C759]" : "text-[#FFB000]"} weight="duotone" />
    </div>
    <div className="font-display text-4xl mt-3">{value}</div>
    {sub && <div className="text-[11px] text-[#A1A1AA] mt-2">{sub}</div>}
  </div>
);

const statusColor = (s) => s === "drilling" ? "#FFB000" : s === "producing" ? "#34C759" : "#71717A";

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [wells, setWells] = useState([]);
  const [cases, setCases] = useState([]);
  const [memory, setMemory] = useState(null);

  useEffect(() => {
    fetchKPIs().then(setKpis);
    fetchWells().then(setWells);
    fetchCases().then(setCases);
    fetchMemoryQuality().then(setMemory);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const eventCounts = cases.reduce((acc, c) => {
    acc[c.event_type] = (acc[c.event_type] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(eventCounts).map(([k, v]) => ({ name: k.replace("_", " "), count: v }));

  return (
    <Layout
      title="Operations Command"
      subtitle="Real-time well status across active operations · Historical case memory active"
      actions={
        <Link to="/recall" className="btn-amber" data-testid="dashboard-open-recall">
          Open Recall Engine <ArrowRightIcon size={12} weight="bold" className="inline ml-1" />
        </Link>
      }
    >
      {/* Positioning strip */}
      <div className="border-l-2 border-[#FFB000] bg-[#1E1E1E] px-4 py-3 mb-4" data-testid="positioning-strip">
        <div className="font-display font-bold text-xs tracking-[0.2em] text-[#FFB000] mb-1">RIGRECALL · EXPERIENCE INTELLIGENCE</div>
        <div className="text-[12px] text-[#E4E4E7]">
          Find similar experiences · Understand what happened · Learn what was tried · See what worked · Verify with evidence
        </div>
      </div>

      {/* Live rig telemetry ticker */}
      <div className="mb-4">
        <LiveTicker />
      </div>

      {/* Organizational Memory Quality */}
      {memory && (
        <div className="border border-[#262626] bg-[#121212] mb-4" data-testid="memory-quality">
          <div className="px-4 py-3 border-b border-[#262626] flex justify-between items-center">
            <div className="font-display font-bold text-sm tracking-widest flex items-center gap-2">
              <BooksIcon size={16} weight="fill" className="text-[#FFB000]" />
              ORGANIZATIONAL MEMORY QUALITY
            </div>
            <div className="text-[10px] tracking-widest text-[#71717A]">COVERAGE {memory.coverage_pct}%</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-[#262626]">
            {[
              ["EXPERIENCES", memory.total_experiences],
              ["DOCUMENTED ACTION", memory.with_documented_action],
              ["KNOWN OUTCOME", memory.with_known_outcome],
              ["WITH EVIDENCE", memory.with_evidence],
              ["CONFLICTING", memory.conflicting_records],
            ].map(([label, val]) => (
              <div key={label} className="p-3" data-testid={`mq-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="text-[9px] tracking-widest text-[#71717A]">{label}</div>
                <div className="font-display text-2xl">{val}</div>
              </div>
            ))}
          </div>
          {memory.knowledge_gaps.length > 0 && (
            <div className="border-t border-[#262626] p-3 space-y-2">
              <div className="text-[10px] tracking-widest text-[#FFB000] flex items-center gap-1">
                <LightbulbFilamentIcon size={12} weight="fill" /> KNOWLEDGE GAPS
              </div>
              {memory.knowledge_gaps.map((g) => (
                <div key={g.message} className="flex gap-2 text-[12px] text-[#E4E4E7]" data-testid={`gap-${memory.knowledge_gaps.indexOf(g)}`}>
                  <WarningIcon size={14} weight="fill" className={g.severity === "high" ? "text-[#FF3B30]" : "text-[#FFB000]"} />
                  <span>{g.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="kpi-grid">
        <KpiCard label="ACTIVE WELLS" value={kpis?.active_wells ?? "—"} sub={`${kpis?.total_wells ?? "—"} tracked total`} icon={DropIcon} testId="kpi-active-wells" />
        <KpiCard label="CRITICAL EVENTS" value={kpis?.critical_events ?? "—"} sub={`${kpis?.total_cases ?? "—"} cases in memory`} icon={WarningIcon} tone="danger" testId="kpi-critical" />
        <KpiCard label="TIME LOST (H)" value={kpis?.total_time_lost_hrs ?? "—"} sub={`Success rate ${kpis?.success_rate_pct ?? "—"}%`} icon={ClockCounterClockwiseIcon} testId="kpi-time" />
        <KpiCard label="COST IMPACT" value={kpis ? `$${(kpis.total_cost_impact_usd / 1e6).toFixed(2)}M` : "—"} sub={`${kpis?.conflicts_detected ?? "—"} conflicts flagged`} icon={CurrencyDollarIcon} testId="kpi-cost" />
      </div>

      {/* Map + Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 border border-[#262626] bg-[#121212]" data-testid="map-panel">
          <div className="px-4 py-3 border-b border-[#262626] flex justify-between items-center">
            <div className="font-display font-bold text-sm tracking-wider">WELL LOCATIONS · GLOBAL</div>
            <div className="flex gap-3 text-[10px] tracking-widest">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#FFB000]"></span>DRILLING</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#34C759]"></span>PRODUCING</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#71717A]"></span>SHUT-IN</span>
            </div>
          </div>
          <div className="h-[420px]">
            <MapContainer center={[25, -20]} zoom={2} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {wells.map(w => (
                <CircleMarker
                  key={w.id}
                  center={[w.lat, w.lng]}
                  radius={8}
                  pathOptions={{ color: statusColor(w.status), fillColor: statusColor(w.status), fillOpacity: 0.85, weight: 2 }}
                >
                  <Tooltip>{w.name}</Tooltip>
                  <Popup>
                    <div className="font-mono text-xs">
                      <div className="font-bold text-[#FFB000]">{w.name}</div>
                      <div>Field: {w.field}</div>
                      <div>Formation: {w.formation}</div>
                      <div>Depth: {w.depth_ft.toLocaleString()} ft</div>
                      <div>Status: {w.status}</div>
                      <Link to={`/cases?well_id=${w.id}`} className="text-[#FFB000] underline mt-2 block">View cases →</Link>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="border border-[#262626] bg-[#121212] flex flex-col" data-testid="recent-cases-panel">
          <div className="px-4 py-3 border-b border-[#262626] flex justify-between items-center">
            <div className="font-display font-bold text-sm tracking-wider">RECENT CASES</div>
            <Link to="/cases" className="text-[10px] text-[#FFB000] tracking-widest hover:underline" data-testid="dashboard-view-all-cases">VIEW ALL →</Link>
          </div>
          <div className="flex-1 overflow-auto">
            {cases.slice(0, 6).map(c => (
              <Link key={c.id} to={`/cases/${c.id}`} data-testid={`case-row-${c.id}`}
                className="block border-b border-[#1E1E1E] px-4 py-3 hover:bg-[#1E1E1E] transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-[11px] text-[#71717A] tracking-widest">{c.id}</div>
                  <span className={`pill ${c.severity === "critical" ? "pill-danger" : c.severity === "high" ? "pill-amber" : "pill-muted"}`}>{c.severity}</span>
                </div>
                <div className="text-sm font-bold text-white">{c.event_type.replace("_", " ").toUpperCase()}</div>
                <div className="text-[11px] text-[#A1A1AA] mt-1">{c.well_name} · {c.depth_ft.toLocaleString()} ft</div>
                <div className="text-[10px] text-[#71717A] mt-1">{c.date} · {c.time_lost_hrs}h lost</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Event distribution chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-[#262626] bg-[#121212] p-4" data-testid="event-chart-panel">
          <div className="flex justify-between items-center mb-3">
            <div className="font-display font-bold text-sm tracking-wider flex items-center gap-2">
              <ChartLineIcon size={16} weight="fill" className="text-[#FFB000]" />
              EVENT TYPE DISTRIBUTION
            </div>
            <div className="text-[10px] text-[#71717A] tracking-widest">HISTORICAL MEMORY</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="name" stroke="#71717A" tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
              <YAxis stroke="#71717A" tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
              <ReTooltip contentStyle={{ background: "#121212", border: "1px solid #262626", fontFamily: "JetBrains Mono", fontSize: 12 }} />
              <Bar dataKey="count" fill="#FFB000" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-[#262626] bg-[#121212] p-4" data-testid="quick-actions-panel">
          <div className="font-display font-bold text-sm tracking-wider mb-3 flex items-center gap-2">
            <GitDiffIcon size={16} weight="fill" className="text-[#FFB000]" />
            QUICK ACTIONS
          </div>
          <div className="space-y-2">
            <Link to="/recall" className="block border border-[#262626] p-3 hover:border-[#FFB000] transition-colors" data-testid="quick-recall">
              <div className="text-xs font-display font-bold text-white">RECALL SIMILAR EXPERIENCES</div>
              <div className="text-[10px] text-[#71717A] mt-1">Match a live event to historical cases</div>
            </Link>
            <Link to="/dna" className="block border border-[#262626] p-3 hover:border-[#FFB000] transition-colors" data-testid="quick-dna">
              <div className="text-xs font-display font-bold text-white">EXPERIENCE DNA</div>
              <div className="text-[10px] text-[#71717A] mt-1">Context → Event → Action → Outcome → Lesson → Evidence</div>
            </Link>
            <Link to="/what-worked" className="block border border-[#262626] p-3 hover:border-[#FFB000] transition-colors" data-testid="quick-what-worked">
              <div className="text-xs font-display font-bold text-white">WHAT WORKED BEFORE?</div>
              <div className="text-[10px] text-[#71717A] mt-1">Aggregate actions across similar experiences</div>
            </Link>
            <Link to="/conflicts" className="block border border-[#262626] p-3 hover:border-[#FFB000] transition-colors" data-testid="quick-conflicts">
              <div className="text-xs font-display font-bold text-white">CONFLICT SCAN</div>
              <div className="text-[10px] text-[#71717A] mt-1">Contradictory evidence requiring review</div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
