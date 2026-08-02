import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Check, AlertTriangle } from "lucide-react";
import { registerUser } from "../lib/auth-api";
import { toast } from "../lib/use-toast";
import { getAccessToken, getSelectedRole, saveUserCredentials, saveProfileName } from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";
import { AuthBackLink } from "../components/BackButton";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert } from "../components/ui/alert";
import { cn } from "../lib/utils";
import { t, useLanguageStore } from "../lib/language";

// Messages are translation keys, resolved at render so validation errors
// follow the reader's language instead of being fixed at module load.
const registerSchema = z.object({
  displayName: z.string().min(2, "errNameMin2"),
  email: z.string().trim().email("errEmailInvalid"),
  phoneNumber: z.string().trim().regex(/^\d{10}$/, "errPhone10"),
  password: z.string().min(9, "errPasswordMin9"),
  confirmPassword: z.string().min(9, "errConfirmPassword"),
  role: z.enum(["pet-owner", "admin"]),
}).refine((d) => d.password === d.confirmPassword, { message: "errPasswordsNoMatch", path: ["confirmPassword"] });

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const savedRole = getSelectedRole();
  const defaultRole: "pet-owner" | "admin" =
    savedRole === "admin" || savedRole === "pet-owner" ? savedRole : "pet-owner";

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole },
  });

  if (getAccessToken()) return <Navigate to="/pets" replace />;

  const password = watch("password", "");
  const checks = [
    { key: "pwCheckLength", ok: password.length >= 9 },
    { key: "pwCheckUpper", ok: /[A-Z]/.test(password) },
    { key: "pwCheckNumber", ok: /\d/.test(password) },
  ];
  const strength = checks.filter((c) => c.ok).length;

  const onSubmit = handleSubmit(async (values) => {
    if (!agreedToTerms) {
      setErrorMessage(tr("agreeTermsFirst"));
      return;
    }
    try {
      setErrorMessage(null);
      setIsSubmitting(true);
      await registerUser({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        phoneNumber: values.phoneNumber,
        role: values.role,
      });
      saveUserCredentials(values.email, values.role);
      saveProfileName(values.displayName, values.role);
      toast({ title: tr("accountCreatedToast"), description: tr("signInToContinue"), variant: "success" });
      navigate("/auth/login", { replace: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : tr("registrationFailed");
      setErrorMessage(msg === "role_already_assigned_for_email" ? tr("emailDifferentRole") : msg);
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <AuthBackLink fallback="/auth/role" />
        <h1 className="text-xl font-semibold tracking-tight text-accent">{tr("createAccount")}</h1>
        <p className="mt-1 text-sm text-accent-subtle">
          {tr("alreadyHaveAccount")}{" "}
          <Link to="/auth/login" className="font-medium text-accent hover:underline">{tr("signIn")}</Link>
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="displayName">{tr("fullNameLabel")}</Label>
            <Input {...register("displayName")} id="displayName" autoComplete="name" placeholder={tr("fullNamePlaceholder")} />
            {errors.displayName && <p className="text-xs text-red-600">{tr(errors.displayName.message ?? "")}</p>}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="role">{tr("role")}</Label>
            <select
              {...register("role")}
              id="role"
              className="flex h-9 w-full appearance-none rounded-lg border border-border bg-surface px-3 text-sm text-accent shadow-xs transition-colors focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5"
              onChange={(e) => localStorage.setItem("companion_ai_selected_role", e.target.value)}
            >
              <option value="pet-owner">{tr("petOwnerOption")}</option>
              <option value="admin">{tr("adminOption")}</option>
            </select>
            <p className="text-xs text-accent-subtle">{tr("vetAdminOnly")}</p>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">{tr("email")}</Label>
            <Input {...register("email")} id="email" type="email" autoComplete="email" placeholder={tr("emailPlaceholder")} />
            {errors.email && <p className="text-xs text-red-600">{tr(errors.email.message ?? "")}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phoneNumber">{tr("phoneNumberLabel")}</Label>
            <Input
              {...register("phoneNumber")}
              id="phoneNumber"
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
              maxLength={10}
              onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10); }}
              placeholder="0712345678"
            />
            {errors.phoneNumber && <p className="text-xs text-red-600">{tr(errors.phoneNumber.message ?? "")}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">{tr("password")}</Label>
            <div className="relative">
              <Input
                {...register("password")}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={tr("createPasswordPlaceholder")}
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

            {password.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={cn("h-0.5 flex-1 rounded-full transition-all", i <= strength ? "bg-primary-700" : "bg-neutral-200")} />
                  ))}
                </div>
                <div className="flex gap-3">
                  {checks.map((c) => (
                    <span key={c.key} className={cn("inline-flex items-center gap-1 text-[11px]", c.ok ? "text-accent-muted" : "text-neutral-300")}>
                      <Check className={cn("h-2.5 w-2.5", c.ok ? "opacity-100" : "opacity-0")} />
                      {tr(c.key)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{tr("confirmPasswordLabel")}</Label>
            <Input {...register("confirmPassword")} id="confirmPassword" type="password" autoComplete="new-password" placeholder={tr("reenterPasswordPlaceholder")} />
            {errors.confirmPassword && <p className="text-xs text-red-600">{tr(errors.confirmPassword.message ?? "")}</p>}
          </div>

          {/* Terms */}
          <label className="flex cursor-pointer items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border-strong text-accent focus:ring-neutral-950"
            />
            <span className="text-xs leading-relaxed text-accent-subtle">
              {tr("termsAgreePrefix")} <span className="text-accent">{tr("termsOfService")}</span>{" "}
              {tr("termsAnd")} <span className="text-accent">{tr("privacyPolicy")}</span>
            </span>
          </label>

          {errorMessage && (
            <Alert variant="danger" className="animate-slide-up">
              <AlertTriangle />
              <span>{errorMessage}</span>
            </Alert>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !agreedToTerms}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {tr("createAccount")}...</> : tr("createAccount")}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
