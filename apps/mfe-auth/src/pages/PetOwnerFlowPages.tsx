import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Calendar, Camera, Check, ClipboardList, MapPin, Phone, Share2, ShieldCheck, Star, Stethoscope, Trophy, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguageStore } from "../lib/language";
import petBuddyImage from "../assets/images/pet-buddy.jpg";
import petLunaImage from "../assets/images/pet-luna.jpg";
import authVetConsultImage from "../assets/images/auth-vet-consult.jpg";
import onboardingVaccineImage from "../assets/images/onboarding-vaccine.jpg";

type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: string;
  weightKg: string;
  photoDataUrl?: string;
  vaccinationName?: string;
  vaccinationDate?: string;
  vaccinationFrequency?: string;
  nextVaccinationDate?: string;
};

type Surgeon = {
  id: string;
  name: string;
  specialization: string;
  avatar: string;
  slots: string[];
};

type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  image: string;
  rating: number;
  reviews: number;
  surgeons: Surgeon[];
};

type BookingSummary = {
  petId: string;
  petName: string;
  clinicId: string;
  clinicName: string;
  surgeonName: string;
  slot: string;
};

const PETS_KEY = "companion_ai_pet_owner_pets";
const LAST_BOOKING_KEY = "companion_ai_last_booking";
const LAST_SYMPTOM_KEY = "companion_ai_last_symptom_submission";

const headerClass = "sticky top-0 z-10 border-b border-border bg-surface dark:border-neutral-800 dark:bg-neutral-900";
const cardClass = "rounded-2xl border border-border bg-surface shadow-sm dark:border-neutral-800 dark:bg-neutral-900";
const cardClassP4 = `${cardClass} p-4`;
const cardClassP5 = `${cardClass} p-5`;
const cardClassP6 = `${cardClass} p-6`;
const selectClass = "h-10 w-full rounded-xl border border-border bg-surface px-3 text-accent outline-none transition focus:border-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100";
const textAreaClass = "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-accent outline-none transition focus:border-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100";

const fallbackPets: Pet[] = [
  { id: "pet-1", name: "Buddy", species: "Dog", breed: "Golden Retriever", age: "3", weightKg: "34", photoDataUrl: petBuddyImage },
  { id: "pet-2", name: "Luna", species: "Cat", breed: "Siamese", age: "4", weightKg: "5", photoDataUrl: petLunaImage },
];

const clinics: Clinic[] = [
  {
    id: "clinic-1",
    name: "PetHealth Central Clinic",
    address: "123 Wellness Way, Medical District",
    phone: "+1 (555) 010-9988",
    image: authVetConsultImage,
    rating: 4.8,
    reviews: 128,
    surgeons: [
      { id: "s1", name: "Dr. James Wilson", specialization: "Orthopedic", avatar: authVetConsultImage, slots: ["Mon 09:00 AM", "Mon 10:30 AM", "Mon 01:00 PM", "Mon 02:30 PM", "Mon 04:00 PM"] },
      { id: "s2", name: "Dr. Sarah Chen", specialization: "General", avatar: onboardingVaccineImage, slots: ["Tue 09:00 AM", "Tue 11:30 AM", "Wed 01:30 PM"] },
      { id: "s3", name: "Dr. Marc Aris", specialization: "Dental", avatar: authVetConsultImage, slots: ["Thu 10:00 AM", "Thu 02:00 PM", "Fri 09:30 AM"] },
    ],
  },
];

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function PageShell({ title, rightAction, children }: { title: string; rightAction?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-surface-secondary dark:bg-neutral-950">
      <header className={headerClass}>
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-4 sm:px-6">
          <button onClick={() => navigate(-1)} className="text-accent"><ArrowLeft className="h-6 w-6" /></button>
          <h1 className="text-xl font-semibold text-accent">{title}</h1>
          <div className="flex items-center gap-2">
            {rightAction}
            <LanguageSwitcher compact />
            <ThemeSwitcher compact />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:p-6">{children}</main>
    </div>
  );
}

type PetProfilePageProps = {
  embedded?: boolean;
  petIdOverride?: string;
  onBack?: () => void;
};

