import React, { useEffect, useState } from "react";
import { api, API } from "@/lib/api";
import Layout from "@/components/Layout";
import { UploadSimpleIcon, FileTextIcon, CheckCircleIcon, WarningIcon } from "@phosphor-icons/react";
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
      toast.success(`Case ${data.case.id} ingested (${data.case.row_count} rows)`);
      refresh();
    } catch (e) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout title="Case Upload" subtitle="Turn a mud log, LAS or CSV file into a new case with sensor trace + auto-detected events">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5 border border-[#262626] bg-[#121212] p-5" data-testid="upload-panel">
          <div className="flex items-center gap-2 mb-4">
            <UploadSimpleIcon size={18} weight="fill" className="text-[#FFB000]" />
            <div className="font-display font-bold text-sm tracking-widest">DROP A FILE</div>
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
              <div className="text-[10px] tracking-widest text-[#71717A] mb-1">FILE (.LAS, .CSV, .JSON)</div>
              <label className="block border border-dashed border-[#262626] p-6 text-center cursor-pointer hover:border-[#FFB000] transition-colors">
                <FileTextIcon size={28} className="text-[#FFB000] mx-auto mb-2" weight="duotone" />
                <div className="text-xs text-[#A1A1AA]">{file ? file.name : "Click to select or drop file"}</div>
                <input type="file" accept=".las,.csv,.json" className="hidden"
                  data-testid="upload-file-input"
                  onChange={e => setFile(e.target.files?.[0])} />
              </label>
            </div>

            <button onClick={submit} disabled={uploading || !file}
              className="btn-amber w-full disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="upload-submit">
              {uploading ? "INGESTING..." : "INGEST CASE"}
            </button>
          </div>

          <div className="mt-5 text-[10px] text-[#71717A] leading-relaxed">
            CSV columns: <span className="text-[#FFB000]">depth_ft, rop_ft_hr, torque_kftlbs, mud_weight_ppg</span><br />
            LAS: Standard LAS 2.0 with DEPT/ROP/TORQUE/MW curves<br />
            Ingested data is scanned for torque spikes and ROP drops. Fires active alert rules.
          </div>
        </div>

        <div className="col-span-12 md:col-span-7 space-y-4">
          {result && (
            <div className="border-l-2 border-[#34C759] bg-[#121212] p-4" data-testid="upload-result">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon size={18} weight="fill" className="text-[#34C759]" />
                <div className="font-display font-bold text-sm tracking-widest">INGESTED · {result.case.id}</div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs font-mono mb-3">
                <div><span className="text-[#71717A]">EVENT:</span> {result.case.event_type}</div>
                <div><span className="text-[#71717A]">SEVERITY:</span> <span className={result.case.severity === "high" ? "text-[#FF3B30]" : "text-[#FFB000]"}>{result.case.severity}</span></div>
                <div><span className="text-[#71717A]">DEPTH:</span> {result.case.depth_ft} ft</div>
                <div><span className="text-[#71717A]">ROWS:</span> {result.case.row_count}</div>
              </div>
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
              {result.alerts_triggered?.length > 0 && (
                <div className="mt-3 border border-[#FF3B30]/40 bg-[#FF3B30]/5 p-3">
                  <div className="flex items-center gap-2 text-xs text-[#FF3B30] font-mono">
                    <WarningIcon size={14} weight="fill" />
                    {result.alerts_triggered.length} alert rule(s) triggered by this file
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border border-[#262626] bg-[#121212]" data-testid="uploaded-list">
            <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-widest">UPLOADED CASES ({uploaded.length})</div>
            {uploaded.length === 0 && <div className="p-6 text-center text-xs text-[#71717A]">No uploads yet. Drop a file to get started.</div>}
            {uploaded.map(u => (
              <div key={u.id} className="p-4 border-b border-[#1E1E1E] flex justify-between items-center hover:bg-[#1E1E1E] transition-colors" data-testid={`uploaded-${u.id}`}>
                <div>
                  <div className="text-[11px] text-[#FFB000] font-mono">{u.id}</div>
                  <div className="text-sm">{u.well_name} · <span className="text-[#71717A]">{u.formation}</span></div>
                  <div className="text-[10px] text-[#71717A]">{u.filename} · {u.row_count} rows · {u.event_type}</div>
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
