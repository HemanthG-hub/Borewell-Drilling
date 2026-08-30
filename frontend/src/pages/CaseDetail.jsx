import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { fetchCase, fetchSensorTrace, fetchCaseEvidence } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ArrowLeftIcon, FileTextIcon, WarningOctagonIcon, LightbulbFilamentIcon } from "@phosphor-icons/react";

export default function CaseDetail() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [trace, setTrace] = useState([]);
  const [evidence, setEvidence] = useState([]);

  useEffect(() => {
    fetchCase(id).then(setCaseData);
    fetchSensorTrace(id).then(d => setTrace(d.trace));
    fetchCaseEvidence(id).then(setEvidence);
  }, [id]);

  if (!caseData) return <Layout title="Loading..." />;

  return (
    <Layout title={caseData.id} subtitle={`${caseData.well_name} · ${caseData.formation} @ ${caseData.depth_ft.toLocaleString()} ft`}
      actions={<Link to="/cases" className="btn-ghost" data-testid="back-to-cases"><ArrowLeftIcon size={12} weight="bold" className="inline mr-1" />BACK</Link>}>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: "EVENT", value: caseData.event_type.replace("_", " ").toUpperCase() },
          { label: "SEVERITY", value: caseData.severity.toUpperCase(), tone: caseData.severity === "critical" ? "danger" : "amber" },
          { label: "OUTCOME", value: caseData.outcome.toUpperCase(), tone: caseData.outcome === "resolved" ? "success" : "amber" },
          { label: "TIME LOST", value: `${caseData.time_lost_hrs} H` },
          { label: "COST", value: `$${(caseData.cost_impact_usd / 1000).toFixed(0)}K` },
        ].map(k => (
          <div key={k.label} className="border border-[#262626] bg-[#121212] p-4">
            <div className="text-[10px] tracking-widest text-[#71717A]">{k.label}</div>
            <div className={`font-display text-xl mt-2 ${k.tone === "danger" ? "text-[#FF3B30]" : k.tone === "success" ? "text-[#34C759]" : k.tone === "amber" ? "text-[#FFB000]" : "text-white"}`}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Chart */}
        <div className="lg:col-span-2 border border-[#262626] bg-[#121212] p-4" data-testid="sensor-chart">
          <div className="font-display font-bold text-sm tracking-wider mb-3">SENSOR TRACE · TORQUE vs DEPTH</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trace}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="depth_ft" stroke="#71717A" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} label={{ value: "Depth (ft)", position: "insideBottom", offset: -5, fill: "#71717A", fontSize: 10 }} />
              <YAxis yAxisId="left" stroke="#FFB000" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
              <YAxis yAxisId="right" orientation="right" stroke="#E35205" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
              <Tooltip contentStyle={{ background: "#121212", border: "1px solid #262626", fontFamily: "JetBrains Mono", fontSize: 11 }} />
              <ReferenceLine x={caseData.depth_ft} stroke="#FF3B30" strokeDasharray="4 4" yAxisId="left" label={{ value: "EVENT", fill: "#FF3B30", fontSize: 10 }} />
              <Line yAxisId="left" type="monotone" dataKey="torque_kftlbs" stroke="#FFB000" dot={false} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="rop_ft_hr" stroke="#E35205" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-[10px] mt-2 tracking-widest">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#FFB000]"></span>TORQUE (kft·lbs)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#E35205]"></span>ROP (ft/hr)</span>
          </div>
        </div>

        {/* Params */}
        <div className="border border-[#262626] bg-[#121212] p-4" data-testid="params-panel">
          <div className="font-display font-bold text-sm tracking-wider mb-3">DRILLING PARAMETERS</div>
          <div className="space-y-2 font-mono text-xs">
            {Object.entries(caseData.params).map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-[#1E1E1E]">
                <span className="text-[#71717A]">{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="text-[10px] tracking-widest text-[#71717A] mb-2">SYMPTOMS</div>
            <div className="flex flex-wrap gap-1">
              {caseData.symptoms.map(s => <span key={s} className="pill pill-amber">{s.replace("_", " ")}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Action + Lessons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border-l-2 border-[#FFB000] bg-[#121212] p-5" data-testid="action-panel">
          <div className="flex items-center gap-2 mb-2">
            <WarningOctagonIcon size={16} weight="fill" className="text-[#FFB000]" />
            <div className="font-display font-bold text-sm tracking-wider">ACTION TAKEN</div>
          </div>
          <p className="text-[13px] leading-relaxed text-[#E4E4E7]">{caseData.action_taken}</p>
        </div>
        <div className="border-l-2 border-[#34C759] bg-[#121212] p-5" data-testid="lessons-panel">
          <div className="flex items-center gap-2 mb-2">
            <LightbulbFilamentIcon size={16} weight="fill" className="text-[#34C759]" />
            <div className="font-display font-bold text-sm tracking-wider">LESSONS LEARNED</div>
          </div>
          <p className="text-[13px] leading-relaxed text-[#E4E4E7]">{caseData.lessons || "—"}</p>
        </div>
      </div>

      {/* Evidence */}
      <div className="border border-[#262626] bg-[#121212]" data-testid="evidence-panel">
        <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-wider flex items-center gap-2">
          <FileTextIcon size={16} weight="fill" className="text-[#FFB000]" />
          ORIGINAL EVIDENCE ({evidence.length})
        </div>
        <div className="divide-y divide-[#1E1E1E]">
          {evidence.map(e => (
            <div key={e.id} className="p-4 hover:bg-[#1E1E1E] transition-colors" data-testid={`evidence-${e.id}`}>
              <div className="flex justify-between items-start mb-1">
                <div>
                  <span className="pill pill-muted mr-2">{e.type.replace("_", " ")}</span>
                  <span className="text-[11px] text-[#71717A]">{e.author} · {new Date(e.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  {e.conflict && <span className="pill pill-danger">CONFLICT</span>}
                  <span className="text-[10px] text-[#71717A]">CONF {(e.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <p className="text-[13px] text-white mt-1">{e.content}</p>
              {e.conflict && <p className="text-[11px] text-[#FF3B30] mt-2 font-mono">⚠ {e.conflict.reason}</p>}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
