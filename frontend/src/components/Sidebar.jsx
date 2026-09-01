import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { GaugeIcon, StackIcon, MagnifyingGlassIcon, FileTextIcon, WarningOctagonIcon, ChatCenteredDotsIcon, HardHatIcon, UploadSimpleIcon, BellRingingIcon } from "@phosphor-icons/react";

const items = [
  { to: "/", label: "Dashboard", icon: GaugeIcon, testId: "nav-dashboard" },
  { to: "/cases", label: "Case Library", icon: StackIcon, testId: "nav-cases" },
  { to: "/recall", label: "Recall Engine", icon: MagnifyingGlassIcon, testId: "nav-recall" },
  { to: "/evidence", label: "Evidence Viewer", icon: FileTextIcon, testId: "nav-evidence" },
  { to: "/conflicts", label: "Conflict Detection", icon: WarningOctagonIcon, testId: "nav-conflicts" },
  { to: "/upload", label: "Case Upload", icon: UploadSimpleIcon, testId: "nav-upload" },
  { to: "/alerts", label: "Alert Rules", icon: BellRingingIcon, testId: "nav-alerts" },
  { to: "/assistant", label: "AI Assistant", icon: ChatCenteredDotsIcon, testId: "nav-assistant" },
];

export default function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="w-[240px] border-r border-[#262626] bg-[#0A0A0A] flex flex-col z-10" data-testid="sidebar">
      <div className="px-5 py-6 border-b border-[#262626] flex items-center gap-3">
        <div className="w-9 h-9 bg-[#FFB000] flex items-center justify-center">
          <HardHatIcon size={22} weight="fill" color="#0A0A0A" />
        </div>
        <div>
          <div className="font-display text-lg leading-none">RIGRECALL</div>
          <div className="text-[10px] text-[#71717A] tracking-widest mt-1">DRILLING · MEMORY · AI</div>
        </div>
      </div>
      <nav className="flex-1 py-3">
        {items.map(({ to, label, icon: Icon, testId }) => {
          const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              data-testid={testId}
              className={`nav-item ${active ? "active" : ""} flex items-center gap-3 px-5 py-3 text-[13px] text-[#A1A1AA] border-l-2 border-transparent`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              <span className="font-display font-bold tracking-wide">{label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 border-t border-[#262626]">
        <div className="text-[10px] text-[#71717A] tracking-widest mb-1">SESSION</div>
        <div className="font-mono text-xs text-[#A1A1AA]">field_engineer_01</div>
        <div className="pill pill-success mt-2">
          <span className="w-1.5 h-1.5 bg-[#34C759] rounded-full"></span>
          LIVE
        </div>
      </div>
    </aside>
  );
}
