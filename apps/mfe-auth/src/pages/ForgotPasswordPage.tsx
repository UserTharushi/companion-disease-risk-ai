import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert } from "../components/ui/alert";
import { forgotPassword } from "../lib/auth-api";
import { t, useLanguageStore } from "../lib/language";

// The schema is defined once at module scope, so it stores translation KEYS
// rather than sentences; the key is resolved at render time in the reader's
// current language. Without this, validation errors would always be English.
const schema = z.object({
  email: z.string().email("errEmailInvalid"),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setIsSubmitting(true);
      await forgotPassword({ email: values.email });
      setEmailSent(true);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : tr("errSomethingWrong"));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <button
          type="button"
          onClick={() => navigate("/auth/login")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-accent-subtle transition hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {tr("backToSignIn")}
        </button>

        {emailSent ? (
          <div>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">{tr("checkYourEmail")}</h1>
            <p className="mt-1.5 text-sm text-accent-subtle">
              {tr("resetSentPrefix")} <span className="font-medium text-accent-muted">{getValues("email")}</span>{" "}
              {tr("resetSentSuffix")}
            </p>

            <div className="mt-8 space-y-2">
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setEmailSent(false)}>
                {tr("tryDifferentEmail")}
              </Button>
              <Button variant="ghost" size="lg" className="w-full" asChild>
                <Link to="/auth/login">{tr("returnToSignIn")}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">{tr("resetPasswordTitle")}</h1>
            <p className="mt-1.5 text-sm text-accent-subtle">
              {tr("resetPasswordSubtitle")}
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{tr("email")}</Label>
                <Input {...register("email")} id="email" type="email" autoComplete="email" placeholder={tr("emailPlaceholder")} />
                {errors.email && <p className="text-xs text-red-600">{tr(errors.email.message ?? "")}</p>}
              </div>

              {errorMessage && (
                <Alert variant="danger" className="animate-slide-up">
                  <AlertTriangle />
                  <span>{errorMessage}</span>
                </Alert>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {tr("sendingAction")}</> : tr("sendResetLink")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-accent-subtle">
              {tr("rememberPassword")}{" "}
              <Link to="/auth/login" className="font-medium text-accent hover:underline">{tr("signIn")}</Link>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
