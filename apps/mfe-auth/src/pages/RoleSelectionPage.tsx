import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { saveSelectedRole, hasStartedSession, hasCompletedOnboardingStep, markRoleStepDone } from "../lib/session";
import { PawPrint, Stethoscope, Settings, Check, ArrowRight, Info } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { AuthBackLink } from "../components/BackButton";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { cn } from "../lib/utils";
import { t, useLanguageStore } from "../lib/language";

const roles = [
  { id: "pet-owner", titleKey: "rolePetOwnerTitle", descKey: "rolePetOwnerDesc", icon: PawPrint },
  { id: "veterinarian", titleKey: "roleVetTitle", descKey: "roleVetDesc", icon: Stethoscope },
  { id: "admin", titleKey: "roleAdminTitle", descKey: "roleAdminDesc", icon: Settings },
];

export function RoleSelectionPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const [selectedRole, setSelectedRole] = useState("pet-owner");
  if (!hasStartedSession()) return <Navigate to="/auth" replace />;
  if (!hasCompletedOnboardingStep()) return <Navigate to="/auth/onboarding" replace />;

  // Veterinarians are provisioned by an administrator; the register endpoint
  // rejects self-signup with 403. Saying so here means the choice fails on the
  // screen that offers it, rather than three steps later on a form that has no
  // Veterinarian option.
  const vetBlocked = selectedRole === "veterinarian";

  function handleContinue() {
    if (vetBlocked) return;
    saveSelectedRole(selectedRole);
    markRoleStepDone();
    // This is the last step of signing UP, so the next screen is registration.
    // It used to go to sign-in, which made the role look like something you
    // pick to log in as — it is not; the server decides an account's role.
    navigate("/auth/register");
  }

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <div className="mb-4 flex items-center justify-between">
          <AuthBackLink fallback="/auth/onboarding" className="mb-0" />
          <div className="ml-auto lg:hidden">
            <LanguageSwitcher compact />
          </div>
        </div>
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-accent-faint">
            <span>{tr("roleStepLabel")}</span>
            <span className="font-medium text-accent-muted">{tr("almostDone")}</span>
          </div>
          <Progress value={100} />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-accent">{tr("selectYourRole")}</h1>
        <p className="mt-1.5 text-sm text-accent-subtle">{tr("roleChooseAccountType")}</p>

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
                  <p className="text-sm font-medium text-accent">{tr(role.titleKey)}</p>
                  <p className="text-xs text-accent-subtle leading-relaxed">{tr(role.descKey)}</p>
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

        {vetBlocked && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-info/40 bg-info-light px-3 py-2.5 text-xs leading-relaxed text-accent-muted dark:border-info/30 dark:bg-primary/10 dark:text-neutral-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <span>{tr("vetSelfSignupBlocked")}</span>
          </div>
        )}

        <Button size="xl" className="mt-8 w-full" onClick={handleContinue} disabled={vetBlocked}>
          {tr("continueAction")}
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="mt-4 text-center text-xs text-accent-faint">
          {tr("alreadyHaveAccount")}{" "}
          <button type="button" onClick={() => navigate("/auth/login")} className="font-medium text-accent hover:underline">
            {tr("signIn")}
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
