import React from "react";
import { DnaIcon, ArrowDownIcon, CheckCircleIcon, WarningIcon, FileTextIcon } from "@phosphor-icons/react";

/**
 * Vertical Experience DNA flow
 * CONTEXT → EVENT → ACTION → OUTCOME → LESSON → EVIDENCE
 */
const STEP_ICONS = {
  context: FileTextIcon, event: WarningIcon, action: CheckCircleIcon,
  outcome: CheckCircleIcon, lesson: FileTextIcon, evidence: FileTextIcon,
};

const STEP_COLORS = {
  context: "#A1A1AA", event: "#FF3B30", action: "#FFB000",
  outcome: "#34C759", lesson: "#E35205", evidence: "#FFB000",
};

function StepNode({ step, isLast }) {
  const Icon = STEP_ICONS[step.step] || FileTextIcon;
  const color = STEP_COLORS[step.step] || "#FFB000";
  const c = step.content || {};
  const documented = step.documented !== false;

  return (
    <div className="relative" data-testid={`dna-step-${step.step}`}>
      <div className="flex gap-4">
        {/* left rail */}
        <div className="flex flex-col items-center" style={{ minWidth: 36 }}>
          <div className="w-9 h-9 flex items-center justify-center border" style={{ borderColor: color, background: "#121212" }}>
            <Icon size={18} weight="fill" style={{ color }} />
          </div>
          {!isLast && <div className="w-px flex-1 mt-1" style={{ background: `linear-gradient(${color}, #262626)` }}></div>}
        </div>

        {/* content */}
        <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-display font-black text-xs tracking-[0.25em]" style={{ color }}>{step.label}</div>
            <div className="flex items-center gap-2">
              {!documented && <span className="pill pill-danger">KNOWLEDGE GAP</span>}
              {step.evidence_count > 0 && (
                <span className="text-[9px] tracking-widest text-[#71717A]">
                  <FileTextIcon size={10} weight="regular" className="inline mr-1" />
                  {step.evidence_count} EVIDENCE
                </span>
              )}
            </div>
          </div>

          <div className="border-l-2 pl-4 py-2" style={{ borderColor: color }}>
            {step.step === "context" && (
              <div className="space-y-1 text-[13px]">
                <div><span className="text-[#71717A]">Formation:</span> <span className="text-white">{c.formation}</span></div>
                <div><span className="text-[#71717A]">Depth:</span> <span className="text-white">{c.depth_ft?.toLocaleString?.()} ft</span></div>
                <div><span className="text-[#71717A]">Well:</span> <span className="text-white">{c.well}</span></div>
                <div><span className="text-[#71717A]">Conditions:</span> <span className="text-white">{c.conditions}</span></div>
              </div>
            )}
            {step.step === "event" && (
              <div className="space-y-2">
                <div className="text-white text-[15px] font-bold">{c.event_type}</div>
                <div className="flex gap-1 flex-wrap">
                  <span className={`pill ${c.severity === "critical" ? "pill-danger" : c.severity === "high" ? "pill-amber" : "pill-muted"}`}>{c.severity}</span>
                  {(c.symptoms || []).map(s => <span key={s} className="pill pill-muted">{s.replace(/_/g, " ")}</span>)}
                </div>
              </div>
            )}
            {step.step === "action" && (
              <div className="text-white text-[13px] leading-relaxed">{c.action}</div>
            )}
            {step.step === "outcome" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`pill ${c.outcome === "resolved" ? "pill-success" : c.outcome === "in_progress" ? "pill-amber" : "pill-danger"}`}>{c.outcome}</span>
                  {c.time_lost_hrs > 0 && <span className="text-[11px] font-mono text-[#71717A]">{c.time_lost_hrs}h lost</span>}
                  {c.cost_impact_usd > 0 && <span className="text-[11px] font-mono text-[#71717A]">${(c.cost_impact_usd / 1000).toFixed(0)}k</span>}
                </div>
              </div>
            )}
            {step.step === "lesson" && (
              <div className="text-white text-[13px] leading-relaxed italic">
                &ldquo;{c.lesson}&rdquo;
              </div>
            )}
            {step.step === "evidence" && (
              <div className="space-y-2">
                {(c.records || []).length === 0 && <div className="text-xs text-[#71717A]">No evidence linked</div>}
                {(c.records || []).map(r => (
                  <div key={r.id} className="border border-[#262626] p-2" data-testid={`dna-evidence-${r.id}`}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex gap-2 items-center">
                        <span className="pill pill-muted">{r.type.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-[#71717A]">{r.author}</span>
                      </div>
                      <span className="text-[9px] text-[#71717A]">CONF {(r.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-[12px] text-[#E4E4E7] font-mono">{r.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExperienceDnaFlow({ dna }) {
  if (!dna) return null;
  return (
    <div className="border border-[#262626] bg-[#121212] p-5" data-testid="experience-dna">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <DnaIcon size={22} weight="fill" className="text-[#FFB000]" />
          <div>
            <div className="font-display font-black text-lg tracking-tight">EXPERIENCE DNA</div>
            <div className="text-[10px] text-[#71717A] tracking-widest">CONTEXT → EVENT → ACTION → OUTCOME → LESSON → EVIDENCE</div>
          </div>
        </div>
        <div className="text-[10px] text-[#71717A] tracking-widest">CASE {dna.case_id}</div>
      </div>

      <div>
        {dna.steps.map((s, i) => (
          <StepNode key={s.step} step={s} isLast={i === dna.steps.length - 1} />
        ))}
      </div>
    </div>
  );
}
