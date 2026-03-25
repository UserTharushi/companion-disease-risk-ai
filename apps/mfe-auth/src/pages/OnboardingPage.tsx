import { useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { markOnboardingSeen, hasStartedSession, hasSeenInfoStep, markOnboardingStepDone } from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";
import onboardingAiImage from "../assets/images/onboarding-ai.jpg";
import onboardingVetImage from "../assets/images/onboarding-vet.jpg";
import onboardingVaccineImage from "../assets/images/onboarding-vaccine.jpg";

const slides = [
  {
    title: "AI Disease Prediction",
    description: "Leverage advanced machine learning to detect potential health risks early with explainable confidence indicators.",
    image: onboardingAiImage,
  },
  {
    title: "Smart Vet Recommendation",
    description: "Get location-aware recommendations for qualified nearby clinics based on your pet's condition and history.",
    image: onboardingVetImage,
  },
  {
    title: "Vaccination & Health Tracking",
    description: "Maintain a complete digital health timeline with reminders for boosters, checkups, and preventive care.",
    image: onboardingVaccineImage,
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  if (!hasStartedSession()) return <Navigate to="/auth" replace />;
  if (!hasSeenInfoStep()) return <Navigate to="/auth/info" replace />;

  const slide = useMemo(() => slides[step], [step]);

  function finishOnboarding() {
    markOnboardingStepDone();
    markOnboardingSeen();
    navigate("/auth/role");
  }

  function handleNext() {
    if (step === slides.length - 1) {
      finishOnboarding();
      return;
    }
    setStep((current) => current + 1);
  }

  return (
    <AuthLayout title="PetHealth AI" subtitle="Designed for pet owners, clinics, and care teams.">
      <div className="flex flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => (current > 0 ? current - 1 : current))}
            className={`text-4xl text-slate-700 ${step === 0 ? "invisible" : "visible"}`}
          >
            ←
          </button>
          <div className="text-4xl font-extrabold tracking-tight text-slate-900">PetHealth AI</div>
          <button onClick={finishOnboarding} className="text-[18px] font-semibold text-slate-500 hover:text-slate-600">
            {step === 1 ? "Help" : "Skip"}
          </button>
        </div>

        <div className="flex flex-1 flex-col text-center">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm">
            <img src={slide.image} alt={slide.title} className="h-72 w-full object-cover" />
          </div>

          <h1 className="mt-6 text-5xl font-extrabold leading-tight tracking-tight text-slate-900">{slide.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-[18px] leading-9 text-slate-600">{slide.description}</p>

          <div className="mt-10 flex justify-center gap-3">
            {slides.map((_, index) => (
              <span
                key={index}
                className={`h-3 rounded-full transition ${index === step ? "w-12 bg-blue-600" : "w-3 bg-slate-300"}`}
              />
            ))}
          </div>
        </div>

        <button onClick={handleNext} className="mt-8 w-full rounded-[22px] bg-blue-600 py-4 text-lg font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.34)] transition hover:bg-blue-700">
          {step === slides.length - 1 ? "Get Started" : "Next"}
        </button>

        {step !== slides.length - 1 && (
          <button type="button" onClick={finishOnboarding} className="mt-3 text-center text-[18px] font-semibold text-slate-500">
            Skip
          </button>
        )}
      </div>
    </AuthLayout>
  );
}
