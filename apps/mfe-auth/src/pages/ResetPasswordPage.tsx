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

const schema = z.object({
  password: z.string().min(8, "Minimum 8 characters"),
  confirmPassword: z.string().min(8, "Minimum 8 characters"),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
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
        throw new Error("Missing reset token");
      }
      await resetPassword({ token, password: values.password });
      setCompleted(true);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
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
          Back to sign in
        </button>

        {completed ? (
          <div>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">Password updated</h1>
            <p className="mt-1.5 text-sm text-accent-subtle">Your password has been reset successfully. You can sign in now.</p>
            <div className="mt-8">
              <Button size="lg" className="w-full" asChild>
                <Link to="/auth/login">Return to sign in</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">Set a new password</h1>
            <p className="mt-1.5 text-sm text-accent-subtle">
              Choose a new password for your account.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <Input {...register("password")} id="password" type="password" autoComplete="new-password" placeholder="Enter new password" />
                {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input {...register("confirmPassword")} id="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm new password" />
                {errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>}
              </div>

              {!token && (
                <Alert variant="danger" className="animate-slide-up">
                  <AlertTriangle />
                  <span>Missing reset token. Please request a new reset link.</span>
                </Alert>
              )}

              {errorMessage && (
                <Alert variant="danger" className="animate-slide-up">
                  <AlertTriangle />
                  <span>{errorMessage}</span>
                </Alert>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !token}>
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : "Update password"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-accent-subtle">
              Remembered it already? <Link to="/auth/login" className="font-medium text-accent hover:underline">Sign in</Link>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}