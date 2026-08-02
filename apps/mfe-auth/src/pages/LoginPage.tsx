import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginUser } from "../lib/auth-api";
import { toast } from "../lib/use-toast";
import {
  getAccessToken, saveAccessToken, saveProfileName, getVerifiedRole,
  saveSelectedRole, syncServerRole, normalizeUserRole,
} from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";
import { AuthBackLink } from "../components/BackButton";
import { redirectToPets } from "../lib/post-auth-redirect";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Alert } from "../components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { getAppLanguage, t, useLanguageStore } from "../lib/language";

// Messages are translation keys, resolved at render so validation errors
// follow the reader's language instead of being fixed at module load.
const loginSchema = z.object({
  email: z.string().email("errEmailInvalid"),
  password: z.string().min(6, "errPasswordMin6"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const verifiedRole = getVerifiedRole();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (getAccessToken()) {
    const path = verifiedRole === "veterinarian" ? "/vet-dashboard" : verifiedRole === "admin" ? "/admin-dashboard" : "/pets";
    return <Navigate to={path} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setIsSubmitting(true);

      const { token, displayName, role, mustChangePassword } = await loginUser({ email: values.email, password: values.password });
      // The server is the source of truth for the account's role — route by it
      const authenticatedRole = normalizeUserRole(role);
      if (!authenticatedRole) {
        setErrorMessage(tr("unsupportedRole"));
        return;
      }

      syncServerRole(values.email, authenticatedRole);
      saveSelectedRole(authenticatedRole);
      saveProfileName(displayName || values.email.split("@")[0], authenticatedRole);
      saveAccessToken(token);

      // Sync the locally chosen language to the profile so backend agents
      // (monitoring notifications) use it too
      void import("../lib/auth-api")
        .then(({ updateMyProfile }) => updateMyProfile(token, { preferredLanguage: getAppLanguage() }))
        .catch(() => undefined);

      toast({ title: tr("signedInToast"), variant: "success" });
      if (mustChangePassword) {
        // Admin-provisioned account with a temporary password — force a change
        navigate("/auth/change-password", { replace: true });
        return;
      }
      redirectToPets(navigate);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : tr("authFailed");
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <AuthBackLink fallback="/auth" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">{tr("signIn")}</h1>
            <p className="mt-1 text-sm text-accent-subtle">{tr("enterCredentials")}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{tr("email")}</Label>
            <Input
              {...register("email")}
              id="email"
              type="email"
              autoComplete="email"
              placeholder={tr("emailPlaceholder")}
            />
            {errors.email && <p className="text-xs text-red-600">{tr(errors.email.message ?? "")}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{tr("password")}</Label>
              <Link to="/auth/forgot-password" className="text-xs text-accent-subtle hover:text-accent transition-colors">
                {tr("forgotPasswordQ")}
              </Link>
            </div>
            <div className="relative">
              <Input
                {...register("password")}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={tr("passwordPlaceholder")}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-accent-faint hover:text-accent-muted"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-600">{tr(errors.password.message ?? "")}</p>}
          </div>

          {errorMessage && (
            <Alert variant="danger" className="animate-slide-up">
              <AlertTriangle />
              <span>{errorMessage}</span>
            </Alert>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {tr("signIn")}...</> : tr("signIn")}
          </Button>
        </form>

        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-secondary px-3 text-xs text-accent-faint lg:bg-surface">
            {tr("orDivider")}
          </span>
        </div>

        <p className="text-center text-sm text-accent-subtle">
          {tr("noAccountYet")}{" "}
          <Link to="/auth/register" className="font-medium text-accent hover:underline">
            {tr("createAccount")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
