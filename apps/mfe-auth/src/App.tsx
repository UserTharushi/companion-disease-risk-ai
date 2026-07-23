import { Routes, Route, Navigate } from "react-router-dom";
import { SplashPage } from "./pages/SplashPage";
import { InfoPage } from "./pages/InfoPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { RoleSelectionPage } from "./pages/RoleSelectionPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { PetOwnerDashboardPage } from "./pages/PetOwnerDashboardPage";
import { VeterinarianDashboardPage } from "./pages/VeterinarianDashboardPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import {
  BookingConfirmationPage,
  SymptomReportPage,
  PredictionResultPage,
} from "./pages/PetOwnerFlowPages";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/"                 element={<SplashPage />} />
      <Route path="/start"            element={<SplashPage />} />
      <Route path="/auth"             element={<SplashPage />} />
      <Route path="/auth/info"        element={<InfoPage />} />
      <Route path="/auth/role"        element={<RoleSelectionPage />} />
      <Route path="/onboarding"       element={<OnboardingPage />} />
      <Route path="/auth/onboarding"  element={<OnboardingPage />} />
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/auth/login"       element={<LoginPage />} />
      <Route path="/register"              element={<RegisterPage />} />
      <Route path="/auth/register"         element={<RegisterPage />} />
      <Route path="/forgot-password"       element={<ForgotPasswordPage />} />
      <Route path="/auth/forgot-password"  element={<ForgotPasswordPage />} />
      <Route path="/reset-password"        element={<ResetPasswordPage />} />
      <Route path="/auth/reset-password"   element={<ResetPasswordPage />} />
      <Route path="/auth/change-password"  element={<ChangePasswordPage />} />
      
      {/* Protected routes with role-based access */}
      <Route
        path="/pets/*"
        element={
          <ProtectedRoute allowedRoles={["pet-owner"]}>
            <PetOwnerDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/pets/booking-confirmed" element={<ProtectedRoute allowedRoles={["pet-owner"]}><BookingConfirmationPage /></ProtectedRoute>} />
      <Route path="/pets/symptoms/:petId" element={<ProtectedRoute allowedRoles={["pet-owner"]}><SymptomReportPage /></ProtectedRoute>} />
      <Route path="/pets/prediction/:petId" element={<ProtectedRoute allowedRoles={["pet-owner"]}><PredictionResultPage /></ProtectedRoute>} />
      <Route
        path="/vet-dashboard/*"
        element={
          <ProtectedRoute allowedRoles={["veterinarian"]}>
            <VeterinarianDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/*"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      
      <Route path="*"                 element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}
