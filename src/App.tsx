import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { HomePage } from "@/pages/home-page";
import { ReportPage } from "@/pages/report-page";

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/r/:id" element={<ReportPage />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}