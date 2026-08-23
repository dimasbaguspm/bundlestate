import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/shell";
import { HelpModal } from "@/components/help-modal";
import { HomePage } from "@/pages/home-page";
import { ReportPage } from "@/pages/report-page";
import { TreemapTab } from "@/modules/treemap/ui/treemap-tab";
import { FilesTab } from "@/modules/files/ui/files-tab";
import { PreviewTab } from "@/modules/preview/ui/preview-tab";
import { InspectorTab } from "@/modules/inspector/ui/inspector-tab";

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <BrowserRouter>
      <Shell onOpenHelp={() => setHelpOpen(true)}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/r/:id" element={<ReportPage />}>
            <Route index element={<Navigate to="treemap" replace />} />
            <Route path="treemap" element={<TreemapTab />} />
            <Route path="files" element={<FilesTab />} />
            <Route path="preview" element={<PreviewTab />} />
            <Route path="inspector" element={<InspectorTab />} />
          </Route>
        </Routes>
      </Shell>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </BrowserRouter>
  );
}
