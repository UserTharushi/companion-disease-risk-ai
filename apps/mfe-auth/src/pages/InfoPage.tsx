import { useNavigate, Navigate } from "react-router-dom";
import { hasStartedSession, markInfoSeen } from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";
import infoHeroImage from "../assets/images/info-hero.jpg";

export function InfoPage() {
  const navigate = useNavigate();
  if (!hasStartedSession()) return <Navigate to="/auth" replace />;

  return (
    <AuthLayout
      title="Before You Start"
      subtitle="Important guidance for safe and effective use of AI-assisted pet health insights."
    >
      <div className="flex h-full flex-1 flex-col">
        <div className="mb-4 mt-1 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Step 1 of 3</p>
            <h1 className="mt-1 text-[30px] font-extrabold tracking-tight text-slate-900">Medical Disclaimer</h1>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <img
            src={infoHeroImage}
            alt="Veterinarian caring for a pet"
            className="h-52 w-full object-cover"
          />
          <div className="p-5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Use AI Guidance Responsibly</h2>
            <p className="mt-2 text-base leading-7 text-slate-600">
              PetHealth AI provides decision support. It is not a substitute for physical examination or clinical judgment.
            </p>
          </div>
        </div>

        <div className="mt-4 w-full space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-900">How This Works</h2>
            <p className="mt-2 text-base leading-7 text-slate-600">
              Report symptoms, upload optional media, and receive AI-assisted risk indicators and care suggestions.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <h3 className="text-lg font-bold text-amber-800">Important Safety Note</h3>
            <p className="mt-2 text-base leading-7 text-amber-800">
              AI output is not a diagnosis. Always consult a licensed veterinarian for urgent or persistent symptoms.
            </p>
          </div>

          <p className="text-base leading-7 text-slate-700">
            Continue only if you understand this service is a decision-support tool, not a replacement for clinical care.
          </p>
        </div>

        <button
          onClick={() => {
            markInfoSeen();
            navigate("/auth/onboarding");
          }}
          className="mt-6 w-full rounded-[22px] bg-blue-600 py-4 text-lg font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.3)] transition hover:bg-blue-700"
        >
          I Understand, Continue
        </button>
      </div>
    </AuthLayout>
  );
}
