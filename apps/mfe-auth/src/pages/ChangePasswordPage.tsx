import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { changePassword } from "../lib/auth-api";
import { getAccessToken } from "../lib/session";
import { redirectToPets } from "../lib/post-auth-redirect";
import { toast } from "../lib/use-toast";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useLanguageStore } from "../lib/language";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const token = getAccessToken();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError(language === "si" ? "නව මුරපදය අවම වශයෙන් අකුරු 8ක් විය යුතුය." : language === "ta" ? "புதிய கடவுச்சொல் குறைந்தது 8 எழுத்துகள் இருக்க வேண்டும்." : "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(language === "si" ? "මුරපද නොගැලපේ." : language === "ta" ? "கடவுச்சொற்கள் பொருந்தவில்லை." : "Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(token!, currentPassword, newPassword);
      toast({
        title: language === "si" ? "මුරපදය වෙනස් කරන ලදී" : language === "ta" ? "கடவுச்சொல் மாற்றப்பட்டது" : "Password changed",
        variant: "success",
      });
      redirectToPets(navigate);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="animate-slide-up">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-accent">
              {language === "si" ? "නව මුරපදයක් සකසන්න" : language === "ta" ? "புதிய கடவுச்சொல்லை அமைக்கவும்" : "Set a new password"}
            </h1>
            <p className="mt-0.5 text-sm text-accent-subtle">
              {language === "si"
                ? "ඔබේ ගිණුම පරිපාලක විසින් තාවකාලික මුරපදයකින් සාදන ලදී. ඉදිරියට යාමට පෙර එය වෙනස් කරන්න."
                : language === "ta"
                  ? "உங்கள் கணக்கு நிர்வாகியால் தற்காலிக கடவுச்சொல்லுடன் உருவாக்கப்பட்டது. தொடர்வதற்கு முன் அதை மாற்றவும்."
                  : "Your account was created by an administrator with a temporary password. Change it before continuing."}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">{language === "si" ? "තාවකාලික මුරපදය" : language === "ta" ? "தற்காலிக கடவுச்சொல்" : "Temporary password"}</Label>
            <Input id="current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">{language === "si" ? "නව මුරපදය" : language === "ta" ? "புதிய கடவுச்சொல்" : "New password"}</Label>
            <Input id="new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">{language === "si" ? "නව මුරපදය තහවුරු කරන්න" : language === "ta" ? "புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்" : "Confirm new password"}</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {language === "si" ? "මුරපදය වෙනස් කරන්න" : language === "ta" ? "கடவுச்சொல்லை மாற்று" : "Change password"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
