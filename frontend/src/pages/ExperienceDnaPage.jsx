import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import ExperienceDnaFlow from "@/components/ExperienceDnaFlow";
import { fetchCases, fetchExperienceDna } from "@/lib/api";
import { DnaIcon, ArrowRightIcon } from "@phosphor-icons/react";

export default function ExperienceDnaPage() {
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dna, setDna] = useState(null);

  useEffect(() => {
    fetchCases().then(cs => {
      setCases(cs);
      if (cs.length > 0) setSelected(cs[0].id);
    });
  }, []);

  useEffect(() => {
    if (selected) fetchExperienceDna(selected).then(setDna);
  }, [selected]);

  return (
    <Layout title="Experience DNA" subtitle="Every historical case as a reusable, evidence-backed drilling experience">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3 border border-[#262626] bg-[#121212]" data-testid="dna-case-list">
          <div className="px-3 py-2 border-b border-[#262626] font-display font-bold text-xs tracking-widest text-[#71717A] flex items-center gap-2">
            <DnaIcon size={14} weight="fill" className="text-[#FFB000]" />
            SELECT EXPERIENCE
          </div>
          <div className="max-h-[720px] overflow-auto">
            {cases.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                data-testid={`dna-case-${c.id}`}
                className={`w-full text-left px-3 py-3 border-b border-[#1E1E1E] transition-colors ${selected === c.id ? "bg-[#1E1E1E] border-l-2 border-l-[#FFB000]" : "hover:bg-[#1E1E1E]"}`}>
                <div className="text-[11px] text-[#FFB000] font-mono">{c.id}</div>
                <div className="text-xs text-white mt-1">{c.event_type.replace(/_/g, " ")}</div>
                <div className="text-[10px] text-[#71717A]">{c.well_name}</div>
                <div className={`pill mt-1 ${c.severity === "critical" ? "pill-danger" : c.severity === "high" ? "pill-amber" : "pill-muted"}`}>{c.severity}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-9 space-y-4">
          {dna && <ExperienceDnaFlow dna={dna} />}
          {selected && (
            <div className="flex justify-end">
              <Link to={`/cases/${selected}`} className="btn-ghost inline-flex items-center gap-1" data-testid="open-full-case">
                OPEN FULL CASE <ArrowRightIcon size={10} weight="bold" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
