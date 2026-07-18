import { create } from "zustand";

export type AppLanguage = "en" | "si" | "ta";

interface LanguageStore {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const STORAGE_KEY = "companion_ai_language";

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    appName: "PetCare AI",
    language: "Language",
    english: "English",
    sinhala: "Sinhala",
    tamil: "Tamil",
    light: "Light",
    dark: "Dark",
    system: "System",
    signIn: "Sign in",
    signOut: "Sign out",
    continue: "Continue",
    createAccount: "Create account",
    role: "Role",
    profile: "Profile",
    overview: "Overview",
    approvals: "Approvals",
    operations: "Operations",
    clinics: "Clinics",
    veterinarians: "Veterinarian",
    addVet: "Add Vet",
    edit: "Edit",
    delete: "Delete",
    available: "Available",
    notAvailable: "Not Available",
    save: "Save",
    cancel: "Cancel",
    back: "Back",
    name: "Name",
    email: "Email",
    phone: "Phone",
    password: "Password",
    address: "Address",
    specialization: "Specialization",
    status: "Status",
    actions: "Actions",
    id: "ID",
    registrationNumber: "Registration Number",
    dateOfBirth: "Date of Birth",
    age: "Age",
    gender: "Gender",
    profilePhoto: "Profile Photo",
  },
  si: {
    appName: "PetCare AI",
    language: "භාෂාව",
    english: "English",
    sinhala: "සිංහල",
    tamil: "தமிழ்",
    light: "ආලෝක",
    dark: "අඳුරු",
    system: "පද්ධති",
    signIn: "පිවිසෙන්න",
    signOut: "ඉවත් වන්න",
    continue: "ඉදිරියට",
    createAccount: "ගිණුමක් සාදන්න",
    role: "භූමිකාව",
    profile: "පැතිකඩ",
    overview: "සාරාංශය",
    approvals: "අනුමැතිය",
    operations: "මෙහෙයුම්",
    clinics: "ක්ලිනික්",
    veterinarians: "වෙට්වරු",
    addVet: "වෙට් එකතු කරන්න",
    edit: "සංස්කරණය",
    delete: "මකන්න",
    available: "ලබා ගත හැක",
    notAvailable: "ලබා ගත නොහැක",
    save: "සුරකින්න",
    cancel: "අවලංගු කරන්න",
    back: "ආපසු",
    name: "නම",
    email: "ඊමේල්",
    phone: "දුරකථනය",
    password: "මුරපදය",
    address: "ලිපිනය",
    specialization: "විශේෂඥතාව",
    status: "තත්ත්වය",
    actions: "ක්‍රියා",
    id: "හැඳුනුම",
    registrationNumber: "ලියාපදිංචි අංකය",
    dateOfBirth: "උපන් දිනය",
    age: "වයස",
    gender: "ස්ත්‍රී/පුරුෂභාවය",
    profilePhoto: "පැතිකඩ ඡායාරූපය",
  },
  ta: {
    appName: "PetCare AI",
    language: "மொழி",
    english: "English",
    sinhala: "සිංහල",
    tamil: "தமிழ்",
    light: "ஒளி",
    dark: "இருள்",
    system: "கணினி",
    signIn: "உள்நுழை",
    signOut: "வெளியேறு",
    continue: "தொடர்க",
    createAccount: "கணக்கை உருவாக்கவும்",
    role: "பங்கு",
    profile: "சுயவிவரம்",
    overview: "மேலோட்டம்",
    approvals: "அனுமதிகள்",
    operations: "செயல்பாடுகள்",
    clinics: "கிளினிக்குகள்",
    veterinarians: "வெட்",
    addVet: "வெட்டை சேர்க்கவும்",
    edit: "திருத்து",
    delete: "நீக்கு",
    available: "கிடைக்கிறது",
    notAvailable: "கிடைக்கவில்லை",
    save: "சேமி",
    cancel: "ரத்து செய்",
    back: "பின்னால்",
    name: "பெயர்",
    email: "மின்னஞ்சல்",
    phone: "தொலைபேசி",
    password: "கடவுச்சொல்",
    address: "முகவரி",
    specialization: "தொழில்முறைத் துறை",
    status: "நிலை",
    actions: "செயல்கள்",
    id: "ஐடி",
    registrationNumber: "பதிவு எண்",
    dateOfBirth: "பிறந்த தேதி",
    age: "வயது",
    gender: "பாலினம்",
    profilePhoto: "சுயவிவர படம்",
  },
};

import { DASHBOARD_TRANSLATIONS } from "./i18n-dashboard";

// Merge dashboard translations into the base dictionary
(Object.keys(TRANSLATIONS) as AppLanguage[]).forEach((lang) => {
  Object.assign(TRANSLATIONS[lang], DASHBOARD_TRANSLATIONS[lang]);
});

function getStoredLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "si" || stored === "ta") return stored;
  } catch {
    // ignore
  }
  return "en";
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: getStoredLanguage(),
  setLanguage: (language) => {
    localStorage.setItem(STORAGE_KEY, language);
    set({ language });
    // Persist to the user's profile (when logged in) so backend agents —
    // recommendations and monitoring notifications — reply in this language.
    void import("./session")
      .then(async ({ getAccessToken }) => {
        const token = getAccessToken();
        if (!token) return;
        const { updateMyProfile } = await import("./auth-api");
        await updateMyProfile(token, { preferredLanguage: language });
      })
      .catch(() => undefined);
  },
}));

export function t(language: AppLanguage, key: string): string {
  return TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

export function getAppLanguage(): AppLanguage {
  return useLanguageStore.getState().language;
}