export function PetProfilePage({ embedded = false, petIdOverride, onBack }: PetProfilePageProps = {}) {
  const { petId } = useParams();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const pets = safeRead<Pet[]>(PETS_KEY, fallbackPets);
  const resolvedPetId = petIdOverride ?? petId;
  const pet = pets.find((p) => p.id === resolvedPetId) ?? pets[0];

  const vaccineHistory = pet.vaccinationName
    ? [{ id: "v1", name: pet.vaccinationName, date: pet.vaccinationDate || "Not provided", freq: pet.vaccinationFrequency || "Annual", status: pet.nextVaccinationDate ? "due" as const : "active" as const }]
    : [
        { id: "v1", name: language === "si" ? "ජලභීතිකාව එන්නත" : language === "ta" ? "ரேபிஸ் தடுப்பூசி" : "Rabies Vaccine", date: "Oct 12, 2023", freq: language === "si" ? "වාර්ෂික" : language === "ta" ? "வருடாந்திரம்" : "Annual", status: "active" as const },
        { id: "v2", name: "Bordetella", date: "Apr 22, 2024", freq: language === "si" ? "කල් ඉකුත් වීමට නියමිත" : language === "ta" ? "காலாவதியாகும்" : "Expires", status: "due" as const },
      ];

  const latestBooking = safeRead<BookingSummary | null>(LAST_BOOKING_KEY, null);
  const latestSymptomSubmission = safeRead<{
    petId: string;
    symptoms: string[];
    notes: string;
    at?: string;
  } | null>(LAST_SYMPTOM_KEY, null);

  const healthHistoryItems: Array<{ id: string; title: string; detail: string; meta: string }> = [];

  if (latestSymptomSubmission?.petId === pet.id) {
    const symptomText = latestSymptomSubmission.symptoms.length
      ? latestSymptomSubmission.symptoms.join(", ")
      : (language === "si" ? "රෝග ලක්ෂණ සටහන් කර නොමැත" : language === "ta" ? "அறிகுறிகள் பதிவு செய்யப்படவில்லை" : "No symptoms were selected");

    healthHistoryItems.push({
      id: "symptom-report",
      title: language === "si" ? "අවසාන රෝග ලක්ෂණ වාර්තාව" : language === "ta" ? "கடைசி அறிகுறி அறிக்கை" : "Latest Symptom Report",
      detail: symptomText,
      meta: language === "si" ? "AI විශ්ලේෂණයට යොමු කළ සටහන" : language === "ta" ? "AI பகுப்பாய்வுக்கு அனுப்பப்பட்ட பதிவு" : "Submitted for AI analysis",
    });
  }

  if (latestBooking?.petId === pet.id) {
    healthHistoryItems.push({
      id: "latest-booking",
      title: language === "si" ? "අවසාන ක්ලිනික් හමුව" : language === "ta" ? "கடைசி கிளினிக் சந்திப்பு" : "Latest Clinic Appointment",
      detail: `${latestBooking.clinicName} - ${latestBooking.surgeonName}`,
      meta: `${language === "si" ? "වේලාව" : language === "ta" ? "நேரம்" : "Time"}: ${latestBooking.slot}`,
    });
  }

  const timeline = [
    {
      id: "t1",
      title: language === "si" ? "AI පුරෝකථනය" : language === "ta" ? "AI கணிப்பு" : "AI PREDICTION",
      heading: language === "si" ? "ක්‍රියාකාරී මට්ටම 12% කින් ඉහළයි" : language === "ta" ? "செயல்பாட்டு அளவு 12% அதிகம்" : "Activity levels are 12% higher",
      body: language === "si"
        ? `මෑත කාලීන collar දත්ත අනුව ${pet.name} වැඩි ශක්තියක් පෙන්වයි. වත්මන් කැලරි ප්‍රමාණය තබා ගන්න.`
        : language === "ta"
          ? `சமீபத்திய collar தரவின் அடிப்படையில் ${pet.name} அதிக சக்தியை காட்டுகிறது. தற்போதைய கலோரி அளவைத் தொடரவும்.`
          : `Based on recent collar data, ${pet.name} is showing increased stamina. Maintain current calorie intake.`,
      meta: language === "si" ? "අද" : language === "ta" ? "இன்று" : "TODAY",
      tone: "primary",
      icon: ShieldCheck,
    },
    {
      id: "t2",
      title: language === "si" ? "වෛද්‍ය පරීක්ෂාව" : language === "ta" ? "மருத்துவ பரிசோதனை" : "CLINICAL CHECKUP",
      heading: language === "si" ? "සාමාන්‍ය සුවතාව පරීක්ෂාව" : language === "ta" ? "பொது நல பரிசோதனை" : "General Wellness Exam",
      body: language === "si" ? "හෘදය සහ පෙනහලු හොඳින් ඇසේ. සන්ධි වයසට ගැළපෙන ලෙස සෞඛ්‍යවත්ය." : language === "ta" ? "இதயம் மற்றும் நுரையீரல் தெளிவாக உள்ளது. மூட்டுகள் வயதுக்கு ஏற்றதாக ஆரோக்கியமாக உள்ளன." : "Heart and lungs sound clear. Joints are healthy for age.",
      meta: language === "si" ? "මාර්තු 15" : language === "ta" ? "மார் 15" : "MAR 15",
      tone: "neutral",
      icon: ClipboardList,
    },
    {
      id: "t3",
      title: language === "si" ? "සැලකිය යුතු පියවර" : language === "ta" ? "முக்கிய அடைவு" : "MILESTONE",
      heading: language === "si" ? "ඉලක්ක බරට ළඟා විය" : language === "ta" ? "இலக்கு எடையை அடைந்தது" : "Reached Target Weight",
      body: language === "si" ? `${pet.name} ඉලක්ක බරට සාර්ථකව ළඟා වී ඉහළ ප්‍රෝටීන් ආහාරයට මාරු විය.` : language === "ta" ? `${pet.name} இலக்கு எடையை வெற்றிகரமாக அடைந்து, அதிக புரதம் கொண்ட உணவு மாற்றத்தை முடித்தது.` : `${pet.name} successfully hit the target weight and completed a high-protein diet transition.`,
      meta: language === "si" ? "පෙබ 10" : language === "ta" ? "பிப் 10" : "FEB 10",
      tone: "neutral",
      icon: Trophy,
    },
  ];

  const content = (
    <>
      <section className={`${cardClassP6} text-center`}>
        <div className="relative mx-auto h-40 w-40">
          <img src={pet.photoDataUrl || petBuddyImage} alt={pet.name} className="h-40 w-40 rounded-full border-4 border-surface object-cover shadow-sm" />
          <button type="button" className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full border-2 border-surface bg-primary text-white shadow-sm">
            <Camera className="h-5 w-5" />
          </button>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-accent">{pet.name}</h2>
        <p className="mt-1 text-sm text-accent-subtle">{pet.breed} • {pet.age} years old</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <span className="rounded-full bg-info-light px-3 py-1 text-sm font-semibold text-primary">{pet.weightKg} lbs</span>
          <span className="rounded-full bg-surface-tertiary px-3 py-1 text-sm font-semibold text-accent-muted dark:bg-neutral-800">{pet.species}</span>
        </div>
      </section>

      <section className={cardClassP5}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-accent">Vaccination History</h3>
          <button className="text-sm font-semibold text-primary">View All</button>
        </div>
        <div className="space-y-3">
          {vaccineHistory.map((v) => (
            <article key={v.id} className="rounded-2xl border border-border bg-surface p-4 dark:border-neutral-700 dark:bg-neutral-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-accent">{v.name}</p>
                  <p className="text-sm text-accent-subtle">{v.date} • {v.freq}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${v.status === "active" ? "bg-success-light text-success-fg" : "bg-warning-light text-warning-fg"}`}>
                  {v.status === "active" ? "Active" : "Due Soon"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={cardClassP5}>
        <div className="mb-2">
          <h3 className="text-[15px] font-semibold text-accent">Health History & Insights</h3>
          <p className="text-sm text-accent-subtle">AI-driven monitoring and clinical logs</p>
        </div>
        <div className="mt-4 space-y-4">
          {timeline.map((item) => {
            const Icon = item.icon;
            const highlight = item.tone === "primary";
            return (
              <article key={item.id} className={`rounded-2xl border p-4 ${highlight ? "border-primary/40 bg-info-light dark:bg-primary/10" : "border-border bg-surface dark:border-neutral-700 dark:bg-neutral-950"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full ${highlight ? "bg-primary text-white" : "bg-surface-tertiary text-accent"}`}><Icon className="h-4 w-4" /></span>
                    <p className="text-xs font-bold uppercase tracking-widest text-accent-subtle">{item.title}</p>
                  </div>
                  <span className="text-xs font-semibold text-accent-faint">{item.meta}</span>
                </div>
                <p className="text-[14px] font-semibold text-accent">{item.heading}</p>
                <p className="mt-1 text-sm text-accent-subtle">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={cardClassP5}>
        <div className="mb-2">
          <h3 className="text-[15px] font-semibold text-accent">{language === "si" ? "සෞඛ්‍ය ඉතිහාසය" : language === "ta" ? "சுகாதார வரலாறு" : "Health History"}</h3>
          <p className="text-sm text-accent-subtle">{language === "si" ? "මෙම සුරතලා සඳහා මෑත වාර්තා" : language === "ta" ? "இந்த செல்லப்பிராணிக்கான சமீபப் பதிவுகள்" : "Recent records for this pet"}</p>
        </div>
        {healthHistoryItems.length ? (
          <div className="space-y-3">
            {healthHistoryItems.map((item) => (
              <article key={item.id} className="rounded-2xl border border-border bg-surface p-4 dark:border-neutral-700 dark:bg-neutral-950">
                <p className="text-[13px] font-semibold text-accent">{item.title}</p>
                <p className="mt-1 text-sm text-accent-subtle">{item.detail}</p>
                <p className="mt-1 text-xs text-accent-faint">{item.meta}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-surface p-3 text-sm text-accent-subtle dark:border-neutral-700 dark:bg-neutral-950">
            {language === "si" ? "තවම මෙම සුරතලා සඳහා වාර්තා නොමැත." : language === "ta" ? "இந்த செல்லப்பிராணிக்கான பதிவுகள் இன்னும் இல்லை." : "No health history records are available for this pet yet."}
          </p>
        )}
      </section>

      <div className="space-y-3 pb-4">
        <Button size="xl" className="w-full" onClick={() => navigate(`/pets/symptoms/${pet.id}`)}>Analyze Symptoms</Button>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="w-full space-y-6 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-accent">Pet Details</h2>
            <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">View pet profile and health records</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => (onBack ? onBack() : navigate("/pets"))}>Back</Button>
        </div>
        {content}
      </div>
    );
  }

  return <PageShell title="Pet Profile" rightAction={<button className="text-lg font-semibold text-primary">Edit</button>}>{content}</PageShell>;
}

type ClinicDetailsPageProps = {
  embedded?: boolean;
  clinicIdOverride?: string;
  onBack?: () => void;
};

export function ClinicDetailsPage({ embedded = false, clinicIdOverride, onBack }: ClinicDetailsPageProps = {}) {
  const { clinicId } = useParams();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const pets = safeRead<Pet[]>(PETS_KEY, fallbackPets);
  const resolvedClinicId = clinicIdOverride ?? clinicId;
  const clinic = clinics.find((c) => c.id === resolvedClinicId) ?? clinics[0];
  const [selectedSurgeonId, setSelectedSurgeonId] = useState(clinic.surgeons[0]?.id ?? "");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id ?? "");
  const [clinicRating, setClinicRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedDay, setSelectedDay] = useState("Mon 12");
  const selectedSurgeon = clinic.surgeons.find((s) => s.id === selectedSurgeonId) ?? clinic.surgeons[0];
  const scheduleDays = ["Mon 12", "Tue 13", "Wed 14", "Thu 15"];
  const consultationFee = 45;
  const adminFee = 5;
  const total = consultationFee + adminFee;

  function confirmBooking() {
    if (!selectedSlot || !selectedSurgeon) return;
    const selectedPet = pets.find((p) => p.id === selectedPetId) ?? pets[0];
    const summary: BookingSummary = {
      petId: selectedPet.id,
      petName: selectedPet.name,
      clinicId: clinic.id,
      clinicName: clinic.name,
      surgeonName: selectedSurgeon.name,
      slot: selectedSlot,
    };
    localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(summary));
    navigate("/pets/booking-confirmed");
  }

  const content = (
    <>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <img src={clinic.image} alt={clinic.name} className="h-52 w-full object-cover sm:h-60" />
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2"><Badge variant="info">{language === "si" ? "ඉහළම ශ්‍රේණිගත" : language === "ta" ? "சிறந்த மதிப்பீடு" : "Top Rated"}</Badge><h2 className="text-[15px] font-semibold text-accent">{clinic.name}</h2></div>
          <div>
            <p className="flex items-center gap-2 text-sm text-accent-subtle"><MapPin className="h-4 w-4" />{clinic.address}</p>
            <p className="ml-6 text-sm text-accent-faint">{language === "si" ? "නියු යෝර්ක්, NY 10001" : language === "ta" ? "நியூயோர்க், NY 10001" : "New York, NY 10001"}</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-accent"><Phone className="h-4 w-4" />{clinic.phone}</p>
          <div className="rounded-2xl border border-border bg-surface-tertiary p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-semibold text-accent">{clinic.rating}</p>
              <div className="text-right">
                <p className="text-[13px] font-semibold text-accent">{clinic.reviews} {language === "si" ? "සමාලෝචන" : language === "ta" ? "மதிப்புரைகள்" : "Reviews"}</p>
                <p className="text-sm text-accent-subtle">{language === "si" ? "95% පාරිභෝගිකයන් සතුටුයි" : language === "ta" ? "95% வாடிக்கையாளர்கள் திருப்தி" : "95% satisfied clients"}</p>
              </div>
            </div>
            <p className="mt-1 text-warning-fg">★★★★★</p>
          </div>
        </div>
      </section>

      <section className={cardClassP4}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-accent">{language === "si" ? "ලබා ගත හැකි ශල්‍ය වෛද්‍යවරු" : language === "ta" ? "கிடைக்கும் அறுவை மருத்தவர்கள்" : "Available Surgeons"}</h3>
          <button type="button" className="text-sm font-semibold text-primary">{language === "si" ? "සියල්ල බලන්න" : language === "ta" ? "அனைத்தும் காண்க" : "View All"}</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {clinic.surgeons.map((surgeon) => (
            <button key={surgeon.id} onClick={() => { setSelectedSurgeonId(surgeon.id); setSelectedSlot(""); }} className={`rounded-xl border p-2 text-center transition ${selectedSurgeonId === surgeon.id ? "border-primary bg-info-light dark:border-primary dark:bg-primary/20" : "border-border bg-surface dark:border-neutral-700 dark:bg-neutral-950"}`}>
              <img src={surgeon.avatar} alt={surgeon.name} className="mx-auto h-12 w-12 rounded-full object-cover" />
              <p className="mt-1 text-xs font-semibold text-accent">{surgeon.name.split(" ").slice(0, 2).join(" ")}</p>
            </button>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-base font-semibold text-accent">{language === "si" ? "කාලසටහන තෝරන්න" : language === "ta" ? "அட்டவணையைத் தேர்ந்தெடுக்கவும்" : "Select Schedule"}</p>
          <p className="mt-1 text-sm text-accent-subtle">{language === "si" ? "සැප්තැම්බර් 2024" : language === "ta" ? "செப்டம்பர் 2024" : "September 2024"}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {scheduleDays.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`rounded-2xl border px-2 py-3 text-center transition ${selectedDay === day ? "border-primary bg-primary text-white" : "border-border bg-surface text-accent dark:border-neutral-700 dark:bg-neutral-950"}`}
              >
                <p className="text-xs uppercase">{day.split(" ")[0]}</p>
                <p className="text-lg font-semibold">{day.split(" ")[1]}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label className="text-sm">{language === "si" ? "සුරතලය තෝරන්න" : language === "ta" ? "செல்லப்பிராணியைத் தேர்ந்தெடுக்கவும்" : "Select Pet"}</Label>
          <select className={selectClass} value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)}>
            {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
          </select>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-base font-semibold text-accent">{language === "si" ? "ලබා ගත හැකි වේලාවන්" : language === "ta" ? "கிடைக்கும் நேர இடங்கள்" : "Available Time Slots"}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {selectedSurgeon?.slots.map((slot) => (
              <button key={slot} onClick={() => setSelectedSlot(slot)} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${selectedSlot === slot ? "border-primary bg-primary text-white" : "border-border bg-surface text-accent dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"}`}>
                {slot}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-surface p-4 dark:border-neutral-700 dark:bg-neutral-950">
          <h4 className="text-lg font-semibold text-accent">{language === "si" ? "බුකින් සාරාංශය" : language === "ta" ? "முன்பதிவு சுருக்கம்" : "Booking Summary"}</h4>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-accent-subtle">{language === "si" ? "උපදේශන ගාස්තුව" : language === "ta" ? "ஆலோசனை கட்டணம்" : "Consultation Fee"}</span><span className="font-semibold text-accent">${consultationFee.toFixed(2)}</span></div>
            <div className="flex items-center justify-between"><span className="text-accent-subtle">{language === "si" ? "පරිපාලන ගාස්තු" : language === "ta" ? "நிர்வாகக் கட்டணம்" : "Admin Charges"}</span><span className="font-semibold text-accent">${adminFee.toFixed(2)}</span></div>
            <div className="mt-2 border-t border-border pt-2 flex items-center justify-between"><span className="text-base font-semibold text-accent">{language === "si" ? "මුළු මුදල" : language === "ta" ? "மொத்த தொகை" : "Total Amount"}</span><span className="text-xl font-bold text-primary">${total.toFixed(2)}</span></div>
          </div>
        </div>

        <Button size="xl" className="mt-4 w-full" onClick={confirmBooking} disabled={!selectedSlot}>{language === "si" ? "හමුවීම් වෙන් කරන්න" : language === "ta" ? "நேரம் பதிவு செய்யவும்" : "Book Appointment"}</Button>
      </section>

      <section className={cardClassP4}>
        <h3 className="text-[15px] font-semibold text-accent">{language === "si" ? "මෙම ක්ලිනික් එක රේට් කරන්න" : language === "ta" ? "இந்த கிளினிக்கிற்கு மதிப்பிடவும்" : "Rate This Clinic"}</h3>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setClinicRating(n)}><Star className={`h-7 w-7 ${n <= clinicRating ? "fill-primary text-primary" : "text-border-strong"}`} /></button>
          ))}
        </div>
        <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} className={`mt-3 h-28 ${textAreaClass}`} placeholder={language === "si" ? "කාර්ය මණ්ඩලය, රැඳී සිටීමේ කාලය සහ සේවා ගුණාත්මකභාවය පිළිබඳව ඔබගේ අදහස බෙදාගන්න" : language === "ta" ? "பணியாளர்கள், காத்திருக்கும் நேரம் மற்றும் சேவை தரம் பற்றிய உங்கள் கருத்தை பகிரவும்" : "Share your review about staff, wait time and service quality"} />
        <Button variant="secondary" className="mt-3">{language === "si" ? "සමාලෝචනය යවන්න" : language === "ta" ? "மதிப்புரையை சமர்ப்பிக்கவும்" : "Submit Review"}</Button>
      </section>
    </>
  );

  if (embedded) {
    return (
      <div className="w-full space-y-6 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-accent">{language === "si" ? "ක්ලිනික් විස්තර" : language === "ta" ? "கிளினிக் விவரங்கள்" : "Clinic Details"}</h2>
            <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{language === "si" ? "හමුවීම් වෙන් කර ක්ලිනික් සේවය රේට් කරන්න" : language === "ta" ? "முன்பதிவுகளை செய்து கிளினிக் சேவையை மதிப்பிடவும்" : "Book appointments and rate clinic service"}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => (onBack ? onBack() : navigate("/pets"))}>{language === "si" ? "ආපසු" : language === "ta" ? "பின்னால்" : "Back"}</Button>
        </div>
        {content}
      </div>
    );
  }

  return <PageShell title={language === "si" ? "ක්ලිනික් විස්තර" : language === "ta" ? "கிளினிக் விவரங்கள்" : "Clinic Details"} rightAction={<Share2 className="h-5 w-5 text-accent" />}>{content}</PageShell>;
}

