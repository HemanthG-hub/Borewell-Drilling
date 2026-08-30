import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { fetchCases, fetchCaseEvidence, fetchSensorTrace } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileTextIcon, WaveformIcon } from "@phosphor-icons/react";

export default function EvidenceViewer() {
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [trace, setTrace] = useState([]);

  useEffect(() => { fetchCases().then(cs => { setCases(cs); setSelected(cs[0]); }); }, []);
  useEffect(() => {
    if (selected) {
      fetchCaseEvidence(selected.id).then(setEvidence);
      fetchSensorTrace(selected.id).then(d => setTrace(d.trace));
    }
  }, [selected]);

  return (
    <Layout title="Evidence Viewer" subtitle="Original proof · Every recommendation traces back to the source">
      <div className="grid grid-cols-12 gap-4">
        {/* Case selector */}
        <div className="col-span-12 md:col-span-3 border border-[#262626] bg-[#121212]" data-testid="evidence-case-list">
          <div className="px-3 py-2 border-b border-[#262626] font-display font-bold text-xs tracking-widest text-[#71717A]">SELECT CASE</div>
          <div className="max-h-[600px] overflow-auto">
            {cases.map(c => (
              <button key={c.id} onClick={() => setSelected(c)}
                data-testid={`ev-select-${c.id}`}
                className={`w-full text-left px-3 py-3 border-b border-[#1E1E1E] transition-colors ${selected?.id === c.id ? "bg-[#1E1E1E] border-l-2 border-l-[#FFB000]" : "hover:bg-[#1E1E1E]"}`}>
                <div className="text-[11px] text-[#FFB000] font-mono">{c.id}</div>
                <div className="text-xs text-white mt-1">{c.event_type.replace("_", " ")}</div>
                <div className="text-[10px] text-[#71717A]">{c.well_name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main pane */}
        <div className="col-span-12 md:col-span-9 space-y-4">
          {selected && (
            <>
              <div className="border border-[#262626] bg-[#121212] p-4" data-testid="evidence-sensor-panel">
                <div className="font-display font-bold text-sm tracking-wider mb-3 flex items-center gap-2">
                  <WaveformIcon size={16} weight="fill" className="text-[#FFB000]" />
                  RAW SENSOR TRACE · {selected.id}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trace}>
                    <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                    <XAxis dataKey="depth_ft" stroke="#71717A" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                    <YAxis stroke="#71717A" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                    <Tooltip contentStyle={{ background: "#121212", border: "1px solid #262626", fontFamily: "JetBrains Mono", fontSize: 11 }} />
                    <Line type="monotone" dataKey="torque_kftlbs" stroke="#FFB000" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="mud_weight_ppg" stroke="#E35205" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="border border-[#262626] bg-[#121212]" data-testid="evidence-list">
                <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-wider flex items-center gap-2">
                  <FileTextIcon size={16} weight="fill" className="text-[#FFB000]" />
                  SOURCE DOCUMENTS ({evidence.length})
                </div>
                {evidence.map(e => (
                  <div key={e.id} className="p-4 border-b border-[#1E1E1E]" data-testid={`ev-item-${e.id}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="pill pill-muted">{e.type.replace("_", " ")}</span>
                        <span className="text-[11px] text-[#71717A]">{e.author}</span>
                        <span className="text-[11px] text-[#71717A]">·</span>
                        <span className="text-[11px] text-[#71717A]">{new Date(e.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="flex gap-2">
                        {e.conflict && <span className="pill pill-danger">CONFLICT</span>}
                        <span className="text-[10px] text-[#71717A]">CONF {(e.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="border-l-2 border-[#262626] pl-3 font-mono text-[13px] text-white">
                      {e.content}
                    </div>
                    {e.conflict && (
                      <div className="mt-2 border-l-2 border-[#FF3B30] pl-3 text-[11px] text-[#FF3B30] font-mono">
                        ⚠ CONFLICT: {e.conflict.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Link to={`/cases/${selected.id}`} className="btn-ghost inline-block" data-testid="open-full-case">
                OPEN FULL CASE →
              </Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
