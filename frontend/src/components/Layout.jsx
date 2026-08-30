import React from "react";
import Sidebar from "./Sidebar";

export default function Layout({ children, title, subtitle, actions }) {
  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-white relative">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="border-b border-[#262626] bg-[#121212] px-8 py-5 flex items-end justify-between sticky top-0 z-20" data-testid="page-header">
          <div>
            <div className="text-[10px] text-[#71717A] tracking-[0.3em] mb-1">/ RIGRECALL</div>
            <h1 className="font-display text-3xl">{title}</h1>
            {subtitle && <div className="text-[#A1A1AA] mt-1 text-xs">{subtitle}</div>}
          </div>
          {actions && <div>{actions}</div>}
        </header>
        <div className="flex-1 p-6 grid-bg overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
