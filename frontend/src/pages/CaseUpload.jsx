import React, { useEffect, useState } from "react";
import { api, API } from "@/lib/api";
import Layout from "@/components/Layout";
import { UploadSimpleIcon, FileTextIcon, CheckCircleIcon, WarningIcon, ArrowRightIcon, FilePdfIcon } from "@phosphor-icons/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function CaseUpload() {
  const [file, setFile] = useState(null);
  const [wellName, setWellName] = useState("Rig-A Well 01");
  const [formation, setFormation] = useState("Wolfcamp A");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploaded, setUploaded] = useState([]);

  const refresh = () => api.get("/uploads").then(r => setUploaded(r.data));
  useEffect(() => { refresh(); }, []);

  const submit = async () => {
    if (!file) { toast.error("Choose a file first"); return; }
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("well_name", wellName);
      fd.append("formation", formation);
      const res = await fetch(`${API}/uploads`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      toast.success(`Case ${data.case.id} ingested — now searchable in Recall Engine`);
      refresh();
    } catch (e) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout title="Upload Data" subtitle="Turn a mud log, LAS, CSV, JSON, PDF or TXT report into a reusable Experience DNA">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5 border border-[#262626] bg-[#121212] p-5" data-testid="upload-panel">
          <div className="flex items-center gap-2 mb-4">
            <UploadSimpleIcon size={18} weight="fill" className="text-[#FFB000]" />
            <div className="font-display font-bold text-sm tracking-widest">DROP A FILE</div>
          </div>

          <div className="grid grid-cols-5 gap-1 mb-4">
            {["LAS", "CSV", "JSON", "PDF", "TXT"].map(t => (
              <div key={t} className="text-center border border-[#262626] py-2 text-[10px] font-display font-bold tracking-widest text-[#71717A]">{t}</div>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A] mb-1">WELL NAME</div>
              <input value={wellName} onChange={e => setWellName(e.target.value)}
                data-testid="upload-well-name"
                className="w-full bg-[#0A0A0A] border border-[#262626] px-3 py-2 text-[13px] text-white font-mono focus:outline-none focus:border-[#FFB000]" />
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A] mb-1">FORMATION</div>
              <input value={formation} onChange={e => setFormation(e.target.value)}
                data-testid="upload-formation"
                className="w-full bg-[#0A0A0A] border border-[#262626] px-3 py-2 text-[13px] text-white font-mono focus:outline-none focus:border-[#FFB000]" />
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A] mb-1">FILE</div>
              <label className="block border border-dashed border-[#262626] p-6 text-center cursor-pointer hover:border-[#FFB000] transition-colors">
                {file?.name?.match(/\.pdf$/i) ? <FilePdfIcon size={28} className="text-[#FFB000] mx-auto mb-2" weight="duotone" /> : <FileTextIcon size={28} className="text-[#FFB000] mx-auto mb-2" weight="duotone" />}
                <div className="text-xs text-[#A1A1AA]">{file ? file.name : "Click to select .las, .csv, .json, .pdf or .txt"}</div>
                <input type="file" accept=".las,.csv,.json,.pdf,.txt" className="hidden"
                  data-testid="upload-file-input"
                  onChange={e => setFile(e.target.files?.[0])} />
              </label>
            </div>

            <button onClick={submit} disabled={uploading || !file}
              className="btn-amber w-full disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="upload-submit">
              {uploading ? "INGESTING..." : "INGEST EXPERIENCE"}
            </button>
          </div>

          <div className="mt-5 text-[10px] text-[#71717A] leading-relaxed">
            <div className="text-[#FFB000] mb-1">SENSOR PATH (LAS / CSV / JSON):</div>
            Extracts curves → detects torque spikes / ROP drops → creates sensor-backed case.<br /><br />
            <div className="text-[#FFB000] mb-1">NARRATIVE PATH (PDF / TXT):</div>
            Text extraction → structured extraction → context / event / action / outcome / lesson → Experience DNA.
          </div>
        </div>

        <div className="col-span-12 md:col-span-7 space-y-4">
          {result && (
            <>
              {/* Pipeline visualization */}
              {result.extraction_pipeline && (
                <div className="border border-[#262626] bg-[#121212] p-4" data-testid="extraction-pipeline">
                  <div className="font-display font-bold text-sm tracking-widest mb-3">EXTRACTION PIPELINE</div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {result.extraction_pipeline.map((s, i) => (
                      <React.Fragment key={i}>
                        <div className="border border-[#34C759]/50 bg-[#34C759]/10 px-3 py-2 text-[11px]" data-testid={`pipeline-${i}`}>
                          <div className="text-[#34C759] font-display font-bold tracking-widest">{s.step}</div>
                          <div className="text-[9px] text-[#71717A] mt-1 font-mono">{s.output}</div>
                        </div>
                        {i < result.extraction_pipeline.length - 1 && <ArrowRightIcon size={14} className="text-[#71717A]" weight="bold" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* DNA Result if extracted */}
              {result.case.extracted_dna && (
                <div className="border-l-2 border-[#FFB000] bg-[#121212] p-4" data-testid="dna-result">
                  <div className="font-display font-bold text-sm tracking-widest mb-3">🧬 EXPERIENCE DNA EXTRACTED</div>
                  <div className="grid grid-cols-2 gap-3 text-[12px] font-mono">
                    <div><span className="text-[#71717A]">CONTEXT:</span> {result.case.extracted_dna.context.formation} @ {result.case.extracted_dna.context.depth_ft} ft</div>
                    <div><span className="text-[#71717A]">EVENT:</span> {result.case.extracted_dna.event_type}</div>
                    <div><span className="text-[#71717A]">ACTION:</span> <span className="text-white">{result.case.extracted_dna.action_taken}</span></div>
                    <div><span className="text-[#71717A]">OUTCOME:</span> <span className={result.case.extracted_dna.outcome === "resolved" ? "text-[#34C759]" : "text-[#FFB000]"}>{result.case.extracted_dna.outcome}</span></div>
                    <div className="col-span-2"><span className="text-[#71717A]">LESSON:</span> <span className="italic">{result.case.extracted_dna.lesson || "Not extracted"}</span></div>
                  </div>
                  <div className="mt-3 text-[10px] text-[#FFB000] font-mono">
                    Extractor: <span className="text-white">{result.case.extracted_dna.extractor || "regex_fallback"}</span> · Confidence: {(result.case.extracted_dna.confidence * 100).toFixed(0)}% · {result.case.extracted_dna.extractor?.startsWith("regex") ? "Rule-based extraction — review before trusting" : "LLM extraction — review before trusting"}
                  </div>
                </div>
              )}

              <div className="border-l-2 border-[#34C759] bg-[#121212] p-4" data-testid="upload-result">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircleIcon size={18} weight="fill" className="text-[#34C759]" />
                  <div className="font-display font-bold text-sm tracking-widest">INGESTED · {result.case.id}</div>
                </div>
                <div className="text-[11px] text-[#34C759] mb-3 font-mono">
                  ▸ SAVED TO EXPERIENCE MEMORY · NOW SEARCHABLE IN RECALL ENGINE
                </div>
                <div className="grid grid-cols-4 gap-3 text-xs font-mono mb-3">
                  <div><span className="text-[#71717A]">EVENT:</span> {result.case.event_type}</div>
                  <div><span className="text-[#71717A]">SEVERITY:</span> <span className={result.case.severity === "high" ? "text-[#FF3B30]" : "text-[#FFB000]"}>{result.case.severity}</span></div>
                  <div><span className="text-[#71717A]">DEPTH:</span> {result.case.depth_ft} ft</div>
                  <div><span className="text-[#71717A]">ROWS:</span> {result.case.row_count}</div>
                </div>
                {result.case.trace?.length > 0 && (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={result.case.trace}>
                      <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                      <XAxis dataKey="depth_ft" stroke="#71717A" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                      <YAxis stroke="#71717A" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                      <Tooltip contentStyle={{ background: "#121212", border: "1px solid #262626", fontFamily: "JetBrains Mono", fontSize: 11 }} />
                      <Line type="monotone" dataKey="torque_kftlbs" stroke="#FFB000" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="rop_ft_hr" stroke="#E35205" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {result.alerts_triggered?.length > 0 && (
                  <div className="mt-3 border border-[#FF3B30]/40 bg-[#FF3B30]/5 p-3">
                    <div className="flex items-center gap-2 text-xs text-[#FF3B30] font-mono">
                      <WarningIcon size={14} weight="fill" />
                      {result.alerts_triggered.length} alert rule(s) triggered by this file
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="border border-[#262626] bg-[#121212]" data-testid="uploaded-list">
            <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-widest">UPLOADED EXPERIENCES ({uploaded.length})</div>
            {uploaded.length === 0 && <div className="p-6 text-center text-xs text-[#71717A]">No uploads yet. Drop a file to get started.</div>}
            {uploaded.map(u => (
              <div key={u.id} className="p-4 border-b border-[#1E1E1E] flex justify-between items-center hover:bg-[#1E1E1E] transition-colors" data-testid={`uploaded-${u.id}`}>
                <div>
                  <div className="text-[11px] text-[#FFB000] font-mono">{u.id}</div>
                  <div className="text-sm">{u.well_name} · <span className="text-[#71717A]">{u.formation}</span></div>
                  <div className="text-[10px] text-[#71717A]">{u.filename} · {u.row_count > 0 ? `${u.row_count} rows` : "narrative"} · {u.event_type}</div>
                </div>
                <span className={`pill ${u.severity === "high" ? "pill-danger" : u.severity === "medium" ? "pill-amber" : "pill-muted"}`}>{u.severity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
