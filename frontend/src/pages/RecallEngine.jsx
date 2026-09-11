import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { fetchLiveEvent, runRecall } from "@/lib/api";
import { PulseIcon, TargetIcon, TrendUpIcon, CheckCircleIcon, WarningIcon, ArrowRightIcon, DnaIcon } from "@phosphor-icons/react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";

const COMPONENT_LABELS = {
  event_similarity: "Event Similarity",
  symptom_similarity: "Symptom Similarity",
  depth_proximity: "Depth Proximity",
  formation_similarity: "Formation Similarity",
  parameter_similarity: "Parameter Similarity",
};

function ComponentBreakdown({ components }) {
  const keys = ["event_similarity", "symptom_similarity", "depth_proximity", "formation_similarity", "parameter_similarity"];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
      {keys.map(k => (
        <div key={k} className="border border-[#262626] p-2">
          <div className="text-[9px] text-[#71717A] tracking-widest mb-1">{COMPONENT_LABELS[k]}</div>
          <div className="flex items-baseline gap-1">
            <div className="font-display text-lg text-[#FFB000]">{components[k]}%</div>
            <div className="text-[9px] text-[#71717A]">w{components.weights[k]}</div>
          </div>
          <div className="h-1 bg-[#262626] mt-1">
            <div className="h-full bg-[#FFB000]" style={{ width: `${components[k]}%` }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceStrengthPill({ strength }) {
  const map = { Strong: "pill-success", Moderate: "pill-amber", Limited: "pill-muted" };
  return <span className={`pill ${map[strength] || "pill-muted"}`}>{strength}</span>;
}

export default function RecallEngine() {
  const [liveEvent, setLiveEvent] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLiveEvent().then(async e => {
      setLiveEvent(e);
      setLoading(true);
      const r = await runRecall(e);
      setResult(r);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const radarData = result?.matches?.slice(0, 5).map(m => ({
    case: m.case.id,
    similarity: m.similarity,
  })) || [];

  return (
    <Layout
      title="Recall Engine"
      subtitle="We find similar drilling situations, not just nearby wells"
      actions={<span className="pill pill-danger" data-testid="live-badge"><span className="w-1.5 h-1.5 bg-[#FF3B30] rounded-full animate-pulse"></span>LIVE EVENT</span>}
    >
      {/* Live event card */}
      {liveEvent && (
        <div className="border border-[#FF3B30] bg-[#121212] p-5 mb-6" data-testid="live-event-card">
          <div className="flex items-center gap-2 mb-3">
            <PulseIcon size={18} weight="fill" className="text-[#FF3B30]" />
            <div className="font-display font-bold text-sm tracking-widest">CURRENT DRILLING SITUATION</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div><div className="text-[10px] tracking-widest text-[#71717A]">WELL</div><div className="font-display text-lg text-[#FFB000]">{liveEvent.well_name}</div></div>
            <div><div className="text-[10px] tracking-widest text-[#71717A]">FORMATION</div><div className="font-display text-lg">{liveEvent.formation}</div></div>
            <div><div className="text-[10px] tracking-widest text-[#71717A]">DEPTH</div><div className="font-display text-lg">{liveEvent.depth_ft.toLocaleString()} FT</div></div>
            <div><div className="text-[10px] tracking-widest text-[#71717A]">TORQUE</div><div className="font-display text-lg text-[#FF3B30]">{liveEvent.params.torque_kftlbs}</div></div>
            <div><div className="text-[10px] tracking-widest text-[#71717A]">ROP</div><div className="font-display text-lg">{liveEvent.params.rop_ft_hr} FT/HR</div></div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {liveEvent.symptoms.map(s => <span key={s} className="pill pill-danger">{s.replace(/_/g, " ")}</span>)}
          </div>
        </div>
      )}

      {loading && <div className="text-[#71717A] font-mono text-xs">Running similarity match across historical experiences...</div>}

      {result && (
        <>
          {/* Safety disclaimer banner */}
          <div className="border-l-2 border-[#FFB000] bg-[#1E1E1E] p-3 mb-6" data-testid="safety-disclaimer">
            <div className="text-[11px] text-[#FFB000] font-mono">
              {result.safety_disclaimer}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Radar */}
            <div className="border border-[#262626] bg-[#121212] p-4" data-testid="similarity-radar">
              <div className="font-display font-bold text-sm tracking-wider mb-3 flex items-center gap-2">
                <TargetIcon size={16} weight="fill" className="text-[#FFB000]" /> SIMILARITY FINGERPRINT
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#262626" />
                  <PolarAngleAxis dataKey="case" tick={{ fontSize: 10, fill: "#A1A1AA", fontFamily: "JetBrains Mono" }} />
                  <PolarRadiusAxis stroke="#262626" tick={{ fontSize: 9, fill: "#71717A" }} />
                  <Radar dataKey="similarity" stroke="#FFB000" fill="#FFB000" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="text-[10px] text-[#71717A] font-mono mt-2">Overall match combines symptom, formation, depth, and parameter similarity — weighted.</div>
            </div>

            {/* Similar Experiences */}
            <div className="lg:col-span-2 border border-[#262626] bg-[#121212]" data-testid="similar-experiences">
              <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-wider flex items-center gap-2">
                <TrendUpIcon size={16} weight="fill" className="text-[#FFB000]" /> SIMILAR EXPERIENCES ({result.matches.length})
              </div>
              <div className="divide-y divide-[#1E1E1E]">
                {result.matches.map((m, i) => (
                  <div key={m.case.id} className="p-4 hover:bg-[#1E1E1E] transition-colors" data-testid={`match-${m.case.id}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[10px] text-[#71717A] tracking-widest mr-2">#{i + 1}</span>
                        <span className="text-[#FFB000] font-mono">{m.case.id}</span>
                        <span className="text-white ml-2">{m.case.well_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl text-[#FFB000]">{m.similarity}%</div>
                        <div className="text-[9px] text-[#71717A] tracking-widest">EXPERIENCE MATCH</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] mb-2">
                      {m.case.event_type.replace(/_/g, " ")} · {m.case.formation} · {m.case.depth_ft.toLocaleString()} ft
                    </div>

                    {/* Why this matches - component breakdown */}
                    <details data-testid={`why-${m.case.id}`}>
                      <summary className="text-[10px] text-[#FFB000] cursor-pointer hover:underline tracking-widest">WHY THIS MATCHES ▾</summary>
                      <ComponentBreakdown components={m.components} />
                    </details>

                    <div className="text-[11px] text-white bg-[#0A0A0A] border border-[#1E1E1E] p-2 mt-2">
                      <span className="text-[#34C759]">▸ ACTION TAKEN:</span> {m.what_worked}
                    </div>
                    <div className="flex gap-6 mt-2 text-[10px] font-mono items-center">
                      <span className="text-[#71717A]">TIME: <span className="text-white">{m.time_lost_hrs}h</span></span>
                      <span className="text-[#71717A]">COST: <span className="text-white">${(m.cost_impact_usd / 1000).toFixed(0)}k</span></span>
                      <span className="text-[#71717A]">OUTCOME: <span className={m.outcome === "resolved" ? "text-[#34C759]" : "text-[#FFB000]"}>{m.outcome}</span></span>
                      <Link to={`/cases/${m.case.id}`} className="ml-auto text-[#FFB000] hover:underline flex items-center gap-1" data-testid={`open-${m.case.id}`}>
                        <DnaIcon size={11} weight="fill" /> OPEN DNA <ArrowRightIcon size={10} weight="bold" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What Worked Before */}
          <div className="border border-[#262626] bg-[#121212] mb-6" data-testid="what-worked-panel">
            <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-wider flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircleIcon size={16} weight="fill" className="text-[#34C759]" /> WHAT WORKED BEFORE?
              </div>
              <Link to="/what-worked" className="text-[10px] text-[#FFB000] hover:underline tracking-widest">FULL ANALYSIS →</Link>
            </div>
            <div className="divide-y divide-[#1E1E1E]">
              {result.what_worked_before.map((w, i) => (
                <div key={i} className="p-4" data-testid={`worked-${i}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-white font-bold">{w.action}</div>
                    <EvidenceStrengthPill strength={w.evidence_strength} />
                  </div>
                  <div className="text-[11px] font-mono text-[#A1A1AA] mb-2">
                    <span className="text-[#34C759]">{w.resolved_count}</span> resolved / <span className="text-[#FF3B30]">{w.not_resolved_count}</span> not-resolved out of <span className="text-white">{w.total_similar_cases}</span> comparable cases
                  </div>
                  <div className="h-1.5 bg-[#262626] flex overflow-hidden">
                    <div className="bg-[#34C759]" style={{ width: `${(w.resolved_count / w.total_similar_cases) * 100}%` }}></div>
                    <div className="bg-[#FF3B30]" style={{ width: `${(w.not_resolved_count / w.total_similar_cases) * 100}%` }}></div>
                  </div>
                  <div className="text-[10px] font-mono text-[#71717A] mt-2">
                    Avg time lost: <span className="text-white">{w.avg_time_lost_hrs}h</span> · Avg cost: <span className="text-white">${(w.avg_cost_usd / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outcome Variation */}
          {result.outcome_variation.length > 0 && (
            <div className="border border-[#FFB000]/40 bg-[#121212]" data-testid="outcome-variation">
              <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-wider flex items-center gap-2">
                <WarningIcon size={16} weight="fill" className="text-[#FFB000]" /> OUTCOME VARIATION DETECTED
              </div>
              <div className="p-4 text-[11px] text-[#A1A1AA] border-b border-[#1E1E1E]">
                The same action produced different outcomes across similar cases. Potential differentiating factors below are historical observations — not verified causes.
              </div>
              {result.outcome_variation.map((v, i) => (
                <div key={i} className="p-4 border-b border-[#1E1E1E]" data-testid={`variation-${i}`}>
                  <div className="text-white font-bold mb-2">ACTION: {v.action}</div>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {v.cases.map(c => (
                      <div key={c.id} className={`border px-3 py-2 ${c.outcome === "resolved" ? "border-[#34C759]/40" : "border-[#FF3B30]/40"}`}>
                        <div className="text-[10px] text-[#71717A] tracking-widest">{c.id}</div>
                        <div className={`text-xs font-bold ${c.outcome === "resolved" ? "text-[#34C759]" : "text-[#FF3B30]"}`}>{c.outcome.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] tracking-widest text-[#71717A] mb-1">POTENTIAL DIFFERENTIATING FACTORS</div>
                  <ul className="text-[12px] text-[#E4E4E7] font-mono space-y-1 pl-4">
                    {v.potential_differentiators.map((d, di) => <li key={di}>• {d}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
