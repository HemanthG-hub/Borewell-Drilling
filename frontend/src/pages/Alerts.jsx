import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api, fetchAlertSituations } from "@/lib/api";
import { BellRingingIcon, TrashIcon, PlusIcon, WarningOctagonIcon, StackSimpleIcon, TrendUpIcon, TrendDownIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

const METRICS = [
  { value: "torque_kftlbs", label: "Torque (kft·lbs)" },
  { value: "rop_ft_hr", label: "ROP (ft/hr)" },
  { value: "mud_weight_ppg", label: "Mud Weight (ppg)" },
];
const OPS = [
  { value: "gt", label: ">" }, { value: "gte", label: "≥" },
  { value: "lt", label: "<" }, { value: "lte", label: "≤" },
];
const SEVS = ["low", "medium", "high", "critical"];

const situationIcon = { "Torque Escalation": TrendUpIcon, "ROP Deterioration": TrendDownIcon };
const sevPill = { critical: "pill-danger", high: "pill-danger", medium: "pill-amber", low: "pill-muted" };

export default function Alerts() {
  const [rules, setRules] = useState([]);
  const [situations, setSituations] = useState({ raw_breaches: 0, situations: [], combined_situations: [] });
  const [form, setForm] = useState({ name: "", metric: "torque_kftlbs", operator: "gt", threshold: 22, severity: "high" });

  const refresh = () => {
    api.get("/alerts/rules").then(r => setRules(r.data));
    fetchAlertSituations().then(setSituations);
  };
  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 4000);
    return () => clearInterval(i);
  }, []);

  const create = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    await api.post("/alerts/rules", { ...form, threshold: parseFloat(form.threshold) });
    toast.success("Rule created");
    setForm({ ...form, name: "" });
    refresh();
  };

  const remove = async (id) => {
    await api.delete(`/alerts/rules/${id}`);
    toast.success("Rule removed");
    refresh();
  };

  const clearAll = async () => {
    await api.post("/alerts/clear");
    toast.success("Cleared");
    refresh();
  };

  return (
    <Layout title="Alerts" subtitle={`${rules.length} rules · ${situations.raw_breaches} raw breaches clustered into ${situations.situations.length + situations.combined_situations.length} meaningful situations`}
      actions={<button onClick={clearAll} className="btn-ghost" data-testid="clear-alerts">CLEAR</button>}>

      <div className="border-l-2 border-[#71717A] bg-[#1E1E1E] px-4 py-3 mb-4" data-testid="alerts-flow">
        <div className="font-display font-bold text-[10px] tracking-[0.2em] text-[#71717A] mb-1">STORY</div>
        <div className="text-[12px] text-[#E4E4E7] font-mono">
          LIVE SIGNAL → SITUATION DETECTED → RECALL SIMILAR EXPERIENCES → SHOW ACTIONS &amp; OUTCOMES
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="border border-[#262626] bg-[#121212] p-5" data-testid="rule-form">
            <div className="flex items-center gap-2 mb-4">
              <PlusIcon size={16} weight="bold" className="text-[#FFB000]" />
              <div className="font-display font-bold text-sm tracking-widest">NEW RULE</div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] tracking-widest text-[#71717A] mb-1">NAME</div>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  data-testid="rule-name"
                  placeholder="e.g. High Torque · Wolfcamp"
                  className="w-full bg-[#0A0A0A] border border-[#262626] px-3 py-2 text-[13px] text-white font-mono focus:outline-none focus:border-[#FFB000]" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] tracking-widest text-[#71717A] mb-1">METRIC</div>
                  <select value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}
                    data-testid="rule-metric"
                    className="w-full bg-[#0A0A0A] border border-[#262626] px-2 py-2 text-[12px] text-white font-mono focus:outline-none focus:border-[#FFB000]">
                    {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] tracking-widest text-[#71717A] mb-1">OP</div>
                  <select value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value })}
                    data-testid="rule-operator"
                    className="w-full bg-[#0A0A0A] border border-[#262626] px-2 py-2 text-[12px] text-white font-mono focus:outline-none focus:border-[#FFB000]">
                    {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] tracking-widest text-[#71717A] mb-1">THRESHOLD</div>
                  <input type="number" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })}
                    data-testid="rule-threshold"
                    className="w-full bg-[#0A0A0A] border border-[#262626] px-2 py-2 text-[12px] text-white font-mono focus:outline-none focus:border-[#FFB000]" />
                </div>
              </div>
              <div>
                <div className="text-[10px] tracking-widest text-[#71717A] mb-1">SEVERITY</div>
                <div className="flex gap-2">
                  {SEVS.map(s => (
                    <button key={s} onClick={() => setForm({ ...form, severity: s })}
                      data-testid={`sev-${s}`}
                      className={`px-3 py-1 text-[11px] font-display font-bold tracking-wider transition-colors ${form.severity === s ? "bg-[#FFB000] text-black" : "border border-[#262626] text-[#A1A1AA] hover:text-[#FFB000] hover:border-[#FFB000]"}`}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={create} className="btn-amber w-full" data-testid="rule-create">CREATE RULE</button>
            </div>
          </div>

          <div className="border border-[#262626] bg-[#121212]" data-testid="rules-list">
            <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-widest">ACTIVE RULES ({rules.length})</div>
            {rules.length === 0 && <div className="p-6 text-xs text-[#71717A] text-center">No rules yet.</div>}
            {rules.map(r => (
              <div key={r.id} className="p-4 border-b border-[#1E1E1E] flex justify-between items-center" data-testid={`rule-${r.id}`}>
                <div>
                  <div className="text-sm text-white font-bold">{r.name}</div>
                  <div className="text-[11px] text-[#A1A1AA] font-mono mt-1">
                    IF <span className="text-[#FFB000]">{r.metric}</span> {OPS.find(o => o.value === r.operator)?.label} <span className="text-[#FFB000]">{r.threshold}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`pill ${sevPill[r.severity]}`}>{r.severity}</span>
                  <button onClick={() => remove(r.id)} className="text-[#71717A] hover:text-[#FF3B30] transition-colors" data-testid={`delete-rule-${r.id}`}>
                    <TrashIcon size={16} weight="regular" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-4">
          {/* Cluster header */}
          <div className="border border-[#262626] bg-[#121212] p-4 flex justify-between items-center" data-testid="cluster-header">
            <div>
              <div className="text-[10px] tracking-widest text-[#71717A]">RAW → CLUSTERED</div>
              <div className="font-display text-2xl">
                <span className="text-[#FF3B30]">{situations.raw_breaches}</span>
                <span className="text-[#71717A] mx-2 text-lg">Raw Signal Breaches</span>
                <span className="text-[#FFB000] mx-2">→</span>
                <span className="text-[#FFB000]">{situations.situations.length + situations.combined_situations.length}</span>
                <span className="text-[#71717A] ml-2 text-lg">Operational Situations</span>
              </div>
            </div>
            <StackSimpleIcon size={28} weight="fill" className="text-[#FFB000]" />
          </div>

          {/* Situations */}
          <div className="border border-[#262626] bg-[#121212]" data-testid="situations-list">
            <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-widest flex items-center gap-2">
              <BellRingingIcon size={16} weight="fill" className="text-[#FFB000]" />
              MEANINGFUL SITUATIONS
            </div>
            {situations.situations.length === 0 && situations.combined_situations.length === 0 &&
              <div className="p-6 text-xs text-[#71717A] text-center">Waiting for the live feed to breach a threshold...</div>}

            {situations.combined_situations.map((s, i) => (
              <div key={`c${i}`} className="p-4 border-b border-[#1E1E1E] bg-[#1E1E1E]/40" data-testid={`combined-${i}`}>
                <div className="flex items-center gap-2 mb-1">
                  <WarningOctagonIcon size={16} weight="fill" className="text-[#FF3B30]" />
                  <div className="font-display font-bold text-white">{s.situation_label}</div>
                  <span className={`pill ${sevPill[s.overall_severity]}`}>{s.overall_severity}</span>
                </div>
                <div className="text-[11px] text-[#A1A1AA] font-mono">
                  {s.well_id} · Components: {s.components.join(" + ")}
                </div>
              </div>
            ))}

            {situations.situations.map((s, i) => {
              const Icon = situationIcon[s.situation_label] || WarningOctagonIcon;
              return (
                <div key={i} className="p-4 border-b border-[#1E1E1E]" data-testid={`situation-${i}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <Icon size={20} weight="fill" className="text-[#FFB000]" />
                      <div>
                        <div className="font-display font-bold text-white">{s.situation_label}</div>
                        <div className="text-[11px] text-[#A1A1AA] font-mono">
                          {s.metric} · peak <span className="text-[#FFB000]">{s.peak_value?.toFixed?.(2)}</span> · rule {s.threshold}
                        </div>
                        <div className="text-[10px] text-[#71717A] font-mono mt-1">
                          {s.breach_count} breaches · {s.well_name}
                        </div>
                      </div>
                    </div>
                    <span className={`pill ${sevPill[s.overall_severity]}`}>{s.overall_severity}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
