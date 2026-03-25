import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import landingHeroImage from "../assets/images/landing-hero.jpg";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout tone="brand" title="PetHealth AI" subtitle="Professional companion care experience for pet owners and clinics.">
      <div className="flex flex-1 flex-col justify-between py-2 text-white">
        <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-[0_16px_40px_rgba(15,23,42,0.28)] backdrop-blur-sm">
          <img
            src={landingHeroImage}
            alt="Dog at veterinary clinic"
            className="h-72 w-full object-cover"
          />
          <div className="p-5 text-center">
            <h1 className="text-5xl font-bold tracking-tight">PetHealth AI</h1>
            <p className="mt-3 text-lg text-white/90">Smart AI Health Assistant for Your Pet</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/auth/info")}
          className="w-full rounded-3xl bg-white py-4 text-lg font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          Get Started
        </button>
      </div>
    </AuthLayout>
  );
}
