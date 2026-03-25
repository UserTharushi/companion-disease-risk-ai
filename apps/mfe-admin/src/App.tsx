import { Routes, Route } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { ClinicManagementPage } from "./pages/ClinicManagementPage";
import { SurgeonManagementPage } from "./pages/SurgeonManagementPage";
import { DiseaseVaccineDBPage } from "./pages/DiseaseVaccineDBPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/admin"             element={<DashboardPage />} />
      <Route path="/admin/clinics"     element={<ClinicManagementPage />} />
      <Route path="/admin/surgeons"    element={<SurgeonManagementPage />} />
      <Route path="/admin/disease-db"  element={<DiseaseVaccineDBPage />} />
      <Route path="/admin/analytics"   element={<AnalyticsPage />} />
    </Routes>
  );
}
