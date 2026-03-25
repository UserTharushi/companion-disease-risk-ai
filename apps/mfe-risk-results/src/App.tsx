import { Routes, Route } from "react-router-dom";
import { RiskResultPage } from "./pages/RiskResultPage";
import { PredictionHistoryPage } from "./pages/PredictionHistoryPage";

export default function App() {
  return (
    <Routes>
      <Route path="/risk-results"            element={<RiskResultPage />} />
      <Route path="/risk-results/history"    element={<PredictionHistoryPage />} />
      <Route path="/risk-results/:resultId"  element={<RiskResultPage />} />
    </Routes>
  );
}
