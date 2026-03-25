import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { getAccessToken, saveAccessToken, verifyAndSaveRole, getSelectedRole, saveProfileName, getRegisteredRoleForEmail, getVerifiedRole } from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";
import { redirectToPets } from "../lib/post-auth-redirect";
import authVetConsultImage from "../assets/images/auth-vet-consult.jpg";

function deriveNameFromEmail(email: string | null | undefined): string {
  if (!email) return "Pet Owner";
  const localPart = email.split("@")[0] ?? "";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "Pet Owner";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const selectedRole = getSelectedRole() || "pet-owner";
  const verifiedRole = getVerifiedRole();
  const roleAutofillSection = `section-${selectedRole.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const roleLabel = selectedRole === "pet-owner" ? "Pet Owner" : selectedRole === "veterinarian" ? "Veterinarian" : "Admin";

  if (getAccessToken()) {
    const activeRole = verifiedRole || selectedRole;
    const dashboardPath = activeRole === "veterinarian"
      ? "/vet-dashboard"
      : activeRole === "admin"
        ? "/admin-dashboard"
        : "/pets";
    return <Navigate to={dashboardPath} replace />;
  }

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setIsSubmitting(true);

      const expectedRole = getRegisteredRoleForEmail(values.email);
      if (!expectedRole) {
        setErrorMessage("No account found for this email. Please register first.");
        setIsSubmitting(false);
        return;
      }

      if (expectedRole !== selectedRole) {
        const roleLabel = expectedRole === "pet-owner" ? "Pet Owner" : expectedRole === "veterinarian" ? "Veterinarian" : "Admin";
        setErrorMessage(`This account is registered as ${roleLabel}. Please choose that role to login.`);
        setIsSubmitting(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const firebaseIdToken = await userCredential.user.getIdToken();
      const displayName = userCredential.user.displayName || deriveNameFromEmail(userCredential.user.email);

      // Verify and save the role
      const roleVerified = verifyAndSaveRole(values.email, selectedRole);
      if (!roleVerified) {
        setErrorMessage("Role verification failed. Please register again.");
        setIsSubmitting(false);
        return;
      }

      saveProfileName(displayName, selectedRole);
      saveAccessToken(firebaseIdToken);
      redirectToPets(navigate);
    } catch (error: unknown) {
      const msg = (error as { code?: string; message?: string })?.code
        ?? (error instanceof Error ? error.message : "Login failed");
      setErrorMessage(msg.replace("auth/", "").replaceAll("-", " "));
    } finally {
      setIsSubmitting(false);
    }
  });

  async function handleGoogleLogin() {
    try {
      setErrorMessage(null);
      setIsSubmitting(true);
      const userCredential = await signInWithPopup(auth, googleProvider);
      const email = userCredential.user.email || "";
      const expectedRole = getRegisteredRoleForEmail(email);

      if (!expectedRole) {
        setErrorMessage("No account found for this email. Please register first.");
        setIsSubmitting(false);
        return;
      }

      if (expectedRole !== selectedRole) {
        const roleLabel = expectedRole === "pet-owner" ? "Pet Owner" : expectedRole === "veterinarian" ? "Veterinarian" : "Admin";
        setErrorMessage(`This account is registered as ${roleLabel}. Please choose that role to login.`);
        setIsSubmitting(false);
        return;
      }

      const firebaseIdToken = await userCredential.user.getIdToken();
      const displayName = userCredential.user.displayName || deriveNameFromEmail(userCredential.user.email);

      // Verify and save the role
      const roleVerified = verifyAndSaveRole(email, selectedRole);
      if (!roleVerified) {
        setErrorMessage("Role verification failed. Please register again.");
        setIsSubmitting(false);
        return;
      }

      saveProfileName(displayName, selectedRole);
      saveAccessToken(firebaseIdToken);
      redirectToPets(navigate);
    } catch (error: unknown) {
      const msg = (error as { code?: string; message?: string })?.code
        ?? (error instanceof Error ? error.message : "Google login failed");
      setErrorMessage(msg.replace("auth/", "").replaceAll("-", " "));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome Back" subtitle="Secure login for pet owners, veterinarians, and administrators.">
      <div className="flex flex-1 flex-col">
        <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <button type="button" onClick={() => navigate("/auth/role")} className="text-4xl text-slate-800">←</button>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Sign In</h1>
          <span className="w-6"></span>
        </header>

        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <img
            src={authVetConsultImage}
            alt="Vet consulting pet owner"
            className="h-72 w-full object-cover"
          />
          <div className="px-5 pb-5 pt-4 text-center">
            <h2 className="text-6xl font-extrabold tracking-tight text-slate-900">Welcome Back</h2>
            <p className="mt-2 text-[18px] leading-8 text-slate-600">Log in to monitor your pet's health with AI</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              Role: {roleLabel}
              <button
                type="button"
                onClick={() => navigate("/auth/role")}
                className="text-xs underline underline-offset-2"
              >
                Change
              </button>
            </div>
          </div>
        </div>

        <form key={selectedRole} onSubmit={onSubmit} className="space-y-5" autoComplete="off">
          <div>
            <label className="auth-label text-[18px]">Email Address</label>
            <input
              {...register("email")}
              type="email"
              autoComplete={`${roleAutofillSection} email`}
              className="auth-input"
              placeholder="name@example.com"
            />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="auth-label text-[18px]">Password</label>
              <button type="button" className="text-[18px] font-semibold text-blue-600">Forgot Password?</button>
            </div>
            <input
              {...register("password")}
              type="password"
              autoComplete={`${roleAutofillSection} current-password`}
              className="auth-input"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
          </div>

          <div className="flex items-center gap-2 py-1 text-[18px]">
            <input type="checkbox" className="h-6 w-6 rounded border-slate-300" />
            <label className="text-slate-700">Remember this device</label>
          </div>

          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="auth-primary-btn mt-2"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-5 text-center text-lg text-slate-500">OR CONTINUE WITH</div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="auth-secondary-btn"
          >
            Google
          </button>
          <button
            type="button"
            className="auth-secondary-btn"
          >
            Apple
          </button>
        </div>

        <p className="mt-6 text-center text-lg text-slate-600">
          Don&apos;t have an account? <Link to="/auth/register" className="font-semibold text-blue-600">Create Account</Link>
        </p>

        <div className="mt-8 pb-2 text-center text-sm text-slate-400">
          <p>Privacy Policy  ·  Terms of Service  ·  Help Center</p>
          <p className="mt-2">© 2026 PetHealth AI. All rights reserved.</p>
        </div>
      </div>
    </AuthLayout>
  );
}
