import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { markOnboardingSeen, hasStartedSession, hasSeenInfoStep, markOnboardingStepDone } from "../lib/session";
import { ArrowLeft, ArrowRight, Brain, MapPin, Syringe } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { cn } from "../lib/utils";
import onboardingAiImage from "../assets/images/onboarding-ai.jpg";
import onboardingVetImage from "../assets/images/auth-vet-consult.jpg";
import onboardingVaccineImage from "../assets/images/onboarding-vaccine.jpg";

const slides = [
  {
    title: "AI Disease Prediction",
    description: "Leverage advanced machine learning to detect potential health risks early with clear confidence scores and actionable recommendations.",
    icon: Brain,
    image: onboardingVetImage,
    badge: "SYMPTOM SCAN ACTIVE",
  },
  {
    title: "Smart Vet Recommendation",
    description: "Get personalized suggestions for trusted clinics near you based on your pet's symptoms, location, and medical history.",
    icon: MapPin,
    image: onboardingAiImage,
    badge: "NEARBY CLINICS",
  },
  {
    title: "Vaccination & Health Tracking",
    description: "Track vaccinations, checkups, and preventive care with timely reminders so your pet's health plan always stays up to date.",
    icon: Syringe,
    image: onboardingVaccineImage,
    badge: "VACCINE REMINDERS",
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  if (!hasStartedSession()) return <Navigate to="/auth" replace />;
  if (!hasSeenInfoStep()) return <Navigate to="/auth/info" replace />;

  const slide = slides[step];
  const isLast = step === slides.length - 1;
  const progressValue = 33 + ((step + 1) / slides.length) * 33;

  function finish() {
    markOnboardingStepDone();
    markOnboardingSeen();
    navigate("/auth/role");
  }

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-accent-faint">
            <span>Step 2 of 3</span>
            <button type="button" onClick={finish} className="font-medium text-accent-muted hover:text-accent transition-colors">
              Skip
            </button>
          </div>
          <Progress value={progressValue} />
        </div>

        {/* Slide content */}
        <div className="min-h-[280px]">
          <div className="relative mb-4 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            <img src={slide.image} alt={slide.title} className="h-52 w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-primary shadow-sm">
              <slide.icon className="h-3.5 w-3.5" />
              <span>{slide.badge}</span>
            </div>
          </div>
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-info-light">
            <slide.icon className="h-5 w-5 text-info-fg" />
          </div>

          <h1 className="font-heading text-2xl font-semibold tracking-tight text-accent">
            {slide.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-accent-subtle">
            {slide.description}
          </p>
        </div>

        {/* Dots */}
        <div className="mt-6 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-primary" : "w-2 bg-border hover:bg-border-strong",
              )}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-2">
          {step > 0 && (
            <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)} className="w-10 px-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={() => isLast ? finish() : setStep((s) => s + 1)}>
            {isLast ? "Continue" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
