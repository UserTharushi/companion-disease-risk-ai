import { useNavigate } from "react-router-dom";
import { startSession } from "../lib/session";
import { Activity, Shield, Stethoscope, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import splashHeroImage from "../assets/images/splash-hero.jpg";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { t, useLanguageStore } from "../lib/language";

const features = [
  { icon: Activity, title: "AI Risk Analysis", desc: "Early disease detection with confidence scoring" },
  { icon: Shield, title: "Health Tracking", desc: "Vaccination records and wellness timeline" },
  { icon: Stethoscope, title: "Clinic Network", desc: "Find qualified veterinary care nearby" },
];

export function SplashPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* Left — visual panel */}
      <div className="relative flex flex-col justify-end bg-gradient-to-br from-primary via-[#4f79f5] to-pet-sky p-6 pb-10 text-white lg:w-1/2 lg:p-12">
        <img
          src={splashHeroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="relative z-10">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pet-cream/20 text-pet-cream">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <ellipse cx="12" cy="17.5" rx="3.5" ry="3" />
                <circle cx="8.2" cy="11.2" r="1.8" />
                <circle cx="15.8" cy="11.2" r="1.8" />
                <circle cx="6.5" cy="14.8" r="1.6" />
                <circle cx="17.5" cy="14.8" r="1.6" />
              </svg>
            </div>
            <span className="font-heading text-[16px] font-semibold tracking-tight">{t(language, "appName")}</span>
            <div className="ml-auto lg:hidden"><LanguageSwitcher compact /></div>
          </div>

          <h1 className="font-heading max-w-md text-3xl font-semibold leading-tight tracking-tight text-pet-cream lg:text-4xl">
            {language === "si" ? "සුරතල් සතුන්ගේ සෞඛ්‍ය බුද්ධි වේදිකාව" : language === "ta" ? "செல்லப்பிராணி ஆரோக்கிய நுண்ணறிவு" : "Companion animal health intelligence"}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#dbefec]">
            {language === "si"
              ? "රෝග අවදානම කලින් හඳුනාගැනීමට AI මත පදනම් වූ තීරණාධාරය. පශු වෛද්‍ය කණ්ඩායම් සහ සුරතල් හිමිකරුවන් සඳහා නිර්මාණය කර ඇත."
              : language === "ta"
                ? "முன்கூட்டிய நோய் அபாய விழிப்புணர்வுக்கான AI-ஐ அடிப்படையாகக் கொண்ட தீர்மான உதவி. கால்நடை குழுக்கள் மற்றும் செல்லப்பிராணி உரிமையாளர்களுக்காக உருவாக்கப்பட்டது."
                : "AI-driven decision support for early disease risk awareness. Built for veterinary teams and pet owners."}
          </p>

          <div className="mt-8 hidden gap-6 lg:flex">
            {features.map((f) => (
              <div key={f.title} className="flex-1">
                <f.icon className="mb-2 h-4 w-4 text-pet-cream" />
                <p className="text-[13px] font-medium text-[#e9f7f4]">{f.title}</p>
                <p className="mt-0.5 text-xs text-[#cde5e2]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — CTA */}
      <div className="flex flex-1 flex-col items-center justify-center bg-surface px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Mobile features */}
          <div className="mb-10 space-y-4 lg:hidden">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pet-mint">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-accent">{f.title}</p>
                  <p className="text-xs text-accent-subtle">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="font-heading text-xl font-semibold tracking-tight text-accent">
            {language === "si" ? "ආරම්භ කරන්න" : language === "ta" ? "தொடங்கவும்" : "Get started"}
          </h2>
          <p className="mt-1 text-sm text-accent-subtle">
            {language === "si" ? "මිනිත්තුවකට අඩු කාලයකින් ගිණුම සකසන්න." : language === "ta" ? "ஒரு நிமிடத்திற்குள் உங்கள் கணக்கை அமைக்கவும்." : "Set up your account in under a minute."}
          </p>

          <div className="mt-6 space-y-3">
            <Button
              size="xl"
              className="w-full"
              onClick={() => { startSession(); navigate("/auth/info"); }}
            >
              {t(language, "createAccount")}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="xl"
              className="w-full"
              onClick={() => navigate("/auth/login")}
            >
              {language === "si" ? "පවතින ගිණුමට පිවිසෙන්න" : language === "ta" ? "உள்ள கணக்கில் உள்நுழைக" : "Sign in to existing account"}
            </Button>
          </div>

          <p className="mt-8 text-center text-xs text-accent-faint">
            {language === "si"
              ? "ඉදිරියට යාමෙන් ඔබ අපගේ සේවා කොන්දේසි සහ රහස්‍යතා ප්‍රතිපත්තියට එකඟ වේ."
              : language === "ta"
                ? "தொடர்வதன் மூலம் எங்கள் சேவை விதிமுறைகள் மற்றும் தனியுரிமைக் கொள்கையை நீங்கள் ஏற்கிறீர்கள்."
                : "By continuing, you agree to our Terms of Service and Privacy Policy."}
          </p>
        </div>
      </div>
    </div>
  );
}
