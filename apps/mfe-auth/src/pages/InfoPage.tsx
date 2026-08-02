import { useNavigate, Navigate } from "react-router-dom";
import { hasStartedSession, markInfoSeen } from "../lib/session";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { AuthBackLink } from "../components/BackButton";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Progress } from "../components/ui/progress";
import { t, useLanguageStore } from "../lib/language";

export function InfoPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  if (!hasStartedSession()) return <Navigate to="/auth" replace />;

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <AuthBackLink fallback="/auth" />
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-accent-faint">
            <span>{tr("infoStepLabel")}</span>
            <span className="font-medium text-accent-muted">{tr("setupLabel")}</span>
          </div>
          <Progress value={33} />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-accent">
          {tr("beforeYouBegin")}
        </h1>
        <p className="mt-1.5 text-sm text-accent-subtle">
          {tr("reviewGuidance")}
        </p>

        <div className="mt-6 space-y-3">
          {/* NFR1: the decision-support notice has to be readable in the
              reader's own language, not only in English. */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium text-accent">{tr("decisionSupportTitle")}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-accent-subtle">
              {tr("decisionSupportBody")}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium text-accent">{tr("howItWorksTitle")}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-accent-subtle">
              {tr("howItWorksBody")}
            </p>
          </div>

          <Alert variant="warning">
            <AlertTriangle />
            <div>
              <p className="font-medium">{tr("alwaysConsultTitle")}</p>
              <p className="mt-0.5 text-xs opacity-80">
                {tr("alwaysConsultBody")}
              </p>
            </div>
          </Alert>
        </div>

        <Button
          size="xl"
          className="mt-8 w-full"
          onClick={() => { markInfoSeen(); navigate("/auth/onboarding"); }}
        >
          {tr("understandContinue")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </AuthLayout>
  );
}
