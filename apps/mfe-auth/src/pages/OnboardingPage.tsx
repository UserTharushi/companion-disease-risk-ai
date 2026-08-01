import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { markOnboardingSeen, hasStartedSession, hasSeenInfoStep, markOnboardingStepDone } from "../lib/session";
import { ArrowLeft, ArrowRight, Brain, MapPin, Syringe } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { cn } from "../lib/utils";
import { t, useLanguageStore } from "../lib/language";
import { useHistoryBack } from "../lib/use-history-back";
import onboardingAiImage from "../assets/images/onboarding-ai.jpg";
import onboardingVetImage from "../assets/images/auth-vet-consult.jpg";
import onboardingVaccineImage from "../assets/images/onboarding-vaccine.jpg";

// Copy lives in the dictionary; only the keys are held here so the slides
// re-render in the reader's language rather than being fixed at module load.
const slides = [
  { titleKey: "onbSlide1Title", bodyKey: "onbSlide1Body", badgeKey: "onbSlide1Badge", icon: Brain, image: onboardingVetImage },
  { titleKey: "onbSlide2Title", bodyKey: "onbSlide2Body", badgeKey: "onbSlide2Badge", icon: MapPin, image: onboardingAiImage },
  { titleKey: "onbSlide3Title", bodyKey: "onbSlide3Body", badgeKey: "onbSlide3Badge", icon: Syringe, image: onboardingVaccineImage },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const { canGoBack, goBack } = useHistoryBack();
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
            <span>{tr("onboardingStepLabel")}</span>
            <button type="button" onClick={finish} className="font-medium text-accent-muted hover:text-accent transition-colors">
              {tr("skipAction")}
            </button>
          </div>
          <Progress value={progressValue} />
        </div>

        {/* Slide content */}
        <div className="min-h-[280px]">
          <div className="relative mb-4 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            <img src={slide.image} alt={tr(slide.titleKey)} className="h-52 w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-primary shadow-sm">
              <slide.icon className="h-3.5 w-3.5" />
              <span>{tr(slide.badgeKey)}</span>
            </div>
          </div>
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-info-light">
            <slide.icon className="h-5 w-5 text-info-fg" />
          </div>

          <h1 className="font-heading text-2xl font-semibold tracking-tight text-accent">
            {tr(slide.titleKey)}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-accent-subtle">
            {tr(slide.bodyKey)}
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
          {/* On the first slide there is no previous slide, so back leaves the
              carousel entirely and returns to the info step. */}
          {(step > 0 || canGoBack) && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => (step > 0 ? setStep((s) => s - 1) : goBack())}
              aria-label={tr("goBack")}
              className="w-10 px-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={() => isLast ? finish() : setStep((s) => s + 1)}>
            {isLast ? tr("continueAction") : tr("nextAction")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