export function BookingConfirmationPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const booking = safeRead<BookingSummary | null>(LAST_BOOKING_KEY, null);

  return (
    <PageShell title={language === "si" ? "තහවුරු කිරීම" : language === "ta" ? "உறுதிப்படுத்தல்" : "Confirmation"}>
      <section className={`${cardClassP6} text-center`}>
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-info-light">
          <Check className="h-12 w-12 text-primary" />
        </div>
        <h2 className="mt-4 text-3xl font-semibold text-accent">{language === "si" ? "බුකින් තහවුරු විය!" : language === "ta" ? "முன்பதிவு உறுதியாகியது!" : "Booking Confirmed!"}</h2>
        <p className="mt-2 text-base text-accent-subtle">{language === "si" ? "ඔබගේ හමුවීම සාර්ථකව නියම කර ඇත." : language === "ta" ? "உங்கள் சந்திப்பு வெற்றிகரமாக திட்டமிடப்பட்டது." : "Your appointment has been successfully scheduled."}</p>
      </section>

      <section className={cardClassP5}>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-faint">{language === "si" ? "හමුවීමේ සාරාංශය" : language === "ta" ? "நியமன சுருக்கம்" : "Appointment Summary"}</h3>
        <div className="mt-3 space-y-2 text-sm text-accent">
          <p><span className="text-accent-subtle">{language === "si" ? "සුරතලා:" : language === "ta" ? "செல்லப்பிராணி:" : "Pet:"}</span> {booking?.petName ?? "Buddy"}</p>
          <p><span className="text-accent-subtle">{language === "si" ? "ක්ලිනික්:" : language === "ta" ? "கிளினிக்:" : "Clinic:"}</span> {booking?.clinicName ?? "PetHealth Central Clinic"}</p>
          <p><span className="text-accent-subtle">{language === "si" ? "ශල්‍ය වෛද්‍යවරයා:" : language === "ta" ? "அறுவை மருத்துவர்:" : "Surgeon:"}</span> {booking?.surgeonName ?? "Dr. James Wilson"}</p>
          <p><span className="text-accent-subtle">{language === "si" ? "වේලාව:" : language === "ta" ? "நேரம்:" : "Time:"}</span> {booking?.slot ?? "Mon 09:00 AM"}</p>
        </div>
      </section>

      <div className="space-y-3 pb-4">
        <Button size="xl" className="w-full" onClick={() => navigate("/pets")}>{language === "si" ? "මුල් පිටුවට යන්න" : language === "ta" ? "முகப்புக்கு திரும்பவும்" : "Return to Home"}</Button>
      </div>
    </PageShell>
  );
}

