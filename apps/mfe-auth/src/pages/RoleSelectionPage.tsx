import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { saveSelectedRole, hasStartedSession, hasCompletedOnboardingStep, markRoleStepDone } from "../lib/session";
import { PawPrint, Stethoscope, Settings, Check, ArrowRight } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { cn } from "../lib/utils";
import { t, useLanguageStore } from "../lib/language";

const roles = [
  {
    id: "pet-owner",
    title: "Pet Owner",
    description: "Track health records, get AI risk assessments, and find clinics",
    icon: PawPrint,
  },
  {
    id: "veterinarian",
    title: "Veterinarian",
    description: "Manage patients, view histories, and respond to care inquiries",
    icon: Stethoscope,
  },
  {
    id: "admin",
    title: "Platform Admin",
    description: "System oversight, clinic approvals, and user management",
    icon: Settings,
  },
];

export function RoleSelectionPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const [selectedRole, setSelectedRole] = useState("pet-owner");
  if (!hasStartedSession()) return <Navigate to="/auth" replace />;
  if (!hasCompletedOnboardingStep()) return <Navigate to="/auth/onboarding" replace />;

  function handleContinue() {
    saveSelectedRole(selectedRole);
    markRoleStepDone();
    navigate("/auth/login");
  }

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <div className="mb-4 flex justify-end lg:hidden">
          <LanguageSwitcher compact />
        </div>
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-accent-faint">
            <span>{language === "si" ? "පියවර 3 / 3" : language === "ta" ? "படி 3 / 3" : "Step 3 of 3"}</span>
            <span className="font-medium text-accent-muted">{language === "si" ? "අවසන් කරමින්" : language === "ta" ? "கிட்டத்தட்ட முடிந்தது" : "Almost done"}</span>
          </div>
          <Progress value={100} />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-accent">
          {language === "si" ? "ඔබගේ භූමිකාව තෝරන්න" : language === "ta" ? "உங்கள் பாத்திரத்தை தேர்ந்தெடுக்கவும்" : "Select your role"}
        </h1>
        <p className="mt-1.5 text-sm text-accent-subtle">
          {language === "si" ? "මෙය ඔබගේ ඩැෂ්බෝඩ් සහ ලබාගත හැකි විශේෂාංග තීරණය කරයි." : language === "ta" ? "இது உங்கள் டாஷ்போர்டு மற்றும் கிடைக்கும் அம்சங்களை நிர்ணயிக்கும்." : "This determines your dashboard and available features."}
        </p>

        <div className="mt-6 space-y-2">
          {roles.map((role) => {
            const active = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150",
                  active
                    ? "border-neutral-900 bg-surface-secondary ring-1 ring-neutral-900"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-primary-700 text-white" : "bg-surface-tertiary text-accent-subtle",
                )}>
                  <role.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-accent">{role.title}</p>
                  <p className="text-xs text-accent-subtle leading-relaxed">{role.description}</p>
                </div>
                <div className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",
                  active ? "bg-primary-700 text-white" : "border border-border-strong",
                )}>
                  {active && <Check className="h-3 w-3" />}
                </div>
              </button>
            );
          })}
        </div>

        <Button size="xl" className="mt-8 w-full" onClick={handleContinue}>
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="mt-4 text-center text-xs text-accent-faint">
          {language === "si" ? "දැනටමත් ගිණුමක් තිබේද?" : language === "ta" ? "ஏற்கனவே கணக்கு உள்ளதா?" : "Already have an account?"}{" "}
          <button type="button" onClick={() => navigate("/auth/login")} className="font-medium text-accent hover:underline">
            {t(language, "signIn")}
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
