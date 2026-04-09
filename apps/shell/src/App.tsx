import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ShellLayout } from "./layouts/ShellLayout";
import { LoadingSpinner } from "./components/LoadingSpinner";

// Auth MFE runs standalone at localhost:3001 – redirect to it instead of federating
function AuthRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(`http://localhost:3001${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
  return <LoadingSpinner />;
}

// ── Lazy MFE Imports (Module Federation) ─────────────────────────
const PetProfileApp  = lazy(() => import("mfePetProfile/App"));
const SymptomApp     = lazy(() => import("mfeSymptom/App"));
const RiskResultsApp = lazy(() => import("mfeRiskResults/App"));
const VetDiscoverApp = lazy(() => import("mfeVetDiscover/App"));
const VaccinationApp = lazy(() => import("mfeVaccination/App"));
const AdminApp       = lazy(() => import("mfeAdmin/App"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 }
  }
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Auth lives on localhost:3001 standalone – redirect there */}
              <Route path="/auth/*" element={<AuthRedirect />} />

              {/* Protected routes inside shell layout */}
              <Route path="/" element={<ShellLayout />}>
                <Route path="pets/*"          element={<PetProfileApp />} />
                <Route path="symptom/*"       element={<SymptomApp />} />
                <Route path="risk-results/*"  element={<RiskResultsApp />} />
                <Route path="vet-discovery/*" element={<VetDiscoverApp />} />
                <Route path="vaccination/*"   element={<VaccinationApp />} />
                <Route path="admin/*"         element={<AdminApp />} />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
