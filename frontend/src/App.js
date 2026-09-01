import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";

import Dashboard from "@/pages/Dashboard";
import CaseLibrary from "@/pages/CaseLibrary";
import CaseDetail from "@/pages/CaseDetail";
import RecallEngine from "@/pages/RecallEngine";
import EvidenceViewer from "@/pages/EvidenceViewer";
import ConflictDetection from "@/pages/ConflictDetection";
import Assistant from "@/pages/Assistant";
import CaseUpload from "@/pages/CaseUpload";
import Alerts from "@/pages/Alerts";
import WhatWorkedBefore from "@/pages/WhatWorkedBefore";
import ExperienceDnaPage from "@/pages/ExperienceDnaPage";
import PresentationMode from "@/components/PresentationMode";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cases" element={<CaseLibrary />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="/recall" element={<RecallEngine />} />
          <Route path="/what-worked" element={<WhatWorkedBefore />} />
          <Route path="/dna" element={<ExperienceDnaPage />} />
          <Route path="/evidence" element={<EvidenceViewer />} />
          <Route path="/conflicts" element={<ConflictDetection />} />
          <Route path="/upload" element={<CaseUpload />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/assistant" element={<Assistant />} />
        </Routes>
        <PresentationMode />
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" />
    </div>
  );
}

export default App;
