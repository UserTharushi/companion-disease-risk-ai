import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginUser } from "../lib/auth-api";
import { toast } from "../lib/use-toast";
import {
  getAccessToken, saveAccessToken, verifyAndSaveRole, saveUserCredentials,
  getSelectedRole, saveProfileName, getRegisteredRoleForEmail, getVerifiedRole, saveSelectedRole,
  isManagedVeterinarianEmail,
} from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";
import { redirectToPets } from "../lib/post-auth-redirect";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Alert } from "../components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { t, useLanguageStore } from "../lib/language";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Minimum 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

const ROLE_LABELS: Record<string, string> = {
  "pet-owner": "Pet Owner",
  "veterinarian": "Veterinarian",
  "admin": "Admin",
};

const ROLE_OPTIONS: Array<{ id: "pet-owner" | "veterinarian" | "admin"; label: string }> = [
  { id: "pet-owner", label: "Pet Owner" },
  { id: "veterinarian", label: "Veterinarian" },
  { id: "admin", label: "Admin" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const [selectedRole, setSelectedRole] = useState<"pet-owner" | "veterinarian" | "admin">(() => {
    const saved = getSelectedRole();
    if (saved === "pet-owner" || saved === "veterinarian" || saved === "admin") {
      return saved;
    }
    return "pet-owner";
  });
  const verifiedRole = getVerifiedRole();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (getAccessToken()) {
    const activeRole = verifiedRole || selectedRole;
    const path = activeRole === "veterinarian" ? "/vet-dashboard" : activeRole === "admin" ? "/admin-dashboard" : "/pets";
    return <Navigate to={path} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setIsSubmitting(true);

      if (selectedRole === "veterinarian" && !isManagedVeterinarianEmail(values.email)) {
        setErrorMessage(language === "si"
          ? "වෙට් පරිවේශය පාලනය කරන්නේ ඇඩ්මින් විසිනි. ලොගින් වීමට පෙර ඇඩ්මින් ඔබගේ පැතිකඩ එකතු කරණු ඇතැයි ඉල්ලන්න."
          : language === "ta"
            ? "வெட் அணுகல் நிர்வாகியால் நிர்வகிக்கப்படுகிறது. உள்நுழைவதற்கு முன் உங்கள் சுயவிவரத்தை சேர்க்க நிர்வாகியை அணுகவும்."
            : "Veterinarian access is managed by admin. Ask an admin to add your profile before signing in.");
        return;
      }

      const expectedRole = getRegisteredRoleForEmail(values.email);
      if (expectedRole && expectedRole !== selectedRole) {
        setErrorMessage(`This account is registered as ${ROLE_LABELS[expectedRole] ?? expectedRole}. Select that role to continue.`);
        return;
      }

      const { token, displayName } = await loginUser({ email: values.email, password: values.password });

      if (!getRegisteredRoleForEmail(values.email)) {
        saveUserCredentials(values.email, selectedRole);
      }
      verifyAndSaveRole(values.email, selectedRole);
      saveProfileName(displayName || values.email.split("@")[0], selectedRole);
      saveAccessToken(token);

      toast({ title: "Signed in", variant: "success" });
      redirectToPets(navigate);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Authentication failed";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">Sign in</h1>
            <p className="mt-1 text-sm text-accent-subtle">
              {language === "si" ? "ඉදිරියට යාම සඳහා ඔබේ තොරතුරු ඇතුළත් කරන්න" : language === "ta" ? "தொடர உங்கள் விவரங்களை உள்ளிடவும்" : "Enter your credentials to continue"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {ROLE_OPTIONS.map((roleOption) => {
            const active = selectedRole === roleOption.id;
            return (
              <Button
                key={roleOption.id}
                type="button"
                size="sm"
                variant={active ? "default" : "secondary"}
                onClick={() => {
                  setSelectedRole(roleOption.id);
                  saveSelectedRole(roleOption.id);
                  setErrorMessage(null);
                }}
              >
                  {roleOption.id === "pet-owner"
                    ? (language === "si" ? "සුරතල් හිමිකරු" : language === "ta" ? "செல்லப்பிராணி உரிமையாளர்" : roleOption.label)
                    : roleOption.id === "veterinarian"
                      ? (language === "si" ? "වෙට්වර්" : language === "ta" ? "வெட்" : roleOption.label)
                      : (language === "si" ? "ඇඩ්මින්" : language === "ta" ? "நிர்வாகி" : roleOption.label)}
              </Button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              {...register("email")}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
            />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/auth/forgot-password" className="text-xs text-accent-subtle hover:text-accent transition-colors">
                {language === "si" ? "මුරපදය අමතකද?" : language === "ta" ? "கடவுச்சொல் மறந்துவிட்டதா?" : "Forgot password?"}
              </Link>
            </div>
            <div className="relative">
              <Input
                {...register("password")}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter password"
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
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>

          {errorMessage && (
            <Alert variant="danger" className="animate-slide-up">
              <AlertTriangle />
              <span>{errorMessage}</span>
            </Alert>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {t(language, "signIn")}...</> : t(language, "signIn")}
          </Button>
        </form>

        <div className="relative my-6">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-secondary px-3 text-xs text-accent-faint lg:bg-surface">
            {language === "si" ? "හෝ" : language === "ta" ? "அல்லது" : "or"}
          </span>
        </div>

        <p className="text-center text-sm text-accent-subtle">
          {language === "si" ? "ගිණුමක් නැද්ද?" : language === "ta" ? "கணக்கு இல்லையா?" : "Don&apos;t have an account?"}{" "}
          <Link to="/auth/register" className="font-medium text-accent hover:underline">
            {t(language, "createAccount")}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