export function ServiceFeedbackPage() {
  const language = useLanguageStore((state) => state.language);
  const [clinicRating, setClinicRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [clinicId, setClinicId] = useState(clinics[0].id);
  const [suggestions, setSuggestions] = useState(false);

  function submitFeedback() {
    const payload = { clinicRating, clinicId, feedback, suggestions, at: new Date().toISOString() };
    localStorage.setItem("companion_ai_service_feedback", JSON.stringify(payload));
  }

  return (
    <PageShell title={language === "si" ? "ක්ලිනික් ප්‍රතිපෝෂණය" : language === "ta" ? "கிளினிக் கருத்து" : "Clinic Feedback"}>
      <section className={`${cardClassP6} text-center`}>
        <h2 className="text-3xl font-semibold text-accent">{language === "si" ? "අපට ඔබගේ අදහස වැදගත්" : language === "ta" ? "உங்கள் கருத்து எங்களுக்கு முக்கியம்" : "We value your feedback"}</h2>
        <p className="mt-2 text-base text-accent-subtle">{language === "si" ? "ඔබගේ ක්ලිනික් අත්දැකීම රේට් කර අපට දියුණු වීමට උදවු කරන්න." : language === "ta" ? "உங்கள் கிளினிக் அனுபவத்தை மதிப்பிட்டு எங்களை மேம்பட உதவுங்கள்." : "Rate your clinic experience and help us improve."}</p>
      </section>

      <section className={cardClassP5}>
        <Label className="text-sm">{language === "si" ? "ක්ලිනික් සමාලෝචනය" : language === "ta" ? "கிளினிக் மதிப்புரை" : "Clinic Review"}</Label>
        <select className={`mt-2 ${selectClass}`} value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
          {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
        </select>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setClinicRating(n)}><Star className={`h-7 w-7 ${n <= clinicRating ? "fill-primary text-primary" : "text-border-strong"}`} /></button>
          ))}
        </div>
      </section>

      <section className={cardClassP5}>
        <Label className="text-sm">{language === "si" ? "ඔබගේ අත්දැකීම අපට කියන්න" : language === "ta" ? "உங்கள் அனுபவத்தை பகிரவும்" : "Tell us about your experience"}</Label>
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className={`mt-2 h-32 ${textAreaClass}`} placeholder={language === "si" ? "ඔබට කැමති වූ දේ? දියුණු විය යුතු දේ?" : language === "ta" ? "உங்களுக்கு என்ன பிடித்தது? எதை மேம்படுத்த வேண்டும்?" : "What did you like? What should improve?"} />
        <label className="mt-4 flex items-center justify-between rounded-2xl border border-border px-4 py-3 dark:border-neutral-700 dark:bg-neutral-950">
          <span className="text-sm text-accent">{language === "si" ? "මම වැඩිදියුණු කිරීම් යෝජනා කිරීමට කැමතියි" : language === "ta" ? "மேம்பாடுகளை பரிந்துரைக்க விரும்புகிறேன்" : "I'd like to suggest improvements"}</span>
          <input type="checkbox" checked={suggestions} onChange={(e) => setSuggestions(e.target.checked)} className="h-5 w-5" />
        </label>
      </section>

      <div className="space-y-3 pb-4">
        <Button size="xl" className="w-full" onClick={submitFeedback}>{language === "si" ? "ප්‍රතිපෝෂණය යවන්න" : language === "ta" ? "கருத்தை சமர்ப்பிக்கவும்" : "Submit Feedback"}</Button>
      </div>
    </PageShell>
  );
}

