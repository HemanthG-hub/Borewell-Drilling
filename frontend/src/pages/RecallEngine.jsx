import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { fetchLiveEvent, runRecall } from "@/lib/api";
import { PulseIcon, TargetIcon, TrendUpIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";

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
  }, []);

  const radarData = result?.matches?.slice(0, 5).map(m => ({
    case: m.case.id,
    similarity: m.similarity,
  })) || [];

  return (
    <Layout title="Recall Engine" subtitle="Live event · Match to historical memory · Measure what worked"
      actions={<span className="pill pill-danger" data-testid="live-badge"><span className="w-1.5 h-1.5 bg-[#FF3B30] rounded-full animate-pulse"></span>LIVE EVENT</span>}>

      {/* Live event card */}
      {liveEvent && (
        <div className="border border-[#FF3B30] bg-[#121212] p-5 mb-6" data-testid="live-event-card">
          <div className="flex items-center gap-2 mb-3">
            <PulseIcon size={18} weight="fill" className="text-[#FF3B30]" />
            <div className="font-display font-bold text-sm tracking-widest">CURRENT DRILLING EVENT</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A]">WELL</div>
              <div className="font-display text-lg text-[#FFB000]">{liveEvent.well_name}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A]">FORMATION</div>
              <div className="font-display text-lg">{liveEvent.formation}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A]">DEPTH</div>
              <div className="font-display text-lg">{liveEvent.depth_ft.toLocaleString()} FT</div>
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A]">TORQUE</div>
              <div className="font-display text-lg text-[#FF3B30]">{liveEvent.params.torque_kftlbs}</div>
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A]">ROP</div>
              <div className="font-display text-lg">{liveEvent.params.rop_ft_hr} FT/HR</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {liveEvent.symptoms.map(s => <span key={s} className="pill pill-danger">{s.replace("_", " ")}</span>)}
          </div>
        </div>
      )}

      {loading && <div className="text-[#71717A] font-mono text-xs">Running similarity match against 8 cases...</div>}

      {result && (
        <>
          {/* Recommendation */}
          {result.recommended_action && (
            <div className="border-l-2 border-[#34C759] bg-[#121212] p-5 mb-6" data-testid="recommendation-panel">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircleIcon size={18} weight="fill" className="text-[#34C759]" />
                <div className="font-display font-bold text-sm tracking-widest">MEASURED · WHAT WORKED BEST</div>
              </div>
              <p className="text-[15px] text-white mb-3">{result.recommended_action.action}</p>
              <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                <div className="border border-[#262626] p-3">
                  <div className="text-[10px] text-[#71717A] tracking-widest">CASES</div>
                  <div className="font-display text-xl text-[#34C759] mt-1">{result.recommended_action.count}</div>
                </div>
                <div className="border border-[#262626] p-3">
                  <div className="text-[10px] text-[#71717A] tracking-widest">AVG TIME LOST</div>
                  <div className="font-display text-xl text-[#FFB000] mt-1">{result.recommended_action.avg_hrs}h</div>
                </div>
                <div className="border border-[#262626] p-3">
                  <div className="text-[10px] text-[#71717A] tracking-widest">AVG COST</div>
                  <div className="font-display text-xl text-white mt-1">${(result.recommended_action.avg_cost / 1000).toFixed(0)}k</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Radar chart */}
            <div className="border border-[#262626] bg-[#121212] p-4" data-testid="similarity-radar">
              <div className="font-display font-bold text-sm tracking-wider mb-3 flex items-center gap-2">
                <TargetIcon size={16} weight="fill" className="text-[#FFB000]" /> SIMILARITY FINGERPRINT
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#262626" />
                  <PolarAngleAxis dataKey="case" tick={{ fontSize: 10, fill: "#A1A1AA", fontFamily: "JetBrains Mono" }} />
                  <PolarRadiusAxis stroke="#262626" tick={{ fontSize: 9, fill: "#71717A" }} />
                  <Radar dataKey="similarity" stroke="#FFB000" fill="#FFB000" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Match list */}
            <div className="lg:col-span-2 border border-[#262626] bg-[#121212]" data-testid="match-list">
              <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-wider flex items-center gap-2">
                <TrendUpIcon size={16} weight="fill" className="text-[#FFB000]" /> TOP MATCHES ({result.matches.length})
              </div>
              <div className="divide-y divide-[#1E1E1E]">
                {result.matches.map((m, i) => (
                  <Link key={m.case.id} to={`/cases/${m.case.id}`} data-testid={`match-${m.case.id}`}
                    className="block p-4 hover:bg-[#1E1E1E] transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[10px] text-[#71717A] tracking-widest mr-2">#{i + 1}</span>
                        <span className="text-[#FFB000] font-mono">{m.case.id}</span>
                        <span className="text-white ml-2">{m.case.well_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl text-[#FFB000]">{m.similarity}%</div>
                        <div className="text-[9px] text-[#71717A] tracking-widest">MATCH</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] mb-2">
                      {m.case.event_type.replace("_", " ")} · {m.case.formation} · {m.case.depth_ft.toLocaleString()} ft
                    </div>
                    <div className="text-[11px] text-white bg-[#0A0A0A] border border-[#1E1E1E] p-2 mb-2">
                      <span className="text-[#34C759]">▸ WORKED:</span> {m.what_worked}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {m.reasons.slice(0, 3).map((r, ri) => <span key={ri} className="pill pill-muted">{r}</span>)}
                    </div>
                    <div className="flex gap-6 mt-2 text-[10px] font-mono">
                      <span className="text-[#71717A]">TIME: <span className="text-white">{m.time_lost_hrs}h</span></span>
                      <span className="text-[#71717A]">COST: <span className="text-white">${(m.cost_impact_usd / 1000).toFixed(0)}k</span></span>
                      <span className="text-[#71717A]">OUTCOME: <span className="text-[#34C759]">{m.outcome}</span></span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
