import { Outlet, NavLink } from "react-router-dom";

const AUTH_TOKEN_KEY = "companion_ai_access_token";

function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

const navItems = [
  { to: "/pets",          label: "Pets",       icon: "🐾" },
  { to: "/symptom",       label: "Check",      icon: "🔍" },
  { to: "/vet-discovery", label: "Find Vet",   icon: "🏥" },
  { to: "/vaccination",   label: "Vaccines",   icon: "💉" },
];

export function ShellLayout() {
  if (!getAccessToken()) {
    // Auth app is standalone at port 3001 – hard redirect there
    window.location.replace("http://localhost:3001/auth");
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-white shadow-xl">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-primary-600">CompanionAI</span>
        <NavLink to="/pets">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-bold">M</div>
        </NavLink>
      </header>

      {/* MFE Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Nav Bar (mobile-first) */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 flex justify-around z-50">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center py-2 px-3 text-xs font-medium transition-colors ${
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
