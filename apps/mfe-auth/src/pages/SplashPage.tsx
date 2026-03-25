import { useNavigate } from "react-router-dom";
import { startSession } from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";
import splashHeroImage from "../assets/images/splash-hero.jpg";

export function SplashPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout title="PetHealth AI" subtitle="AI-Powered Pet Health Monitoring.">
      <div className="flex min-h-full w-full flex-1 flex-col justify-between pb-2 pt-2">
        <div>
          <div className="mx-auto flex w-fit flex-col items-center text-center">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center rounded-[30px] bg-blue-600 text-5xl text-white shadow-[0_14px_28px_rgba(37,99,235,0.34)]">
                🐾
              </div>
              <div className="absolute -bottom-3 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-4 border-slate-100 bg-white text-xl text-blue-600 shadow-sm">
                ➕
              </div>
            </div>
            <h1 className="mt-8 text-6xl font-extrabold tracking-tight text-slate-900">PetHealth AI</h1>
            <p className="mt-4 max-w-[330px] text-center text-[18px] leading-9 text-slate-600">
              AI-Powered Pet Health Monitoring. Proactive care for your best friend using advanced diagnostics.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[24px] font-bold text-slate-900">Symptom Checker</p>
              <p className="mt-1 text-lg text-slate-500">Instant AI-driven clinical analysis</p>
            </article>
            <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[24px] font-bold text-slate-900">Wellness Tracking</p>
              <p className="mt-1 text-lg text-slate-500">Monitor vital signs and daily activity</p>
            </article>
            <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[24px] font-bold text-slate-900">Vet Insights</p>
              <p className="mt-1 text-lg text-slate-500">Expert-backed preventative data</p>
            </article>
          </div>

          <div className="mt-7 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
            <img src={splashHeroImage} alt="Golden retriever portrait" className="h-64 w-full object-cover" />
          </div>
        </div>

        <div className="mt-7 border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={() => {
              startSession();
              navigate("/auth/info");
            }}
            className="auth-primary-btn"
          >
            Get Started
          </button>
          <p className="mt-4 text-center text-lg text-slate-500">
            Already have an account? <button type="button" className="font-semibold text-blue-600" onClick={() => navigate("/auth/login")}>Log in</button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}

