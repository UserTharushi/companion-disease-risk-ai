import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert } from "../components/ui/alert";
import { resetPassword } from "../lib/auth-api";
import { t, useLanguageStore } from "../lib/language";

// Messages are translation keys, resolved at render — see ForgotPasswordPage.
const schema = z.object({
  password: z.string().min(8, "errPasswordMin8"),
  confirmPassword: z.string().min(8, "errPasswordMin8"),
}).refine((values) => values.password === values.confirmPassword, {
  message: "errPasswordsNoMatch",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setIsSubmitting(true);
      if (!token) {
        throw new Error(tr("missingResetToken"));
      }
      await resetPassword({ token, password: values.password });
      setCompleted(true);
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

        {completed ? (
          <div>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">{tr("passwordUpdated")}</h1>
            <p className="mt-1.5 text-sm text-accent-subtle">{tr("passwordResetSuccess")}</p>
            <div className="mt-8">
              <Button size="lg" className="w-full" asChild>
                <Link to="/auth/login">{tr("returnToSignIn")}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">{tr("setNewPassword")}</h1>
            <p className="mt-1.5 text-sm text-accent-subtle">
              {tr("chooseNewPassword")}
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">{tr("newPasswordLabel")}</Label>
                <Input {...register("password")} id="password" type="password" autoComplete="new-password" placeholder={tr("newPasswordPlaceholder")} />
                {errors.password && <p className="text-xs text-red-600">{tr(errors.password.message ?? "")}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{tr("confirmNewPasswordLabel")}</Label>
                <Input {...register("confirmPassword")} id="confirmPassword" type="password" autoComplete="new-password" placeholder={tr("confirmNewPasswordPlaceholder")} />
                {errors.confirmPassword && <p className="text-xs text-red-600">{tr(errors.confirmPassword.message ?? "")}</p>}
              </div>

              {!token && (
                <Alert variant="danger" className="animate-slide-up">
                  <AlertTriangle />
                  <span>{tr("missingResetToken")}</span>
                </Alert>
              )}

              {errorMessage && (
                <Alert variant="danger" className="animate-slide-up">
                  <AlertTriangle />
                  <span>{errorMessage}</span>
                </Alert>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !token}>
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {tr("updatingAction")}</> : tr("updatePasswordAction")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-accent-subtle">
              {tr("rememberedAlready")} <Link to="/auth/login" className="font-medium text-accent hover:underline">{tr("signIn")}</Link>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
