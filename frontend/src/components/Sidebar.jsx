import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  GaugeIcon, StackIcon, MagnifyingGlassIcon, FileTextIcon, WarningOctagonIcon,
  ChatCenteredDotsIcon, HardHatIcon, UploadSimpleIcon, BellRingingIcon,
  DnaIcon, TrophyIcon,
} from "@phosphor-icons/react";

const sections = [
  {
    title: "OVERVIEW",
    items: [
      { to: "/", label: "Dashboard", icon: GaugeIcon, testId: "nav-dashboard" },
    ],
  },
  {
    title: "EXPERIENCE MEMORY",
    items: [
      { to: "/cases", label: "Case Library", icon: StackIcon, testId: "nav-cases" },
      { to: "/dna", label: "Experience DNA", icon: DnaIcon, testId: "nav-dna" },
    ],
  },
  {
    title: "RECALL INTELLIGENCE",
    items: [
      { to: "/recall", label: "Recall Engine", icon: MagnifyingGlassIcon, testId: "nav-recall" },
      { to: "/what-worked", label: "What Worked Before", icon: TrophyIcon, testId: "nav-what-worked" },
    ],
  },
  {
    title: "TRUST & EVIDENCE",
    items: [
      { to: "/evidence", label: "Evidence Viewer", icon: FileTextIcon, testId: "nav-evidence" },
      { to: "/conflicts", label: "Conflict Detection", icon: WarningOctagonIcon, testId: "nav-conflicts" },
    ],
  },
  {
    title: "DATA",
    items: [
      { to: "/upload", label: "Upload Data", icon: UploadSimpleIcon, testId: "nav-upload" },
    ],
  },
  {
    title: "MORE",
    items: [
      { to: "/alerts", label: "Alerts", icon: BellRingingIcon, testId: "nav-alerts" },
      { to: "/assistant", label: "AI Assistant", icon: ChatCenteredDotsIcon, testId: "nav-assistant" },
    ],
  },
];

export default function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="w-[240px] border-r border-[#262626] bg-[#0A0A0A] flex flex-col z-10" data-testid="sidebar">
      <div className="px-5 py-5 border-b border-[#262626] flex items-center gap-3">
        <div className="w-9 h-9 bg-[#FFB000] flex items-center justify-center">
          <HardHatIcon size={22} weight="fill" color="#0A0A0A" />
        </div>
        <div>
          <div className="font-display text-lg leading-none">RIGRECALL</div>
          <div className="text-[9px] text-[#71717A] tracking-widest mt-1">EXPERIENCE INTELLIGENCE</div>
        </div>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {sections.map(sec => (
          <div key={sec.title} className="mb-2">
            <div className="px-5 pt-3 pb-1 text-[9px] tracking-[0.25em] text-[#52525B] font-display font-bold">{sec.title}</div>
            {sec.items.map(({ to, label, icon: Icon, testId }) => {
              const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
              return (
                <NavLink
                  key={to}
                  to={to}
                  data-testid={testId}
                  className={`nav-item ${active ? "active" : ""} flex items-center gap-3 px-5 py-2 text-[12px] text-[#A1A1AA] border-l-2 border-transparent`}
                >
                  <Icon size={16} weight={active ? "fill" : "regular"} />
                  <span className="font-display font-bold tracking-wide">{label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-[#262626]">
        <div className="text-[9px] text-[#71717A] tracking-widest mb-1">POSITIONING</div>
        <div className="text-[10px] text-[#A1A1AA] leading-snug">
          AI-powered organizational memory for drilling operations
        </div>
      </div>
    </aside>
  );
}
