import { Routes, Route } from "react-router-dom";
import { SymptomFormPage } from "./pages/SymptomFormPage";
import { ChatbotPage } from "./pages/ChatbotPage";

export default function App() {
  return (
    <Routes>
      <Route path="/symptom"         element={<SymptomFormPage />} />
      <Route path="/symptom/chatbot" element={<ChatbotPage />} />
    </Routes>
  );
}
