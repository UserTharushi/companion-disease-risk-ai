import { Routes, Route } from "react-router-dom";
import { PetListPage } from "./pages/PetListPage";
import { PetDetailPage } from "./pages/PetDetailPage";
import { AddPetPage } from "./pages/AddPetPage";

export default function App() {
  return (
    <Routes>
      <Route path="/pets"          element={<PetListPage />} />
      <Route path="/pets/add"      element={<AddPetPage />} />
      <Route path="/pets/:petId"   element={<PetDetailPage />} />
    </Routes>
  );
}
