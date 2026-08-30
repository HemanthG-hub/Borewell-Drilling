import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { fetchConflicts } from "@/lib/api";
import { WarningOctagonIcon, ArrowsLeftRightIcon } from "@phosphor-icons/react";

export default function ConflictDetection() {
  const [conflicts, setConflicts] = useState([]);
  useEffect(() => { fetchConflicts().then(setConflicts); }, []);

  return (
    <Layout title="Conflict Detection" subtitle={`${conflicts.length} pieces of contradictory evidence flagged across cases`}>
      <div className="mb-4 border-l-2 border-[#FF3B30] bg-[#121212] p-4" data-testid="conflict-summary">
        <div className="flex items-center gap-2 mb-2">
          <WarningOctagonIcon size={18} weight="fill" className="text-[#FF3B30]" />
          <div className="font-display font-bold text-sm tracking-widest">DISAGREEMENT SCANNER</div>
        </div>
        <p className="text-[13px] text-[#A1A1AA]">
          RigRecall cross-checks sensor data against human reports. Where they disagree — pit gains, mechanism attribution, magnitudes — you&apos;ll find them here with the original proof.
        </p>
      </div>

      <div className="space-y-4">
        {conflicts.map((c, i) => (
          <div key={i} className="border border-[#FF3B30]/40 bg-[#121212]" data-testid={`conflict-${i}`}>
            <div className="px-4 py-3 border-b border-[#262626] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="pill pill-danger">CONFLICT #{i + 1}</span>
                <Link to={`/cases/${c.case_id}`} className="text-[#FFB000] text-xs font-mono hover:underline" data-testid={`conflict-case-${c.case_id}`}>
                  {c.case_id}
                </Link>
              </div>
              <ArrowsLeftRightIcon size={20} className="text-[#FF3B30]" weight="bold" />
            </div>
            <div className="p-4 text-sm text-[#FF3B30] font-mono border-b border-[#1E1E1E]">
              ⚠ {c.reason}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-4 border-r border-[#1E1E1E]">
                <div className="text-[10px] tracking-widest text-[#71717A] mb-2">EVIDENCE A</div>
                <div className="flex gap-2 mb-2">
                  <span className="pill pill-muted">{c.evidence_a.type.replace("_", " ")}</span>
                  <span className="text-[10px] text-[#71717A]">{c.evidence_a.author}</span>
                </div>
                <div className="font-mono text-[12px] text-white mb-2">{c.evidence_a.content}</div>
                <div className="text-[10px] text-[#71717A]">CONFIDENCE {(c.evidence_a.confidence * 100).toFixed(0)}%</div>
              </div>
              <div className="p-4">
                <div className="text-[10px] tracking-widest text-[#71717A] mb-2">EVIDENCE B</div>
                <div className="flex gap-2 mb-2">
                  <span className="pill pill-muted">{c.evidence_b?.type.replace("_", " ")}</span>
                  <span className="text-[10px] text-[#71717A]">{c.evidence_b?.author}</span>
                </div>
                <div className="font-mono text-[12px] text-white mb-2">{c.evidence_b?.content}</div>
                <div className="text-[10px] text-[#71717A]">CONFIDENCE {c.evidence_b ? (c.evidence_b.confidence * 100).toFixed(0) : "—"}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
