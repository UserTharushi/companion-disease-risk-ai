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

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
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

        {emailSent ? (
          <div>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">Check your email</h1>
            <p className="mt-1.5 text-sm text-accent-subtle">
              If an account exists for <span className="font-medium text-accent-muted">{getValues("email")}</span>,
              you'll receive reset instructions shortly.
            </p>

            <div className="mt-8 space-y-2">
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setEmailSent(false)}>
                Try a different email
              </Button>
              <Button variant="ghost" size="lg" className="w-full" asChild>
                <Link to="/auth/login">Return to sign in</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">Reset password</h1>
            <p className="mt-1.5 text-sm text-accent-subtle">
              Enter your email and we'll send reset instructions.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input {...register("email")} id="email" type="email" autoComplete="email" placeholder="you@company.com" />
                {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
              </div>

              {errorMessage && (
                <Alert variant="danger" className="animate-slide-up">
                  <AlertTriangle />
                  <span>{errorMessage}</span>
                </Alert>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : "Send reset link"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-accent-subtle">
              Remember your password?{" "}
              <Link to="/auth/login" className="font-medium text-accent hover:underline">Sign in</Link>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
