import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { HelpModal } from "@/components/help-modal";
import { HomePage } from "@/pages/home-page";
import { ReportPage } from "@/pages/report-page";

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <BrowserRouter>
      <Shell onOpenHelp={() => setHelpOpen(true)}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/r/:id" element={<ReportPage />} />
        </Routes>
      </Shell>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </BrowserRouter>
  );
}
