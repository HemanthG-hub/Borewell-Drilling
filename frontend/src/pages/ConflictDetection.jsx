import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { fetchConflicts } from "@/lib/api";
import { WarningOctagonIcon, ArrowsLeftRightIcon, ScalesIcon, UserFocusIcon } from "@phosphor-icons/react";

const impactColor = { HIGH: "#FF3B30", MEDIUM: "#FFB000", LOW: "#A1A1AA" };

export default function ConflictDetection() {
  const [conflicts, setConflicts] = useState([]);
  useEffect(() => { fetchConflicts().then(setConflicts); }, []);

  return (
    <Layout title="Conflict Detection" subtitle={`${conflicts.length} pieces of contradictory evidence — each requires human review before trust`}>
      <div className="mb-4 border-l-2 border-[#FF3B30] bg-[#121212] p-4" data-testid="conflict-summary">
        <div className="flex items-center gap-2 mb-2">
          <WarningOctagonIcon size={18} weight="fill" className="text-[#FF3B30]" />
          <div className="font-display font-bold text-sm tracking-widest">DISAGREEMENT SCANNER</div>
        </div>
        <p className="text-[13px] text-[#A1A1AA]">
          RigRecall cross-checks sensor data against human reports. Where they disagree — pit gains, mechanism attribution, magnitudes — you&apos;ll see the impact level, why it matters, and a clear path to human review.
        </p>
      </div>

      <div className="space-y-4">
        {conflicts.map((c, i) => (
          <div key={i} className="border bg-[#121212]"
            style={{ borderColor: `${impactColor[c.impact_level]}66` }}
            data-testid={`conflict-${i}`}>
            <div className="px-4 py-3 border-b border-[#262626] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="pill pill-danger">CONFLICT #{i + 1}</span>
                <Link to={`/cases/${c.case_id}`} className="text-[#FFB000] text-xs font-mono hover:underline" data-testid={`conflict-case-${c.case_id}`}>
                  {c.case_id}
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <ScalesIcon size={16} style={{ color: impactColor[c.impact_level] }} weight="fill" />
                  <span className="text-[10px] tracking-widest" style={{ color: impactColor[c.impact_level] }}>
                    IMPACT: <span className="font-bold">{c.impact_level}</span>
                  </span>
                </div>
                <ArrowsLeftRightIcon size={20} className="text-[#FF3B30]" weight="bold" />
              </div>
            </div>

            <div className="p-4 text-sm font-mono border-b border-[#1E1E1E]" style={{ color: impactColor[c.impact_level] }}>
              ⚠ {c.reason}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-[#1E1E1E]">
              <div className="p-4 border-r border-[#1E1E1E]">
                <div className="text-[10px] tracking-widest text-[#71717A] mb-2">EVIDENCE A</div>
                <div className="flex gap-2 mb-2">
                  <span className="pill pill-muted">{c.evidence_a.type.replace(/_/g, " ")}</span>
                  <span className="text-[10px] text-[#71717A]">{c.evidence_a.author}</span>
                </div>
                <div className="font-mono text-[12px] text-white mb-2">{c.evidence_a.content}</div>
                <div className="text-[10px] text-[#71717A]">CONFIDENCE {(c.evidence_a.confidence * 100).toFixed(0)}%</div>
              </div>
              <div className="p-4">
                <div className="text-[10px] tracking-widest text-[#71717A] mb-2">EVIDENCE B</div>
                <div className="flex gap-2 mb-2">
                  <span className="pill pill-muted">{c.evidence_b?.type.replace(/_/g, " ")}</span>
                  <span className="text-[10px] text-[#71717A]">{c.evidence_b?.author}</span>
                </div>
                <div className="font-mono text-[12px] text-white mb-2">{c.evidence_b?.content}</div>
                <div className="text-[10px] text-[#71717A]">CONFIDENCE {c.evidence_b ? (c.evidence_b.confidence * 100).toFixed(0) : "—"}%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-[#1E1E1E]">
              <div className="p-4">
                <div className="text-[10px] tracking-widest text-[#FFB000] mb-2">WHY IT MATTERS</div>
                <div className="text-[13px] text-[#E4E4E7]">{c.why_it_matters}</div>
              </div>
              <div className="p-4 bg-[#0A0A0A]">
                <div className="text-[10px] tracking-widest text-[#71717A] mb-2">STATUS</div>
                <div className="flex items-center gap-2">
                  <UserFocusIcon size={16} className="text-[#FFB000]" weight="fill" />
                  <div className="text-[13px] text-[#FFB000] font-bold">{c.status}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
