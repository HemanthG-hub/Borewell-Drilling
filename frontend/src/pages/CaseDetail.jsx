import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import ExperienceDnaFlow from "@/components/ExperienceDnaFlow";
import { fetchCase, fetchSensorTrace, fetchCaseEvidence, fetchExperienceDna } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { ArrowLeftIcon, FileTextIcon, WarningOctagonIcon, LightbulbFilamentIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import jsPDF from "jspdf";
import { toast } from "sonner";

function generatePdf(caseData, evidence, trace) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  let y = 50;

  // Header
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255, 176, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("RIGRECALL", 40, 35);
  doc.setFontSize(10);
  doc.setTextColor(161, 161, 170);
  doc.text("INCIDENT REPORT", 40, 52);
  doc.setFontSize(9);
  doc.text(new Date().toISOString().slice(0, 19).replace("T", " "), W - 40, 35, { align: "right" });

  y = 100;
  // Case title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`${caseData.id} · ${caseData.event_type.replace("_", " ").toUpperCase()}`, 40, y);
  y += 18;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`${caseData.well_name} · ${caseData.formation} @ ${caseData.depth_ft.toLocaleString()} ft`, 40, y);
  y += 25;

  // Summary grid
  doc.setFillColor(245, 245, 245);
  doc.rect(40, y, W - 80, 60, "F");
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  const cols = [
    ["SEVERITY", caseData.severity.toUpperCase()],
    ["OUTCOME", caseData.outcome.toUpperCase()],
    ["TIME LOST", `${caseData.time_lost_hrs} h`],
    ["COST", `$${(caseData.cost_impact_usd / 1000).toFixed(0)}k`],
    ["DATE", caseData.date],
  ];
  const colW = (W - 80) / cols.length;
  cols.forEach(([label, val], i) => {
    const cx = 40 + i * colW + 10;
    doc.setFontSize(7); doc.setTextColor(120, 120, 120);
    doc.text(label, cx, y + 18);
    doc.setFontSize(14); doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold");
    doc.text(String(val), cx, y + 40);
    doc.setFont("helvetica", "normal");
  });
  y += 80;

  // Sensor trace chart (drawn manually as line chart)
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Sensor Trace · Torque vs Depth", 40, y);
  y += 10;
  const chartH = 130, chartW = W - 80, chartX = 40, chartY = y;
  doc.setDrawColor(200, 200, 200);
  doc.rect(chartX, chartY, chartW, chartH);
  // event line
  if (trace.length > 0) {
    const depths = trace.map(t => t.depth_ft);
    const torques = trace.map(t => t.torque_kftlbs);
    const dMin = Math.min(...depths), dMax = Math.max(...depths);
    const tMin = Math.min(...torques), tMax = Math.max(...torques);
    doc.setDrawColor(255, 176, 0);
    doc.setLineWidth(1.5);
    for (let i = 1; i < trace.length; i++) {
      const x1 = chartX + ((depths[i - 1] - dMin) / (dMax - dMin || 1)) * chartW;
      const y1 = chartY + chartH - ((torques[i - 1] - tMin) / (tMax - tMin || 1)) * chartH;
      const x2 = chartX + ((depths[i] - dMin) / (dMax - dMin || 1)) * chartW;
      const y2 = chartY + chartH - ((torques[i] - tMin) / (tMax - tMin || 1)) * chartH;
      doc.line(x1, y1, x2, y2);
    }
    // event ref line
    if (caseData.depth_ft >= dMin && caseData.depth_ft <= dMax) {
      const ex = chartX + ((caseData.depth_ft - dMin) / (dMax - dMin || 1)) * chartW;
      doc.setDrawColor(255, 59, 48);
      doc.setLineDashPattern([3, 3], 0);
      doc.line(ex, chartY, ex, chartY + chartH);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(8);
      doc.setTextColor(255, 59, 48);
      doc.text("EVENT", ex + 3, chartY + 10);
    }
    doc.setLineWidth(0.5);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Torque: ${tMin.toFixed(1)} – ${tMax.toFixed(1)} kft·lbs`, chartX, chartY + chartH + 12);
    doc.text(`Depth: ${dMin.toFixed(0)} – ${dMax.toFixed(0)} ft`, chartX + chartW - 120, chartY + chartH + 12);
  }
  y = chartY + chartH + 30;

  // Timeline
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Evidence Timeline", 40, y);
  y += 15;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const sorted = [...evidence].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  sorted.forEach(e => {
    if (y > 720) { doc.addPage(); y = 50; }
    doc.setTextColor(255, 176, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`◆ ${e.type.replace("_", " ").toUpperCase()}`, 40, y);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${new Date(e.timestamp).toLocaleString()} · ${e.author} · conf ${(e.confidence * 100).toFixed(0)}%`, 200, y);
    y += 12;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(e.content, W - 80);
    doc.text(lines, 55, y);
    y += lines.length * 11;
    if (e.conflict) {
      doc.setTextColor(255, 59, 48);
      doc.setFontSize(8);
      doc.text(`⚠ CONFLICT: ${e.conflict.reason}`, 55, y);
      y += 12;
    }
    y += 6;
  });

  // Action / Lessons
  if (y > 650) { doc.addPage(); y = 50; }
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Action Taken", 40, y); y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
  const actLines = doc.splitTextToSize(caseData.action_taken || "—", W - 80);
  doc.text(actLines, 40, y); y += actLines.length * 12 + 12;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
  doc.text("Lessons Learned", 40, y); y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
  const lesLines = doc.splitTextToSize(caseData.lessons || "—", W - 80);
  doc.text(lesLines, 40, y); y += lesLines.length * 12;

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`RigRecall · Confidential · Page ${i}/${pages}`, W / 2, 792 - 20, { align: "center" });
  }

  doc.save(`${caseData.id}_report.pdf`);
}

export default function CaseDetail() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [trace, setTrace] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [dna, setDna] = useState(null);

  useEffect(() => {
    fetchCase(id).then(setCaseData);
    fetchSensorTrace(id).then(d => setTrace(d.trace));
    fetchCaseEvidence(id).then(setEvidence);
    fetchExperienceDna(id).then(setDna);
  }, [id]);

  if (!caseData) return <Layout title="Loading..." />;

  return (
    <Layout title={caseData.id} subtitle={`${caseData.well_name} · ${caseData.formation} @ ${caseData.depth_ft.toLocaleString()} ft`}
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => { generatePdf(caseData, evidence, trace); toast.success("Report downloaded"); }}
            className="btn-amber"
            data-testid="download-pdf">
            <DownloadSimpleIcon size={12} weight="bold" className="inline mr-1" /> PDF REPORT
          </button>
          <Link to="/cases" className="btn-ghost" data-testid="back-to-cases"><ArrowLeftIcon size={12} weight="bold" className="inline mr-1" />BACK</Link>
        </div>
      }>

      {/* Experience DNA - primary innovation */}
      {dna && <div className="mb-6"><ExperienceDnaFlow dna={dna} /></div>}

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
