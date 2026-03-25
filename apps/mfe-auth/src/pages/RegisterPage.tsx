import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { getAccessToken, getSelectedRole, clearAccessToken, saveUserCredentials, saveProfileName } from "../lib/session";
import { AuthLayout } from "../components/AuthLayout";

const registerSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email like john@gmail.com"),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  password: z.string().min(9, "Password must be more than 8 characters"),
  confirmPassword: z.string().min(9, "Confirm password must be more than 8 characters"),
  role: z.enum(["pet-owner", "veterinarian", "admin"]),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();

  if (getAccessToken()) {
    return <Navigate to="/pets" replace />;
  }

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const savedRole = getSelectedRole();
  const defaultRole: "pet-owner" | "veterinarian" | "admin" =
    savedRole === "veterinarian" || savedRole === "admin" || savedRole === "pet-owner"
      ? savedRole
      : "pet-owner";
  const roleAutofillSection = `section-${defaultRole.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setErrorMessage(null);
      setIsSubmitting(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password,
      );
      await updateProfile(userCredential.user, { displayName: values.displayName });

      saveUserCredentials(values.email, values.role);
      saveProfileName(values.displayName, values.role);

      clearAccessToken();
      await signOut(auth);
      navigate("/auth/login", { replace: true });
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "";
      if (rawMessage === "role_already_assigned_for_email") {
        setErrorMessage("This email is already registered with another role. Use the original role to login.");
        return;
      }

      const msg = (error as { code?: string; message?: string })?.code
        ?? (error instanceof Error ? error.message : "Registration failed");
      setErrorMessage(msg.replace("auth/", "").replaceAll("-", " "));
    } finally {
      setIsSubmitting(false);
    }
  });

  async function handleGoogleSignup() {
    try {
      setErrorMessage(null);
      setIsSubmitting(true);
      const userCredential = await signInWithPopup(auth, googleProvider);
      const role = defaultRole;
      saveUserCredentials(userCredential.user.email || "", role);
      if (userCredential.user.displayName) {
        saveProfileName(userCredential.user.displayName, role);
      }

      clearAccessToken();
      await signOut(auth);
      navigate("/auth/login", { replace: true });
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "";
      if (rawMessage === "role_already_assigned_for_email") {
        setErrorMessage("This email is already registered with another role. Use the original role to login.");
        return;
      }

      const msg = (error as { code?: string; message?: string })?.code
        ?? (error instanceof Error ? error.message : "Google sign up failed");
      setErrorMessage(msg.replace("auth/", "").replaceAll("-", " "));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create Account" subtitle="Set up your account with secure role-based access.">
      <div className="flex flex-1 flex-col">
        <div className="pwa-card p-5">
          <div className="mb-4">
            <h1 className="text-6xl font-extrabold tracking-tight text-slate-900">Create an account</h1>
            <p className="mt-2 text-[18px] text-slate-500">
              Already have an account? <Link to="/auth/login" className="font-semibold text-blue-600">Log in</Link>
            </p>
          </div>

          <form key={defaultRole} onSubmit={onSubmit} className="space-y-5" autoComplete="off">
            <div>
              <label className="auth-label text-[18px]">Full Name</label>
              <input
                {...register("displayName")}
                type="text"
                autoComplete={`${roleAutofillSection} name`}
                className="auth-input"
                placeholder="John Doe"
              />
              {errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName.message}</p>}
            </div>

            <div>
              <label className="auth-label text-[18px]">I am a</label>
              <select
                {...register("role")}
                className="auth-input bg-white"
                onChange={(event) => {
                  const value = event.target.value as "pet-owner" | "veterinarian" | "admin";
                  localStorage.setItem("companion_ai_selected_role", value);
                }}
              >
                <option value="pet-owner">Pet Owner</option>
                <option value="veterinarian">Veterinarian</option>
                <option value="admin">Platform Admin</option>
              </select>
              {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
            </div>

            <div>
              <label className="auth-label text-[18px]">Email Address</label>
              <input
                {...register("email")}
                type="email"
                autoComplete={`${roleAutofillSection} email`}
                className="auth-input"
                placeholder="john@example.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label className="auth-label text-[18px]">Phone Number</label>
              <input
                {...register("phoneNumber")}
                type="tel"
                autoComplete={`${roleAutofillSection} tel`}
                inputMode="numeric"
                minLength={10}
                maxLength={10}
                pattern="[0-9]{10}"
                onInput={(event) => {
                  const input = event.currentTarget;
                  input.value = input.value.replace(/\D/g, "").slice(0, 10);
                }}
                className="auth-input"
                placeholder="0712345678"
              />
              {errors.phoneNumber && <p className="mt-1 text-xs text-red-600">{errors.phoneNumber.message}</p>}
            </div>

            <div>
              <label className="auth-label text-[18px]">Password</label>
              <input
                {...register("password")}
                type="password"
                autoComplete={`${roleAutofillSection} new-password`}
                className="auth-input"
                placeholder="••••••••"
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <div>
              <label className="auth-label text-[18px]">Confirm Password</label>
              <input
                {...register("confirmPassword")}
                type="password"
                autoComplete={`${roleAutofillSection} new-password`}
                className="auth-input"
                placeholder="••••••••"
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
            </div>

            <label className="flex items-start gap-3 text-[18px] leading-8 text-slate-600">
              <input type="checkbox" className="mt-1 h-6 w-6 rounded border-slate-300" required />
              <span>
                I agree to the <span className="text-blue-600">Terms of Service</span> and <span className="text-blue-600">Privacy Policy</span>.
              </span>
            </label>

            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="auth-primary-btn"
            >
              {isSubmitting ? "Creating account..." : "Create Account →"}
            </button>
          </form>

          <div className="mt-6 text-center text-lg text-slate-500">OR SIGN UP WITH</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={handleGoogleSignup} disabled={isSubmitting} className="auth-secondary-btn">
              Google
            </button>
            <button type="button" className="auth-secondary-btn">
              Apple
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
