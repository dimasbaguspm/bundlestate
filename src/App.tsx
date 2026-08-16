import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { HistoryDrawer } from "@/components/history-drawer";
import { HelpModal } from "@/components/help-modal";
import { HomePage } from "@/pages/home-page";
import { ReportPage } from "@/pages/report-page";

export default function App() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <BrowserRouter>
      <Shell
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/r/:id" element={<ReportPage />} />
        </Routes>
      </Shell>
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </BrowserRouter>
  );
}
