import { useNavigate, Navigate } from "react-router-dom";
import { hasStartedSession, markInfoSeen } from "../lib/session";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Progress } from "../components/ui/progress";

export function InfoPage() {
  const navigate = useNavigate();
  if (!hasStartedSession()) return <Navigate to="/auth" replace />;

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-accent-faint">
            <span>Step 1 of 3</span>
            <span className="font-medium text-accent-muted">Setup</span>
          </div>
          <Progress value={33} />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-accent">
          Before you begin
        </h1>
        <p className="mt-1.5 text-sm text-accent-subtle">
          Please review the following guidance for safe use.
        </p>

        <div className="mt-6 space-y-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium text-accent">Decision support, not diagnosis</p>
            <p className="mt-1 text-[13px] leading-relaxed text-accent-subtle">
              PetCare AI provides risk indicators and care suggestions based on reported symptoms.
              It does not replace physical examination or clinical judgment.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-medium text-accent">How it works</p>
            <p className="mt-1 text-[13px] leading-relaxed text-accent-subtle">
              Report symptoms, upload optional media, and receive AI-assisted risk analysis with
              confidence scores and recommended next steps.
            </p>
          </div>

          <Alert variant="warning">
            <AlertTriangle />
            <div>
              <p className="font-medium">Always consult a veterinarian</p>
              <p className="mt-0.5 text-xs opacity-80">
                For urgent or persistent symptoms, seek professional veterinary care immediately.
              </p>
            </div>
          </Alert>
        </div>

        <Button
          size="xl"
          className="mt-8 w-full"
          onClick={() => { markInfoSeen(); navigate("/auth/onboarding"); }}
        >
          I understand, continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </AuthLayout>
  );
}
