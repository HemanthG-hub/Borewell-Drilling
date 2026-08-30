import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { fetchCases } from "@/lib/api";
import { ArrowRightIcon, FunnelIcon } from "@phosphor-icons/react";

export default function CaseLibrary() {
  const [cases, setCases] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchParams] = useSearchParams();
  const wellFilter = searchParams.get("well_id");

  useEffect(() => {
    fetchCases(wellFilter ? { well_id: wellFilter } : {}).then(setCases);
  }, [wellFilter]);

  const filtered = filter === "all" ? cases : cases.filter(c => c.event_type === filter);
  const eventTypes = ["all", ...new Set(cases.map(c => c.event_type))];

  return (
    <Layout title="Case Library" subtitle={`${filtered.length} drilling events in memory${wellFilter ? ` · filtered by well ${wellFilter}` : ""}`}>
      <div className="border border-[#262626] bg-[#121212] mb-4 flex items-center gap-2 p-3" data-testid="case-filter-bar">
        <FunnelIcon size={16} className="text-[#FFB000] ml-2" weight="fill" />
        <span className="text-[10px] tracking-widest text-[#71717A] mr-2">EVENT:</span>
        {eventTypes.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            data-testid={`filter-${t}`}
            className={`px-3 py-1 text-[11px] font-display font-bold tracking-wider transition-colors ${filter === t ? "bg-[#FFB000] text-black" : "border border-[#262626] text-[#A1A1AA] hover:text-[#FFB000] hover:border-[#FFB000]"}`}>
            {t.replace("_", " ").toUpperCase()}
          </button>
        ))}
      </div>

      <div className="border border-[#262626] bg-[#121212] overflow-hidden" data-testid="case-table">
        <table className="w-full text-xs">
          <thead className="bg-[#0A0A0A] text-[#71717A] tracking-widest text-[10px]">
            <tr>
              <th className="text-left px-4 py-3 font-display font-bold">CASE ID</th>
              <th className="text-left px-4 py-3 font-display font-bold">WELL</th>
              <th className="text-left px-4 py-3 font-display font-bold">FORMATION</th>
              <th className="text-right px-4 py-3 font-display font-bold">DEPTH</th>
              <th className="text-left px-4 py-3 font-display font-bold">EVENT</th>
              <th className="text-left px-4 py-3 font-display font-bold">SEVERITY</th>
              <th className="text-right px-4 py-3 font-display font-bold">TIME LOST</th>
              <th className="text-right px-4 py-3 font-display font-bold">COST</th>
              <th className="text-left px-4 py-3 font-display font-bold">OUTCOME</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-t border-[#1E1E1E] hover:bg-[#1E1E1E] transition-colors" data-testid={`case-tr-${c.id}`}>
                <td className="px-4 py-3 font-mono text-[#FFB000]">{c.id}</td>
                <td className="px-4 py-3">{c.well_name}</td>
                <td className="px-4 py-3 text-[#A1A1AA]">{c.formation}</td>
                <td className="px-4 py-3 text-right font-mono">{c.depth_ft.toLocaleString()}</td>
                <td className="px-4 py-3">{c.event_type.replace("_", " ")}</td>
                <td className="px-4 py-3"><span className={`pill ${c.severity === "critical" ? "pill-danger" : c.severity === "high" ? "pill-amber" : "pill-muted"}`}>{c.severity}</span></td>
                <td className="px-4 py-3 text-right font-mono">{c.time_lost_hrs}h</td>
                <td className="px-4 py-3 text-right font-mono">${(c.cost_impact_usd / 1000).toFixed(0)}k</td>
                <td className="px-4 py-3">
                  <span className={`pill ${c.outcome === "resolved" ? "pill-success" : "pill-amber"}`}>{c.outcome}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/cases/${c.id}`} className="text-[#FFB000] hover:underline text-xs" data-testid={`case-open-${c.id}`}>
                    OPEN <ArrowRightIcon size={11} weight="bold" className="inline" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
