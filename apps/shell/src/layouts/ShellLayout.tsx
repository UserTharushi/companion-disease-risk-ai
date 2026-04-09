import { useEffect } from "react";
import { Outlet, NavLink, Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "../components/LoadingSpinner";

const AUTH_TOKEN_KEY = "companion_ai_access_token";

function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

const navItems = [
  { to: "/pets", label: "Pets", icon: "🐾" },
  { to: "/symptom", label: "Check", icon: "🔍" },
  { to: "/vet-discovery", label: "Find Vet", icon: "🏥" },
  { to: "/vaccination", label: "Vaccines", icon: "💉" },
];

export function ShellLayout() {
  const location = useLocation();
  const token = getAccessToken();

  useEffect(() => {
    if (!token) {
      window.location.replace("http://localhost:3001/auth");
    }
  }, [token]);

  if (!token) {
    return <LoadingSpinner />;
  }

  if (location.pathname === "/") {
    return <Navigate to="/pets" replace />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-xl">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <span className="text-lg font-bold text-primary-600">CompanionAI</span>
        <NavLink to="/pets">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
            M
          </div>
        </NavLink>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 justify-around border-t border-gray-200 bg-white">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center px-3 py-2 text-xs font-medium transition-colors ${
                isActive ? "text-primary-600" : "text-gray-400 hover:text-gray-600"
              }`
            }
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
