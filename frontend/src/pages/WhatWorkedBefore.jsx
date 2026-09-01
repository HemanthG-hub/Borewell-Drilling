import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { fetchLiveEvent, runRecall } from "@/lib/api";
import { CheckCircleIcon, TrophyIcon, WarningIcon, ArrowRightIcon } from "@phosphor-icons/react";

const strengthColor = { Strong: "#34C759", Moderate: "#FFB000", Limited: "#71717A" };

export default function WhatWorkedBefore() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchLiveEvent().then(async e => {
      const r = await runRecall(e);
      setResult(r);
    });
  }, []);

  return (
    <Layout
      title="What Worked Before?"
      subtitle="Aggregated actions across similar historical experiences — with evidence strength"
    >
      <div className="border-l-2 border-[#FFB000] bg-[#1E1E1E] p-3 mb-5" data-testid="safety-disclaimer">
        <div className="text-[11px] text-[#FFB000] font-mono">
          Historical evidence only. Final operational decisions remain with qualified drilling personnel.
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {result.what_worked_before.map((w, i) => (
              <div key={i} className="border border-[#262626] bg-[#121212] p-5" data-testid={`worked-full-${i}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <TrophyIcon size={18} weight="fill" style={{ color: strengthColor[w.evidence_strength] }} />
                    <div>
                      <div className="font-display font-black text-base">{w.action}</div>
                      <div className="text-[10px] tracking-widest text-[#71717A]">EVIDENCE: <span style={{ color: strengthColor[w.evidence_strength] }}>{w.evidence_strength}</span></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-3xl text-[#34C759]">{w.success_rate_pct}%</div>
                    <div className="text-[9px] tracking-widest text-[#71717A]">SUCCESS RATE</div>
                  </div>
                </div>

                <div className="border border-[#262626] p-3 mb-3">
                  <div className="text-[10px] text-[#71717A] tracking-widest mb-2">OUTCOME DISTRIBUTION</div>
                  <div className="h-3 bg-[#0A0A0A] flex overflow-hidden">
                    <div className="bg-[#34C759] flex items-center justify-center text-[9px] font-bold text-black"
                      style={{ width: `${(w.resolved_count / w.total_similar_cases) * 100}%` }}>
                      {w.resolved_count > 0 && w.resolved_count}
                    </div>
                    <div className="bg-[#FF3B30] flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ width: `${(w.not_resolved_count / w.total_similar_cases) * 100}%` }}>
                      {w.not_resolved_count > 0 && w.not_resolved_count}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono mt-1">
                    <span className="text-[#34C759]">{w.resolved_count} resolved</span>
                    <span className="text-[#FF3B30]">{w.not_resolved_count} not resolved</span>
                    <span className="text-[#A1A1AA]">of {w.total_similar_cases} cases</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="border border-[#262626] p-2">
                    <div className="text-[9px] tracking-widest text-[#71717A]">AVG TIME LOST</div>
                    <div className="font-display text-lg text-[#FFB000]">{w.avg_time_lost_hrs}h</div>
                  </div>
                  <div className="border border-[#262626] p-2">
                    <div className="text-[9px] tracking-widest text-[#71717A]">AVG COST</div>
                    <div className="font-display text-lg">${(w.avg_cost_usd / 1000).toFixed(0)}k</div>
                  </div>
                </div>

                <div className="text-[10px] text-[#71717A] tracking-widest mb-1">SOURCE CASES</div>
                <div className="flex gap-2 flex-wrap">
                  {w.cases.map(c => (
                    <Link key={c.id} to={`/cases/${c.id}`} data-testid={`worked-case-${c.id}`}
                      className="text-[11px] font-mono px-2 py-1 border border-[#262626] hover:border-[#FFB000] hover:text-[#FFB000] transition-colors flex items-center gap-1">
                      {c.id}
                      <span className={c.outcome === "resolved" ? "text-[#34C759]" : "text-[#FF3B30]"}>●</span>
                      <ArrowRightIcon size={10} weight="bold" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {result.outcome_variation.length > 0 && (
            <div className="border border-[#FFB000]/40 bg-[#121212]" data-testid="variation-panel">
              <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-wider flex items-center gap-2">
                <WarningIcon size={16} weight="fill" className="text-[#FFB000]" /> WHERE SAME ACTION DIFFERED
              </div>
              {result.outcome_variation.map((v, i) => (
                <div key={i} className="p-4 border-b border-[#1E1E1E]" data-testid={`var-${i}`}>
                  <div className="text-white font-bold mb-2">{v.action}</div>
                  <div className="text-[10px] text-[#71717A] tracking-widest mb-1">POTENTIAL DIFFERENTIATING FACTORS</div>
                  <ul className="text-[12px] font-mono text-[#E4E4E7] space-y-1 pl-3">
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
