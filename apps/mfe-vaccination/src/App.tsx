import { Routes, Route } from "react-router-dom";
import { VaccinationDashboard } from "./pages/VaccinationDashboard";
import { AddVaccinationPage } from "./pages/AddVaccinationPage";

export default function App() {
  return (
    <Routes>
      <Route path="/vaccination"      element={<VaccinationDashboard />} />
      <Route path="/vaccination/add"  element={<AddVaccinationPage />} />
    </Routes>
  );
}