export function SymptomReportPage() {
  const { petId } = useParams();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const pets = safeRead<Pet[]>(PETS_KEY, fallbackPets);
  const pet = pets.find((p) => p.id === petId) ?? pets[0];

  type SeverityKey = "none" | "normal" | "mild" | "moderate" | "severe";

  const [activityLevel, setActivityLevel] = useState<SeverityKey>("normal");
  const [appetiteLevel, setAppetiteLevel] = useState<SeverityKey>("normal");
  const [urinationLevel, setUrinationLevel] = useState<SeverityKey>("normal");
  const [diarrheaLevel, setDiarrheaLevel] = useState<SeverityKey>("none");
  const [vomitingLevel, setVomitingLevel] = useState<SeverityKey>("none");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [aiGuided, setAiGuided] = useState(true);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [formError, setFormError] = useState("");

  const symptomOptions: Array<{ id: string; label: string }> = [
    { id: "lethargy", label: language === "si" ? "අලසභාවය" : language === "ta" ? "சோர்வு" : "Lethargy" },
    { id: "coughing", label: language === "si" ? "කැස්ස" : language === "ta" ? "இருமல்" : "Coughing" },
    { id: "fever", label: language === "si" ? "ජ්වරය" : language === "ta" ? "காய்ச்சல்" : "Fever" },
    { id: "reduced-activity", label: language === "si" ? "ක්‍රියාකාරීත්වය අඩුවීම" : language === "ta" ? "செயல்பாடு குறைவு" : "Reduced activity" },
    { id: "stiff-gait", label: language === "si" ? "ඇවිදීමේ අපහසුතාව" : language === "ta" ? "நடையின் தடை" : "Stiff gait" },
    { id: "loss-of-appetite", label: language === "si" ? "ආහාර රුචිය අඩුවීම" : language === "ta" ? "பசியின்மை" : "Loss of appetite" },
    { id: "skin-irritation", label: language === "si" ? "සමේ කැසීම" : language === "ta" ? "தோல் எரிச்சல்" : "Skin irritation" },
    { id: "breathing-difficulty", label: language === "si" ? "හුස්ම ගැනීමේ අපහසුතාව" : language === "ta" ? "மூச்சுத்திணறல்" : "Breathing difficulty" },
  ];

  function getSeverityLabel(value: SeverityKey) {
    if (language === "si") {
      if (value === "none") return "නැත";
      if (value === "normal") return "සාමාන්‍ය";
      if (value === "mild") return "සුළු";
      if (value === "moderate") return "මධ්‍යම";
      return "දැඩි";
    }

    if (language === "ta") {
      if (value === "none") return "இல்லை";
      if (value === "normal") return "இயல்பு";
      if (value === "mild") return "இலகு";
      if (value === "moderate") return "மிதம்";
      return "கடுமை";
    }

    if (value === "none") return "None";
    if (value === "normal") return "Normal";
    if (value === "mild") return "Mild";
    if (value === "moderate") return "Moderate";
    return "Severe";
  }

  const generalLevelOptions: SeverityKey[] = ["normal", "mild", "moderate", "severe"];
  const bowelLevelOptions: SeverityKey[] = ["none", "mild", "moderate", "severe"];

  function toggleSymptom(value: string) {
    setSymptoms((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  }

  function assistWithAI() {
    const assisted = language === "si"
      ? "AI සහායක යෝජනාව: රෝග ලක්ෂණ පැවති කාලය, ආහාර ගැනීම සහ පසුගිය පැය 48 තුළ චලන වෙනස්කම් ඇතුළත් කරන්න."
      : language === "ta"
        ? "AI உதவியாளர் பரிந்துரை: அறிகுறி நீடித்த காலம், உணவு உட்கோள்வு, மற்றும் கடந்த 48 மணிநேர இயக்க மாற்றங்களை சேர்க்கவும்."
        : "AI Assistant Suggestion: include symptom duration, food intake, and mobility changes over last 48 hours.";
    setNotes((prev) => (prev ? `${prev}\n${assisted}` : assisted));
  }

  function handleImageUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function analyze() {
    if (!symptoms.length) {
      setFormError(language === "si" ? "විශ්ලේෂණයට පෙර අවම වශයෙන් එක් පොදු රෝග ලක්ෂණයක් තෝරන්න." : language === "ta" ? "பகுப்பாய்வுக்கு முன் குறைந்தது ஒரு பொதுவான அறிகுறியைத் தேர்ந்தெடுக்கவும்." : "Please select at least one common symptom before analyzing.");
      return;
    }

    setFormError("");
    localStorage.setItem(LAST_SYMPTOM_KEY, JSON.stringify({
      petId: pet.id,
      vitals: {
        activityLevel,
        appetiteLevel,
        urinationLevel,
        diarrheaLevel,
        vomitingLevel,
      },
      symptoms,
      notes,
      imageDataUrl,
    }));
    navigate(`/pets/prediction/${pet.id}`);
  }

  return (
    <PageShell title={language === "si" ? "රෝග ලක්ෂණ වාර්තා කරන්න" : language === "ta" ? "அறிகுறிகளை அறிக்கை செய்யவும்" : "Report Symptoms"}>
      <section className="rounded-2xl border border-info/30 bg-info-light p-4 text-sm text-accent-muted dark:border-info/40 dark:bg-primary/10 dark:text-neutral-200">
        {language === "si" ? "හැසිරීමේ වෙනස්කම් වාර්තා කිරීම අපගේ AI ට ඔබේ සුරතලා පිළිබඳ වඩා නිවැරදි සෞඛ්‍ය ඇගයීමක් ලබා දීමට උදවු කරයි." : language === "ta" ? "நடத்தை மாற்றங்களை அறிக்கை செய்வது, எங்கள் AI உங்கள் செல்லப்பிராணிக்கு மேலும் துல்லியமான சுகாதார மதிப்பீட்டை வழங்க உதவுகிறது." : "Reporting behavior changes helps our AI provide a more accurate health assessment for your pet."}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{language === "si" ? "රෝග ලක්ෂණ ඇතුළත් කිරීමේ මාදිලිය" : language === "ta" ? "அறிகுறி உள்ளீட்டு முறை" : "Symptom input mode"}</p>
            <p className="text-sm text-accent-subtle">{language === "si" ? "වඩා හොඳ වාර්තාවක් සකස් කිරීමට AI මඟපෙන්වීම භාවිතා කරන්න." : language === "ta" ? "சிறந்த அறிக்கை உருவாக்க AI வழிகாட்டுதலைப் பயன்படுத்தவும்." : "Use AI guidance to build a better case report."}</p>
          </div>
          <button onClick={() => setAiGuided((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${aiGuided ? "bg-primary text-white" : "bg-surface-tertiary text-accent dark:bg-neutral-800 dark:text-neutral-200"}`}>
            {aiGuided ? (language === "si" ? "AI මඟපෙන්වීම" : language === "ta" ? "AI வழிகாட்டுதல்" : "AI Guided") : (language === "si" ? "අතින්" : language === "ta" ? "கைமுறை" : "Manual")}
          </button>
        </div>
      </section>

      <section className={cardClassP5}>
        <h3 className="text-lg font-semibold text-accent">{language === "si" ? "ජීවමාන ලක්ෂණ" : language === "ta" ? "முக்கியக் குறிகள்" : "Vital Signs"}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-sm">{language === "si" ? "ක්‍රියාකාරී මට්ටම" : language === "ta" ? "செயல்பாட்டு அளவு" : "Activity level"}</Label>
            <select className={`mt-1 ${selectClass}`} value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as SeverityKey)}>
              {generalLevelOptions.map((v) => <option key={v} value={v}>{getSeverityLabel(v)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "ආහාර රුචිය" : language === "ta" ? "பசி" : "Appetite"}</Label>
            <select className={`mt-1 ${selectClass}`} value={appetiteLevel} onChange={(e) => setAppetiteLevel(e.target.value as SeverityKey)}>
              {generalLevelOptions.map((v) => <option key={v} value={v}>{getSeverityLabel(v)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "මුත්‍රා කිරීම" : language === "ta" ? "சிறுநீர்" : "Urination"}</Label>
            <select className={`mt-1 ${selectClass}`} value={urinationLevel} onChange={(e) => setUrinationLevel(e.target.value as SeverityKey)}>
              {generalLevelOptions.map((v) => <option key={v} value={v}>{getSeverityLabel(v)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "පාචනය" : language === "ta" ? "வயிற்றுப்போக்கு" : "Diarrhea"}</Label>
            <select className={`mt-1 ${selectClass}`} value={diarrheaLevel} onChange={(e) => setDiarrheaLevel(e.target.value as SeverityKey)}>
              {bowelLevelOptions.map((v) => <option key={v} value={v}>{getSeverityLabel(v)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-sm">{language === "si" ? "වමනය" : language === "ta" ? "வாந்தி" : "Vomiting"}</Label>
            <select className={`mt-1 ${selectClass}`} value={vomitingLevel} onChange={(e) => setVomitingLevel(e.target.value as SeverityKey)}>
              {bowelLevelOptions.map((v) => <option key={v} value={v}>{getSeverityLabel(v)}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className={cardClassP5}>
        <h3 className="text-lg font-semibold text-accent">{language === "si" ? "පොදු රෝග ලක්ෂණ" : language === "ta" ? "பொதுவான அறிகுறிகள்" : "Common Symptoms"}</h3>
        <p className="mt-1 text-sm text-accent-subtle">{language === "si" ? "දැනට පෙනෙන සියලු රෝග ලක්ෂණ තෝරන්න." : language === "ta" ? "தற்போது காணப்படும் அனைத்து அறிகுறிகளையும் தேர்ந்தெடுக்கவும்." : "Select all symptoms currently observed."}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {symptomOptions.map((option) => (
            <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${symptoms.includes(option.id) ? "border-primary bg-info-light text-primary dark:border-primary dark:bg-primary/20 dark:text-white" : "border-border bg-surface text-accent dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"}`}>
              <input type="checkbox" checked={symptoms.includes(option.id)} onChange={() => toggleSymptom(option.id)} className="h-4 w-4" />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={cardClassP5}>
        <h3 className="text-lg font-semibold text-accent">{language === "si" ? "සාක්ෂි සහ සටහන්" : language === "ta" ? "ஆதாரம் & குறிப்புகள்" : "Evidence & Notes"}</h3>
        <div className="mt-3 rounded-2xl border border-dashed border-border p-4 dark:border-neutral-700">
          <Label className="text-sm">{language === "si" ? "රූපයක් උඩුගත කරන්න (විකල්ප)" : language === "ta" ? "படத்தைப் பதிவேற்றவும் (விருப்பம்)" : "Upload image (optional)"}</Label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-accent dark:border-neutral-700 dark:bg-neutral-950">
            <Upload className="h-4 w-4" />
            <span>{language === "si" ? "රෝග ලක්ෂණ රූපයක් තෝරන්න" : language === "ta" ? "அறிகுறி படத்தைத் தேர்ந்தெடுக்கவும்" : "Choose a symptom image"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0] ?? null)} />
          </label>
          {imageDataUrl && <img src={imageDataUrl} alt="Symptom upload" className="mt-3 h-40 w-full rounded-xl object-cover" />}
        </div>

        <Label className="mt-4 block text-sm">{language === "si" ? "අමතර විස්තර" : language === "ta" ? "கூடுதல் விவரங்கள்" : "Additional Details"}</Label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-2 h-28 ${textAreaClass}`} placeholder={language === "si" ? "කාලය, හැසිරීම් වෙනස්කම් සහ හේතු පිළිබඳ අමතර විස්තර එක් කරන්න" : language === "ta" ? "காலநிலை, நடத்தை மாற்றங்கள், மற்றும் தூண்டுதல்கள் பற்றிய கூடுதல் விவரங்களைச் சேர்க்கவும்" : "Add any extra details about duration, behavior changes, and triggers"} />
        {aiGuided && (
          <Button variant="secondary" className="mt-3" onClick={assistWithAI}><Stethoscope className="h-4 w-4" />{language === "si" ? "සටහන් වැඩිදියුණු කිරීමට AI සහායකය භාවිත කරන්න" : language === "ta" ? "குறிப்புகளை மேம்படுத்த AI உதவியாளரைப் பயன்படுத்தவும்" : "Use AI assistant to enrich notes"}</Button>
        )}
      </section>

      <div className="space-y-3 pb-4">
        {formError ? (
          <div className="rounded-xl border border-warning-fg/30 bg-warning-light px-3 py-2 text-sm text-warning-fg">{formError}</div>
        ) : null}
        <Button size="xl" className="w-full" onClick={analyze}>{language === "si" ? "රෝග ලක්ෂණ විශ්ලේෂණය කරන්න" : language === "ta" ? "அறிகுறிகளை பகுப்பாய்வு செய்யவும்" : "Analyze Symptoms"}</Button>
      </div>
    </PageShell>
  );
}

export function PredictionResultPage() {
  const { petId } = useParams();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const data = safeRead<{
    petId: string;
    symptoms: string[];
    notes: string;
    imageDataUrl?: string;
    vitals?: {
      activityLevel: string;
      appetiteLevel: string;
      urinationLevel: string;
      diarrheaLevel: string;
      vomitingLevel: string;
    };
  } | null>(LAST_SYMPTOM_KEY, null);
  const pets = safeRead<Pet[]>(PETS_KEY, fallbackPets);
  const pet = pets.find((p) => p.id === petId) ?? pets[0];
  const symptomCount = data?.symptoms?.length ?? 0;
  const severityScore = {
    none: 0,
    normal: 0,
    mild: 6,
    moderate: 12,
    severe: 18,
  } as const;

  function normalizeSeverity(value?: string): keyof typeof severityScore {
    const normalized = (value ?? "").trim().toLowerCase();
    if (["none", "නැත", "இல்லை"].includes(normalized)) return "none";
    if (["normal", "සාමාන්‍ය", "இயல்பு"].includes(normalized)) return "normal";
    if (["mild", "සුළු", "இலகு"].includes(normalized)) return "mild";
    if (["moderate", "මධ්‍යම", "மிதம்"].includes(normalized)) return "moderate";
    if (["severe", "දැඩි", "கடுமை"].includes(normalized)) return "severe";
    return "normal";
  }

  function getSymptomLabel(symptom: string) {
    const symptomKey = symptom.trim().toLowerCase();
    const map: Record<string, { en: string; si: string; ta: string }> = {
      lethargy: { en: "Lethargy", si: "අලසභාවය", ta: "சோர்வு" },
      coughing: { en: "Coughing", si: "කැස්ස", ta: "இருமல்" },
      fever: { en: "Fever", si: "ජ්වරය", ta: "காய்ச்சல்" },
      "reduced-activity": { en: "Reduced activity", si: "ක්‍රියාකාරීත්වය අඩුවීම", ta: "செயல்பாடு குறைவு" },
      "stiff-gait": { en: "Stiff gait", si: "ඇවිදීමේ අපහසුතාව", ta: "நடையின் தடை" },
      "loss-of-appetite": { en: "Loss of appetite", si: "ආහාර රුචිය අඩුවීම", ta: "பசியின்மை" },
      "skin-irritation": { en: "Skin irritation", si: "සමේ කැසීම", ta: "தோல் எரிச்சல்" },
      "breathing-difficulty": { en: "Breathing difficulty", si: "හුස්ම ගැනීමේ අපහසුතාව", ta: "மூச்சுத்திணறல்" },
    };

    const resolved = map[symptomKey];
    if (!resolved) return symptom;
    if (language === "si") return resolved.si;
    if (language === "ta") return resolved.ta;
    return resolved.en;
  }

  const localizedSymptoms = (data?.symptoms ?? []).map((symptom) => getSymptomLabel(symptom));
  const vitalsScore =
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.activityLevel)] : 0) +
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.appetiteLevel)] : 0) +
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.urinationLevel)] : 0) +
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.diarrheaLevel)] : 0) +
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.vomitingLevel)] : 0);
  const riskScore = Math.min(98, 30 + symptomCount * 9 + vitalsScore);
  const riskLevel = riskScore >= 75 ? "HIGH RISK" : riskScore >= 50 ? "MODERATE RISK" : "LOW RISK";
  const confidence = riskLevel === "HIGH RISK" ? 88 : riskLevel === "MODERATE RISK" ? 74 : 62;
  const finding = riskLevel === "HIGH RISK"
    ? (language === "si" ? "උග්‍ර ජීරණ අවදානම" : language === "ta" ? "தீவிர செரிமான அபாயம்" : "Acute Digestive Risk")
    : riskLevel === "MODERATE RISK"
      ? (language === "si" ? "ආසාත්මික රෝග ලක්ෂණ රටාව" : language === "ta" ? "அழற்சி அறிகுறி வடிவம்" : "Inflammatory Symptom Pattern")
      : (language === "si" ? "සුළු හැසිරීම් වෙනස්වීම" : language === "ta" ? "இலகு நடத்தை மாற்றம்" : "Mild Behavioral Variation");
  const remedies = riskLevel === "HIGH RISK"
    ? ["Prioritize hydration in small frequent amounts.", "Avoid introducing new food until vet review.", "Monitor stool and vomiting frequency every 4 hours."]
    : riskLevel === "MODERATE RISK"
      ? ["Offer bland food in small portions.", "Maintain rest and reduce physical strain.", "Track appetite and activity changes for 24 hours."]
      : ["Maintain normal hydration and balanced meals.", "Observe symptoms for 24-48 hours.", "Keep pet in a low-stress environment and monitor behavior."];
  const vetAdvice = riskLevel === "HIGH RISK"
    ? (language === "si" ? "වහාම වෙට් උපදේශනයක් නිර්දේශ කරයි." : language === "ta" ? "உடனடி வெட் ஆலோசனை பரிந்துரைக்கப்படுகிறது." : "Immediate veterinary consultation recommended.")
    : riskLevel === "MODERATE RISK"
      ? (language === "si" ? "රෝග ලක්ෂණ දිගටම පවතින්නේ නම් පැය 24ක් ඇතුළත වෙට් පරීක්ෂාවක් වෙන් කරන්න." : language === "ta" ? "அறிகுறிகள் தொடர்ந்தால் 24 மணிநேரத்திற்குள் வெட் பரிசோதனை செய்யவும்." : "Schedule a veterinary check within 24 hours if symptoms persist.")
      : (language === "si" ? "නිවසේ නිරීක්ෂණය ප්‍රමාණවත්ය. රෝග ලක්ෂණ වැඩි වුවහොත් වෙට්වරයෙකු වෙත යන්න." : language === "ta" ? "வீட்டில் கண்காணிப்பு போதுமானது. அறிகுறிகள் மோசமானால் வெட்டை பார்க்கவும்." : "Home monitoring is acceptable. Visit a vet if symptoms worsen.");

  const reportText = `${language === "si" ? "සුරතලා" : language === "ta" ? "செல்லப்பிராணி" : "Pet"}: ${pet.name}\n${language === "si" ? "රෝග රටාව" : language === "ta" ? "நோய் முறை" : "Disease Pattern"}: ${finding}\n${language === "si" ? "අවදානම" : language === "ta" ? "அபாயம்" : "Risk"}: ${riskLevel}\n${language === "si" ? "අවදානම් ලකුණු" : language === "ta" ? "அபாய மதிப்பு" : "Risk Score"}: ${riskScore}/100\n${language === "si" ? "විශ්වාසය" : language === "ta" ? "நம்பகத்தன்மை" : "Confidence"}: ${confidence}%\n${language === "si" ? "රෝග ලක්ෂණ" : language === "ta" ? "அறிகுறிகள்" : "Symptoms"}: ${localizedSymptoms.join(", ")}\n${language === "si" ? "වෙට් උපදෙස්" : language === "ta" ? "வெட் ஆலோசனை" : "Vet Advice"}: ${vetAdvice}\n${language === "si" ? "සටහන්" : language === "ta" ? "குறிப்புகள்" : "Notes"}: ${data?.notes ?? "N/A"}`;

  async function shareReport() {
    if (navigator.share) {
      await navigator.share({ title: `${pet.name} Prediction Report`, text: reportText });
      return;
    }
    await navigator.clipboard.writeText(reportText);
  }

  function saveReport() {
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pet.name.toLowerCase()}-prediction-report.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell title={language === "si" ? "පුරෝකථන ප්‍රතිඵලය" : language === "ta" ? "கணிப்பு முடிவு" : "Prediction Result"} rightAction={<button onClick={shareReport}><Share2 className="h-5 w-5 text-accent" /></button>}>
      <section className={`${cardClassP6} text-center`}>
        <img src={pet.photoDataUrl || petBuddyImage} alt={pet.name} className="mx-auto h-28 w-28 rounded-full border-4 border-surface object-cover" />
        <h2 className="mt-4 text-2xl font-semibold text-accent">{finding}</h2>
        <Badge variant={riskLevel === "HIGH RISK" ? "danger" : riskLevel === "MODERATE RISK" ? "warning" : "success"} className="mt-3">{riskLevel}</Badge>
        <p className="mt-2 text-sm text-accent-subtle">{language === "si" ? "රෝග ලකුණු:" : language === "ta" ? "நோய் மதிப்பு:" : "Disease Score:"} <span className="font-semibold text-accent">{riskScore}/100</span></p>
        <p className="mt-1 text-sm text-accent-subtle">{confidence}% {language === "si" ? "විශ්වාස ලකුණු" : language === "ta" ? "நம்பகத்தன்மை மதிப்பெண்" : "Confidence Score"}</p>
      </section>

      <section className={cardClassP5}>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{language === "si" ? "විශ්ලේෂණය කළ රෝග ලක්ෂණ" : language === "ta" ? "பகுப்பாய்வு செய்யப்பட்ட அறிகுறிகள்" : "Analyzed Symptoms"}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(localizedSymptoms.length ? localizedSymptoms : [language === "si" ? "ඇවිදීමේ අපහසුතාව" : language === "ta" ? "நடையின் தடை" : "Stiff gait", language === "si" ? "ක්‍රියාකාරීත්වය අඩුවීම" : language === "ta" ? "செயல்பாடு குறைவு" : "Reduced activity", language === "si" ? "පඩිපෙළ නැගීමේ අපහසුතාව" : language === "ta" ? "படிக்கட்டில் ஏறுவதில் சிரமம்" : "Climbing difficulty"]).map((symptom) => (
            <span key={symptom} className="rounded-full border border-border px-3 py-1 text-sm text-accent dark:border-neutral-700 dark:bg-neutral-950">{symptom}</span>
          ))}
        </div>
      </section>

      <section className={cardClassP5}>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{language === "si" ? "රැකවරණ නිර්දේශ" : language === "ta" ? "பராமரிப்பு பரிந்துரைகள்" : "Care Recommendations"}</h3>
        <ul className="mt-3 space-y-2 text-sm text-accent-subtle">
          {remedies.map((remedy) => (
            <li key={remedy} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>{remedy}</span>
            </li>
          ))}
        </ul>
        <div className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${riskLevel === "HIGH RISK" ? "border-danger-fg/30 bg-danger-light text-danger-fg" : riskLevel === "MODERATE RISK" ? "border-warning-fg/30 bg-warning-light text-warning-fg" : "border-success-fg/30 bg-success-light text-success-fg"}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{vetAdvice}</span>
        </div>
      </section>

      {data?.imageDataUrl ? (
        <section className={cardClassP5}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{language === "si" ? "උඩුගත කළ රෝග ලක්ෂණ රූපය" : language === "ta" ? "பதிவேற்றப்பட்ட அறிகுறி படம்" : "Uploaded Symptom Image"}</h3>
          <img src={data.imageDataUrl} alt="Uploaded symptom" className="mt-3 h-48 w-full rounded-xl object-cover" />
        </section>
      ) : null}

      <div className="space-y-3 pb-4">
        <Button size="xl" className="w-full" onClick={() => navigate("/pets?tab=clinics")}>{riskLevel === "HIGH RISK" ? (language === "si" ? "හදිසි පරීක්ෂාව සඳහා ක්ලිනික් බලන්න" : language === "ta" ? "அவசர வருகைக்கான கிளினிக்குகளைப் பார்க்கவும்" : "View Clinics For Urgent Visit") : (language === "si" ? "ක්ලිනික් බලන්න" : language === "ta" ? "கிளினிக்குகளைப் பார்வையிடவும்" : "Browse Clinics")}</Button>
        <Button size="xl" variant="secondary" className="w-full" onClick={shareReport}><Share2 className="h-4 w-4" />{language === "si" ? "වාර්තාව බෙදාගන්න" : language === "ta" ? "அறிக்கையைப் பகிரவும்" : "Share Report"}</Button>
        <Button size="xl" variant="secondary" className="w-full" onClick={saveReport}><Calendar className="h-4 w-4" />{language === "si" ? "විස්තරාත්මක වාර්තාව සුරකින්න" : language === "ta" ? "விவரமான அறிக்கையை சேமிக்கவும்" : "Save Detailed Report"}</Button>
      </div>
    </PageShell>
  );
}
