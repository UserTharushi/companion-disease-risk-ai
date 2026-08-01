import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/button";
import { ArrowRight } from "lucide-react";
import { t, useLanguageStore } from "../lib/language";

export function LandingPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);

  return (
    <AuthLayout>
      <div className="text-center">
        {/* Product name stays as-is in every language — it is a brand, not copy. */}
        <h1 className="text-2xl font-semibold tracking-tight text-accent">PetHealth AI</h1>
        <p className="mt-2 text-sm text-accent-subtle">{tr("appTagline")}</p>
        <Button size="xl" className="mt-8 w-full" onClick={() => navigate("/auth/info")}>
          {tr("getStarted")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </AuthLayout>
  );
}
