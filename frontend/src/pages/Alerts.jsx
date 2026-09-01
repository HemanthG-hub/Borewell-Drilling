import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { BellRingingIcon, TrashIcon, PlusIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

const METRICS = [
  { value: "torque_kftlbs", label: "Torque (kft·lbs)" },
  { value: "rop_ft_hr", label: "ROP (ft/hr)" },
  { value: "mud_weight_ppg", label: "Mud Weight (ppg)" },
];
const OPS = [
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
];
const SEVS = ["low", "medium", "high", "critical"];

export default function Alerts() {
  const [rules, setRules] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState({ name: "", metric: "torque_kftlbs", operator: "gt", threshold: 22, severity: "high" });

  const refresh = () => {
    api.get("/alerts/rules").then(r => setRules(r.data));
    api.get("/alerts").then(r => setAlerts(r.data));
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
    <Layout title="Alert Rules" subtitle={`${rules.length} rules · ${alerts.filter(a => !a.read).length} unread triggered alerts`}
      actions={<button onClick={clearAll} className="btn-ghost" data-testid="clear-alerts">CLEAR ALERTS</button>}>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5 border border-[#262626] bg-[#121212] p-5" data-testid="rule-form">
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

        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="border border-[#262626] bg-[#121212]" data-testid="rules-list">
            <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-widest">ACTIVE RULES ({rules.length})</div>
            {rules.length === 0 && <div className="p-6 text-xs text-[#71717A] text-center">No rules yet. Create one on the left.</div>}
            {rules.map(r => (
              <div key={r.id} className="p-4 border-b border-[#1E1E1E] flex justify-between items-center" data-testid={`rule-${r.id}`}>
                <div>
                  <div className="text-sm text-white font-bold">{r.name}</div>
                  <div className="text-[11px] text-[#A1A1AA] font-mono mt-1">
                    IF <span className="text-[#FFB000]">{r.metric}</span> {OPS.find(o => o.value === r.operator)?.label} <span className="text-[#FFB000]">{r.threshold}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`pill ${r.severity === "critical" ? "pill-danger" : r.severity === "high" ? "pill-amber" : "pill-muted"}`}>{r.severity}</span>
                  <button onClick={() => remove(r.id)} className="text-[#71717A] hover:text-[#FF3B30] transition-colors" data-testid={`delete-rule-${r.id}`}>
                    <TrashIcon size={16} weight="regular" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-[#262626] bg-[#121212]" data-testid="triggered-alerts">
            <div className="px-4 py-3 border-b border-[#262626] font-display font-bold text-sm tracking-widest flex items-center gap-2">
              <BellRingingIcon size={16} weight="fill" className="text-[#FFB000]" />
              TRIGGERED ({alerts.length})
            </div>
            {alerts.length === 0 && <div className="p-6 text-xs text-[#71717A] text-center">Waiting for the live feed to breach a threshold...</div>}
            <div className="max-h-[400px] overflow-y-auto">
              {alerts.map(a => (
                <div key={a.id} className="p-3 border-b border-[#1E1E1E] flex justify-between items-start hover:bg-[#1E1E1E] transition-colors" data-testid={`alert-${a.id}`}>
                  <div className="flex gap-3">
                    <WarningOctagonIcon size={18} weight="fill" className={a.severity === "critical" ? "text-[#FF3B30]" : "text-[#FFB000]"} />
                    <div>
                      <div className="text-xs text-white font-bold">{a.rule_name}</div>
                      <div className="text-[11px] text-[#A1A1AA] font-mono">
                        {a.metric} = <span className="text-[#FFB000]">{a.value?.toFixed(2)}</span> (rule {a.threshold}) · {a.well_name}
                      </div>
                      <div className="text-[10px] text-[#71717A] font-mono">{new Date(a.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <span className={`pill ${a.severity === "critical" ? "pill-danger" : "pill-amber"}`}>{a.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
