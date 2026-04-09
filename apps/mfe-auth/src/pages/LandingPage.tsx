import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/button";
import { ArrowRight } from "lucide-react";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-accent">PetHealth AI</h1>
        <p className="mt-2 text-sm text-accent-subtle">Smart AI health assistant for your pet</p>
        <Button size="xl" className="mt-8 w-full" onClick={() => navigate("/auth/info")}>
          Get Started
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </AuthLayout>
  );
}
