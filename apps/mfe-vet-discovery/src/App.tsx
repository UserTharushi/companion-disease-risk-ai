import { Routes, Route } from "react-router-dom";
import { ClinicMapPage } from "./pages/ClinicMapPage";
import { ClinicDetailPage } from "./pages/ClinicDetailPage";
import { BookingPage } from "./pages/BookingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/vet-discovery"                 element={<ClinicMapPage />} />
      <Route path="/vet-discovery/:clinicId"        element={<ClinicDetailPage />} />
      <Route path="/vet-discovery/:clinicId/book"   element={<BookingPage />} />
    </Routes>
  );
}
