import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { saveSelectedRole, hasStartedSession, hasCompletedOnboardingStep, markRoleStepDone } from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";

const roles = [
  { id: "pet-owner", title: "Pet Owner", description: "Manage your pets' health records and schedule appointments.", icon: "🐾" },
  { id: "veterinarian", title: "Veterinarian", description: "Provide medical care, access patient history, and manage clinic operations.", icon: "🩺" },
  { id: "admin", title: "Platform Admin", description: "System oversight, user management, and configuration tools.", icon: "⚙️" },
];

export function RoleSelectionPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<string>("pet-owner");
  if (!hasStartedSession()) return <Navigate to="/auth" replace />;
  if (!hasCompletedOnboardingStep()) return <Navigate to="/auth/onboarding" replace />;

  function handleContinue() {
    saveSelectedRole(selectedRole);
    markRoleStepDone();
    navigate("/auth/login");
  }

  return (
    <AuthLayout title="Select Role" subtitle="Choose your account role before authentication.">
      <div className="flex flex-1 flex-col">
        <div className="mb-6 mt-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-2xl text-blue-600">
            🧬
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Welcome to PetHealth AI</h1>
          <p className="mt-3 text-lg leading-8 text-slate-500">Choose the role that best describes your use of the application.</p>
        </div>

        <div className="space-y-4">
          {roles.map((role) => {
            const active = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={`w-full rounded-[24px] border p-5 text-left transition ${active ? "border-2 border-blue-600 bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                      {role.icon}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{role.title}</h2>
                      <p className="mt-1 text-base leading-7 text-slate-600">{role.description}</p>
                    </div>
                  </div>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                    ✓
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={handleContinue} className="mt-6 w-full rounded-[22px] bg-blue-600 py-4 text-lg font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.35)] transition hover:bg-blue-700">
          Continue →
        </button>

        <div className="mt-4 text-center text-lg text-slate-500">
          Already have an account? <button type="button" onClick={() => navigate("/auth/login")} className="font-semibold text-blue-600">Log in</button>
        </div>

        <div className="mt-6 flex justify-center gap-5">
          <span className="h-10 w-10 rounded-full bg-slate-200"></span>
          <span className="h-10 w-10 rounded-full bg-slate-200"></span>
          <span className="h-10 w-10 rounded-full bg-slate-200"></span>
        </div>

        <p className="mt-4 text-center text-lg text-slate-400">
          Trusted by 2,000+ clinics and pet care facilities worldwide.
        </p>
      </div>
    </AuthLayout>
  );
}
