import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Calendar, Camera, Check, MapPin, Phone, Share2, Star, Stethoscope, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLanguageStore } from "../lib/language";
import { getOwnerId, listOwnerPets, type BackendPet } from "../lib/pet-api";
import { createAppointment, listClinics } from "../lib/clinic-api";
import { submitPrediction, getPrediction, submitPredictionFeedback, type PredictionResult } from "../lib/prediction-api";
import { analyzeCase, getRecommendations, type AgentResponse } from "../lib/agent-api";
import { createVaccination, listVaccinations, type VaccinationRecord } from "../lib/vaccination-api";
import { toast } from "../lib/use-toast";
import { Disclaimer } from "../components/Disclaimer";
import petBuddyImage from "../assets/images/pet-buddy.jpg";
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
  slotRecords?: Array<{ id: string; label: string }>;
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

function formatSlotLabel(datetime: string) {
  const value = new Date(datetime);
  if (Number.isNaN(value.getTime())) {
    return datetime;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function mapClinicDirectory(clinics: Awaited<ReturnType<typeof listClinics>>): Clinic[] {
  const images = [authVetConsultImage, onboardingVaccineImage, petBuddyImage];

  return clinics.map((clinic, index) => ({
    id: clinic.id,
    name: clinic.name,
    address: clinic.address,
    phone: clinic.phone,
    image: images[index % images.length],
    rating: clinic.rating,
    reviews: clinic.reviewCount,
    surgeons: clinic.surgeons.map((surgeon) => ({
      id: surgeon.id,
      name: surgeon.name,
      specialization: surgeon.specialization,
      avatar: surgeon.photoURL || images[index % images.length],
      slots: surgeon.availableSlots.filter((slot) => !slot.isBooked).map((slot) => formatSlotLabel(slot.datetime)),
      slotRecords: surgeon.availableSlots.filter((slot) => !slot.isBooked).map((slot) => ({ id: slot.id, label: formatSlotLabel(slot.datetime) })),
    })),
  }));
}

function useClinicDirectory() {
  const [directory, setDirectory] = useState<Clinic[]>([]);

  useEffect(() => {
    let active = true;

    listClinics()
      .then((items) => {
        if (!active || items.length === 0) {
          return;
        }

        setDirectory(mapClinicDirectory(items));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return directory;
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function removeLegacySeedPets(pets: Pet[]): Pet[] {
  return pets.filter(
    (pet) =>
      !(
        (pet.id === "pet-1" && pet.name === "Buddy") ||
        (pet.id === "pet-2" && pet.name === "Luna")
      )
  );
}

function readPets(): Pet[] {
  return removeLegacySeedPets(safeRead<Pet[]>(PETS_KEY, []));
}

function toPetRecord(pet: BackendPet): Pet {
  const normalizedId = pet.id || pet._id;
  if (!normalizedId) {
    throw new Error("Pet id is missing from backend response");
  }

  return {
    id: normalizedId,
    name: pet.name,
    species: pet.species === "cat" ? "Cat" : "Dog",
    breed: pet.breed,
    age: String(pet.ageYears),
    weightKg: String(pet.weightKg),
    photoDataUrl: pet.photoURL,
    vaccinationName: pet.vaccinationName,
    vaccinationDate: pet.vaccinationDate,
    vaccinationFrequency: pet.vaccinationFrequency,
    nextVaccinationDate: pet.nextVaccinationDate,
  };
}

function useFlowPets() {
  const [pets, setPets] = useState<Pet[]>(() => readPets());

  useEffect(() => {
    let active = true;
    const localPets = readPets();
    if (localPets.length > 0) {
      setPets(localPets);
    }

    listOwnerPets(getOwnerId())
      .then((items) => {
        if (!active || items.length === 0) return;
        const mapped = removeLegacySeedPets(items.map(toPetRecord));
        setPets(mapped);
        localStorage.setItem(PETS_KEY, JSON.stringify(mapped));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return pets;
}

function EmptyPetState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const navigate = useNavigate();

  return (
    <PageShell title={title}>
      <section className={`${cardClassP6} text-center`}>
        <h2 className="text-2xl font-semibold text-accent">No pets yet</h2>
        <p className="mt-2 text-sm text-accent-subtle">{message}</p>
        <Button size="xl" className="mt-5" onClick={() => navigate("/pets/create")}>
          Add Pet
        </Button>
      </section>
    </PageShell>
  );
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
  const pets = useFlowPets();
  const resolvedPetId = petIdOverride ?? petId;
  const pet = pets.find((p) => p.id === resolvedPetId) ?? pets[0];

  const [vaccineRecords, setVaccineRecords] = useState<VaccinationRecord[]>([]);
  const [showAddVaccine, setShowAddVaccine] = useState(false);
  const [newVaccine, setNewVaccine] = useState({ vaccineName: "", administeredAt: "", nextDueAt: "" });
  const [savingVaccine, setSavingVaccine] = useState(false);

  const currentPetId = pet?.id ?? "";
  useEffect(() => {
    if (!currentPetId) return;
    let active = true;
    listVaccinations(currentPetId)
      .then((records) => { if (active) setVaccineRecords(records); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [currentPetId]);

  if (!pet) {
    return (
      <EmptyPetState
        title="Pet Profile"
        message={language === "si" ? "සුරතල් පැතිකඩක් බැලීමට පෙර සුරතලෙකු එක් කරන්න." : language === "ta" ? "செல்லப்பிராணி சுயவிவரத்தைப் பார்க்க முன்னர் ஒரு செல்லப்பிராணியைச் சேர்க்கவும்." : "Add a pet before viewing profile details."}
      />
    );
  }

  async function saveVaccineRecord() {
    if (!newVaccine.vaccineName || !newVaccine.administeredAt || !newVaccine.nextDueAt) {
      toast({ title: language === "si" ? "සියලු ක්ෂේත්‍ර පුරවන්න" : language === "ta" ? "அனைத்து புலங்களையும் நிரப்பவும்" : "Fill all fields", variant: "error" });
      return;
    }
    setSavingVaccine(true);
    try {
      const created = await createVaccination({
        petId: pet.id,
        vaccineName: newVaccine.vaccineName,
        administeredAt: new Date(newVaccine.administeredAt).toISOString(),
        nextDueAt: new Date(newVaccine.nextDueAt).toISOString(),
      });
      setVaccineRecords((prev) => [created, ...prev]);
      setNewVaccine({ vaccineName: "", administeredAt: "", nextDueAt: "" });
      setShowAddVaccine(false);
      toast({ title: language === "si" ? "එන්නත් වාර්තාව සුරකින ලදී" : language === "ta" ? "தடுப்பூசி பதிவு சேமிக்கப்பட்டது" : "Vaccination record saved", variant: "success" });
    } catch {
      toast({ title: language === "si" ? "සුරැකීම අසාර්ථකයි" : language === "ta" ? "சேமிக்க முடியவில்லை" : "Could not save record", variant: "error" });
    } finally {
      setSavingVaccine(false);
    }
  }

  const vaccineHistory = vaccineRecords.length
    ? vaccineRecords.map((record) => ({
        id: record.id,
        name: record.vaccineName,
        date: new Date(record.administeredAt).toLocaleDateString(),
        freq: `${language === "si" ? "ඊළඟ" : language === "ta" ? "அடுத்தது" : "Next"}: ${new Date(record.nextDueAt).toLocaleDateString()}`,
        status: new Date(record.nextDueAt).getTime() < Date.now() + 14 * 24 * 60 * 60 * 1000 ? ("due" as const) : ("active" as const),
      }))
    : pet.vaccinationName
      ? [{ id: "v1", name: pet.vaccinationName, date: pet.vaccinationDate || "Not provided", freq: pet.vaccinationFrequency || "Annual", status: pet.nextVaccinationDate ? "due" as const : "active" as const }]
      : [];

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
          <button className="text-sm font-semibold text-primary" onClick={() => setShowAddVaccine((v) => !v)}>
            {showAddVaccine ? (language === "si" ? "අවලංගු කරන්න" : language === "ta" ? "ரத்து" : "Cancel") : (language === "si" ? "+ වාර්තාවක් එක් කරන්න" : language === "ta" ? "+ பதிவு சேர்" : "+ Add Record")}
          </button>
        </div>

        {showAddVaccine && (
          <div className="mb-4 rounded-2xl border border-primary/30 bg-info-light p-4 dark:bg-primary/10">
            <Label className="text-sm">{language === "si" ? "එන්නතේ නම" : language === "ta" ? "தடுப்பூசி பெயர்" : "Vaccine name"}</Label>
            <input className={`mt-1 ${selectClass}`} value={newVaccine.vaccineName} onChange={(e) => setNewVaccine((v) => ({ ...v, vaccineName: e.target.value }))} placeholder="e.g. Rabies Vaccine" list="vaccine-name-options" />
            <datalist id="vaccine-name-options">
              {["Rabies Vaccine", "DHPP Vaccine", "Leptospirosis Vaccine", "Bordetella Vaccine", "FVRCP Vaccine", "FeLV Vaccine", "Deworming Treatment", "Flea & Tick Prevention"].map((name) => <option key={name} value={name} />)}
            </datalist>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-sm">{language === "si" ? "ලබා දුන් දිනය" : language === "ta" ? "வழங்கிய தேதி" : "Date administered"}</Label>
                <input type="date" className={`mt-1 ${selectClass}`} value={newVaccine.administeredAt} onChange={(e) => setNewVaccine((v) => ({ ...v, administeredAt: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm">{language === "si" ? "ඊළඟ නියමිත දිනය" : language === "ta" ? "அடுத்த தேதி" : "Next due date"}</Label>
                <input type="date" className={`mt-1 ${selectClass}`} value={newVaccine.nextDueAt} onChange={(e) => setNewVaccine((v) => ({ ...v, nextDueAt: e.target.value }))} />
              </div>
            </div>
            <Button className="mt-3 w-full" onClick={saveVaccineRecord} disabled={savingVaccine}>
              {savingVaccine ? (language === "si" ? "සුරකිමින්..." : language === "ta" ? "சேமிக்கிறது..." : "Saving...") : (language === "si" ? "වාර්තාව සුරකින්න" : language === "ta" ? "பதிவைச் சேமி" : "Save Record")}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {vaccineHistory.length === 0 && !showAddVaccine && (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-accent-subtle dark:border-neutral-700">
              {language === "si" ? "එන්නත් වාර්තා නොමැත. පළමු වාර්තාව එක් කරන්න." : language === "ta" ? "தடுப்பூசி பதிவுகள் இல்லை. முதல் பதிவைச் சேர்க்கவும்." : "No vaccination records yet. Add the first record to enable smart reminders."}
            </p>
          )}
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
  const pets = useFlowPets();
  const clinics = useClinicDirectory();
  const resolvedClinicId = clinicIdOverride ?? clinicId;
  const clinic = clinics.find((c) => c.id === resolvedClinicId) ?? clinics[0];
  const [selectedSurgeonId, setSelectedSurgeonId] = useState(clinic.surgeons[0]?.id ?? "");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id ?? "");
  const [clinicRating, setClinicRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [bookingError, setBookingError] = useState("");
  const selectedSurgeon = clinic.surgeons.find((s) => s.id === selectedSurgeonId) ?? clinic.surgeons[0];

  if (!pets.length) {
    return (
      <EmptyPetState
        title={language === "si" ? "ක්ලිනික් විස්තර" : language === "ta" ? "கிளினிக் விவரம்" : "Clinic Details"}
        message={language === "si" ? "හමුවීම් වෙන් කිරීමට පෙර සුරතලෙකු එක් කරන්න." : language === "ta" ? "நியமனம் பதிவு செய்வதற்கு முன் ஒரு செல்லப்பிராணியைச் சேர்க்கவும்." : "Add a pet before booking clinic appointments."}
      />
    );
  }

  function confirmBooking() {
    if (!selectedSlot || !selectedSurgeon) return;
    const selectedPet = pets.find((p) => p.id === selectedPetId) ?? pets[0];
    const selectedSlotRecord = selectedSurgeon.slotRecords?.find((slot) => slot.label === selectedSlot);
    if (!selectedSlotRecord) return;

    const summary: BookingSummary = {
      petId: selectedPet.id,
      petName: selectedPet.name,
      clinicId: clinic.id,
      clinicName: clinic.name,
      surgeonName: selectedSurgeon.name,
      slot: selectedSlot,
    };

    setBookingError("");
    createAppointment({
      ownerId: getOwnerId(),
      petId: selectedPet.id,
      clinicId: clinic.id,
      surgeonId: selectedSurgeon.id,
      slotId: selectedSlotRecord.id,
      status: "pending",
      notes: "",
    })
      .then(() => {
        localStorage.setItem(LAST_BOOKING_KEY, JSON.stringify(summary));
        navigate("/pets/booking-confirmed");
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to create booking";
        setBookingError(message);
      });
  }

  const content = (
    <>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <img src={clinic.image} alt={clinic.name} className="h-52 w-full object-cover sm:h-60" />
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2"><Badge variant="info">{language === "si" ? "ඉහළම ශ්‍රේණිගත" : language === "ta" ? "சிறந்த மதிப்பீடு" : "Top Rated"}</Badge><h2 className="text-[15px] font-semibold text-accent">{clinic.name}</h2></div>
          <div>
            <p className="flex items-center gap-2 text-sm text-accent-subtle"><MapPin className="h-4 w-4" />{clinic.address}</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-accent"><Phone className="h-4 w-4" />{clinic.phone}</p>
          <div className="rounded-2xl border border-border bg-surface-tertiary p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-semibold text-accent">{clinic.rating}</p>
              <div className="text-right">
                <p className="text-[13px] font-semibold text-accent">{clinic.reviews} {language === "si" ? "සමාලෝචන" : language === "ta" ? "மதிப்புரைகள்" : "Reviews"}</p>
              </div>
            </div>
            <div className="mt-1 flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-4 w-4 ${n <= Math.round(clinic.rating) ? "fill-warning-fg text-warning-fg" : "text-border-strong"}`} />
              ))}
            </div>
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

        <Button size="xl" className="mt-4 w-full" onClick={confirmBooking} disabled={!selectedSlot}>{language === "si" ? "හමුවීම් වෙන් කරන්න" : language === "ta" ? "நேரம் பதிவு செய்யவும்" : "Book Appointment"}</Button>
        {bookingError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{bookingError}</p> : null}
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
          <p><span className="text-accent-subtle">{language === "si" ? "සුරතලා:" : language === "ta" ? "செல்லப்பிராணி:" : "Pet:"}</span> {booking?.petName ?? "—"}</p>
          <p><span className="text-accent-subtle">{language === "si" ? "ක්ලිනික්:" : language === "ta" ? "கிளினிக்:" : "Clinic:"}</span> {booking?.clinicName ?? "—"}</p>
          <p><span className="text-accent-subtle">{language === "si" ? "ශල්‍ය වෛද්‍යවරයා:" : language === "ta" ? "அறுவை மருத்துவர்:" : "Surgeon:"}</span> {booking?.surgeonName ?? "—"}</p>
          <p><span className="text-accent-subtle">{language === "si" ? "වේලාව:" : language === "ta" ? "நேரம்:" : "Time:"}</span> {booking?.slot ?? "—"}</p>
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
  const clinics = useClinicDirectory();
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
  const pets = useFlowPets();
  const pet = pets.find((p) => p.id === petId) ?? pets[0];

  if (!pet) {
    return (
      <EmptyPetState
        title={language === "si" ? "රෝග ලක්ෂණ වාර්තාව" : language === "ta" ? "அறிகுறி அறிக்கை" : "Symptom Report"}
        message={language === "si" ? "රෝග ලක්ෂණ වාර්තා කිරීමට පෙර සුරතලෙකු එක් කරන්න." : language === "ta" ? "அறிகுறிகளை அறிக்கையிட முன்னர் ஒரு செல்லப்பிராணியைச் சேர்க்கவும்." : "Add a pet before submitting symptom reports."}
      />
    );
  }

  const [activityLevel, setActivityLevel] = useState("normal");
  const [appetiteLevel, setAppetiteLevel] = useState("normal");
  const [waterIntake, setWaterIntake] = useState("normal");
  const [urinationLevel, setUrinationLevel] = useState("normal");
  const [diarrheaLevel, setDiarrheaLevel] = useState("none");
  const [vomitingLevel, setVomitingLevel] = useState("none");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [aiGuided, setAiGuided] = useState(true);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [durationDays, setDurationDays] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);

  const symptomOptions: Array<{ id: string; label: string }> = [
    { id: "lethargy", label: language === "si" ? "අලසභාවය" : language === "ta" ? "சோர்வு" : "Lethargy" },
    { id: "coughing", label: language === "si" ? "කැස්ස" : language === "ta" ? "இருமல்" : "Coughing" },
    { id: "fever", label: language === "si" ? "ජ්වරය" : language === "ta" ? "காய்ச்சல்" : "Fever" },
    { id: "reduced-activity", label: language === "si" ? "ක්‍රියාකාරීත්වය අඩුවීම" : language === "ta" ? "செயல்பாடு குறைவு" : "Reduced activity" },
    { id: "stiff-gait", label: language === "si" ? "ඇවිදීමේ අපහසුතාව" : language === "ta" ? "நடையின் தடை" : "Stiff gait" },
    { id: "loss-of-appetite", label: language === "si" ? "ආහාර රුචිය අඩුවීම" : language === "ta" ? "பசியின்மை" : "Loss of appetite" },
    { id: "skin-irritation", label: language === "si" ? "සමේ කැසීම" : language === "ta" ? "தோல் எரிச்சல்" : "Skin irritation" },
    { id: "ear-scratching", label: language === "si" ? "කන් කැසීම" : language === "ta" ? "காது சொறிதல்" : "Ear scratching" },
    { id: "head-shaking", label: language === "si" ? "හිස සෙලවීම" : language === "ta" ? "தலை ஆட்டுதல்" : "Head shaking" },
    { id: "breathing-difficulty", label: language === "si" ? "හුස්ම ගැනීමේ අපහසුතාව" : language === "ta" ? "மூச்சுத்திணறல்" : "Breathing difficulty" },
    { id: "pale-gums", label: language === "si" ? "සුදුමැලි විදුරුමස්" : language === "ta" ? "வெளிறிய ஈறுகள்" : "Pale gums" },
    { id: "weight-loss", label: language === "si" ? "බර අඩුවීම" : language === "ta" ? "எடை இழப்பு" : "Weight loss" },
    { id: "swollen-abdomen", label: language === "si" ? "ඉදිමුණු උදරය" : language === "ta" ? "வீங்கிய வயிறு" : "Swollen abdomen" },
    { id: "lump-swelling", label: language === "si" ? "ගැටිත්තක් / ඉදිමීමක්" : language === "ta" ? "கட்டி / வீக்கம்" : "Lump or swelling" },
    { id: "yellow-gums", label: language === "si" ? "කහ පැහැති විදුරුමස්/ඇස්" : language === "ta" ? "மஞ்சள் ஈறுகள்/கண்கள்" : "Yellow gums or eyes" },
    { id: "fainting", label: language === "si" ? "සිහිසුන් වීම" : language === "ta" ? "மயக்கம்" : "Fainting / collapse" },
  ];

  // Clear, field-specific options (value = the enum the model understands).
  type VitalOption = { v: string; en: string; si: string; ta: string };
  const VITALS: Record<string, VitalOption[]> = {
    activity: [
      { v: "normal", en: "Normal", si: "සාමාන්‍ය", ta: "இயல்பு" },
      { v: "mild", en: "Slightly less active", si: "මඳක් අඩු ක්‍රියාකාරී", ta: "சற்று குறைவான செயல்பாடு" },
      { v: "lethargic", en: "Very low (lethargic)", si: "ඉතා අඩු (අලස)", ta: "மிகக் குறைவு (சோர்வு)" },
    ],
    appetite: [
      { v: "normal", en: "Eating normally", si: "සාමාන්‍යයෙන් අනුභව කරයි", ta: "இயல்பாக சாப்பிடுகிறது" },
      { v: "reduced", en: "Eating less", si: "අඩුවෙන් අනුභව කරයි", ta: "குறைவாக சாப்பிடுகிறது" },
      { v: "none", en: "Not eating", si: "අනුභව නොකරයි", ta: "சாப்பிடவில்லை" },
    ],
    water: [
      { v: "normal", en: "Drinking normally", si: "සාමාන්‍යයෙන් ජලය පානය", ta: "இயல்பாக தண்ணீர் குடிக்கிறது" },
      { v: "increased", en: "Drinking more than usual", si: "සුපුරුදුට වඩා වැඩියෙන්", ta: "வழக்கத்தை விட அதிகம்" },
      { v: "reduced", en: "Drinking less than usual", si: "සුපුරුදුට වඩා අඩුවෙන්", ta: "வழக்கத்தை விட குறைவு" },
    ],
    urine: [
      { v: "normal", en: "Normal", si: "සාමාන්‍ය", ta: "இயல்பு" },
      { v: "increased", en: "Urinating more than usual", si: "සුපුරුදුට වඩා වැඩියෙන් මුත්‍රා", ta: "வழக்கத்தை விட அதிக சிறுநீர்" },
      { v: "reduced", en: "Urinating less / straining", si: "අඩුවෙන් / අපහසුවෙන් මුත්‍රා", ta: "குறைவாக / சிரமத்துடன் சிறுநீர்" },
    ],
    vomiting: [
      { v: "none", en: "None", si: "නැත", ta: "இல்லை" },
      { v: "once", en: "Once", si: "වරක්", ta: "ஒருமுறை" },
      { v: "multiple", en: "Several times", si: "කිහිප වතාවක්", ta: "பலமுறை" },
      { v: "persistent", en: "Persistent (can't keep food down)", si: "නිරන්තරයෙන්", ta: "தொடர்ச்சியாக" },
    ],
    diarrhea: [
      { v: "none", en: "None", si: "නැත", ta: "இல்லை" },
      { v: "mild", en: "Mild", si: "සුළු", ta: "இலகு" },
      { v: "moderate", en: "Moderate", si: "මධ්‍යම", ta: "மிதம்" },
      { v: "severe", en: "Severe", si: "දැඩි", ta: "கடுமை" },
    ],
  };
  const optLabel = (o: VitalOption) => (language === "si" ? o.si : language === "ta" ? o.ta : o.en);

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
      if (typeof reader.result !== "string") return;
      // Downscale for the multimodal AI call (keeps the payload small)
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { setImageDataUrl(reader.result as string); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageDataUrl(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => setImageDataUrl(reader.result as string);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!symptoms.length) {
      setFormError(language === "si" ? "විශ්ලේෂණයට පෙර අවම වශයෙන් එක් පොදු රෝග ලක්ෂණයක් තෝරන්න." : language === "ta" ? "பகுப்பாய்வுக்கு முன் குறைந்தது ஒரு பொதுவான அறிகுறியைத் தேர்ந்தெடுக்கவும்." : "Please select at least one common symptom before analyzing.");
      return;
    }

    setFormError("");
    setAnalyzing(true);

    const vitals = { activityLevel, appetiteLevel, waterIntake, urinationLevel, diarrheaLevel, vomitingLevel };
    const submission = {
      petId: pet.id,
      vitals,
      symptoms,
      notes,
      imageDataUrl,
      durationDays,
    };

    const predictionInput = {
      petId: pet.id,
      species: pet.species,
      breed: pet.breed || undefined,
      ageYears: Number.parseFloat(pet.age) || undefined,
      weightKg: Number.parseFloat(pet.weightKg) || undefined,
      vitals,
      symptoms,
      notes,
      symptomDurationDays: durationDays,
    };

    // Owner location for the Vet Discovery & Booking Agent (non-blocking, 4s cap)
    const ownerLocation = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 4000, maximumAge: 300000 }
      );
    });

    let result: PredictionResult | null = null;
    let agent: AgentResponse | null = null;
    let offline = false;
    try {
      // Full three-agent pipeline in one call
      agent = await analyzeCase(predictionInput, ownerLocation, imageDataUrl || undefined);
      result = agent.prediction ?? null;
    } catch {
      // Agent pipeline unreachable — fall back to direct ML prediction
      try {
        result = await submitPrediction(predictionInput);
      } catch {
        offline = true;
        toast({
          title: language === "si" ? "AI සේවාව ළඟා විය නොහැක" : language === "ta" ? "AI சேவையை அணுக முடியவில்லை" : "AI service unreachable",
          description: language === "si" ? "දේශීය ඇස්තමේන්තුවක් පෙන්වයි." : language === "ta" ? "உள்ளூர் மதிப்பீடு காட்டப்படுகிறது." : "Showing an offline estimate instead.",
          variant: "error",
        });
      }
    }

    localStorage.setItem(LAST_SYMPTOM_KEY, JSON.stringify({ ...submission, result, agent, offline }));
    setAnalyzing(false);
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
            <select className={`mt-1 ${selectClass}`} value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
              {VITALS.activity.map((o) => <option key={o.v} value={o.v}>{optLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "ආහාර රුචිය" : language === "ta" ? "பசி" : "Appetite"}</Label>
            <select className={`mt-1 ${selectClass}`} value={appetiteLevel} onChange={(e) => setAppetiteLevel(e.target.value)}>
              {VITALS.appetite.map((o) => <option key={o.v} value={o.v}>{optLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "ජලය පානය" : language === "ta" ? "தண்ணீர் அருந்துதல்" : "Water intake"}</Label>
            <select className={`mt-1 ${selectClass}`} value={waterIntake} onChange={(e) => setWaterIntake(e.target.value)}>
              {VITALS.water.map((o) => <option key={o.v} value={o.v}>{optLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "මුත්‍රා කිරීම" : language === "ta" ? "சிறுநீர்" : "Urination"}</Label>
            <select className={`mt-1 ${selectClass}`} value={urinationLevel} onChange={(e) => setUrinationLevel(e.target.value)}>
              {VITALS.urine.map((o) => <option key={o.v} value={o.v}>{optLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "වමනය" : language === "ta" ? "வாந்தி" : "Vomiting"}</Label>
            <select className={`mt-1 ${selectClass}`} value={vomitingLevel} onChange={(e) => setVomitingLevel(e.target.value)}>
              {VITALS.vomiting.map((o) => <option key={o.v} value={o.v}>{optLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "පාචනය" : language === "ta" ? "வயிற்றுப்போக்கு" : "Diarrhea"}</Label>
            <select className={`mt-1 ${selectClass}`} value={diarrheaLevel} onChange={(e) => setDiarrheaLevel(e.target.value)}>
              {VITALS.diarrhea.map((o) => <option key={o.v} value={o.v}>{optLabel(o)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-sm">{language === "si" ? "රෝග ලක්ෂණ පැවති කාලය" : language === "ta" ? "அறிகுறிகள் நீடித்த காலம்" : "Symptom duration"}</Label>
            <select className={`mt-1 ${selectClass}`} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}>
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <option key={d} value={d}>
                  {d} {language === "si" ? (d === 1 ? "දිනයක්" : "දින") : language === "ta" ? (d === 1 ? "நாள்" : "நாட்கள்") : d === 1 ? "day" : "days"}
                </option>
              ))}
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
        <Button size="xl" className="w-full" onClick={analyze} disabled={analyzing}>
          {analyzing
            ? (language === "si" ? "විශ්ලේෂණය කරමින්..." : language === "ta" ? "பகுப்பாய்வு நடைபெறுகிறது..." : "Analyzing...")
            : (language === "si" ? "රෝග ලක්ෂණ විශ්ලේෂණය කරන්න" : language === "ta" ? "அறிகுறிகளை பகுப்பாய்வு செய்யவும்" : "Analyze Symptoms")}
        </Button>
      </div>
    </PageShell>
  );
}

type ResultData = {
  petId: string;
  symptoms: string[];
  notes: string;
  imageDataUrl?: string;
  durationDays?: number;
  result?: PredictionResult | null;
  agent?: AgentResponse | null;
  offline?: boolean;
  vitals?: {
    activityLevel: string;
    appetiteLevel: string;
    waterIntake: string;
    urinationLevel: string;
    diarrheaLevel: string;
    vomitingLevel: string;
  };
};

export function PredictionResultPage() {
  const { petId } = useParams();
  const [searchParams] = useSearchParams();
  const historyId = searchParams.get("prediction");
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const localData = safeRead<ResultData | null>(LAST_SYMPTOM_KEY, null);
  // When opened from a saved assessment (?prediction=<id>), load THAT specific
  // prediction instead of the last-submitted one cached in localStorage.
  const [historyData, setHistoryData] = useState<ResultData | null>(null);
  const data = historyData ?? localData;
  const pets = useFlowPets();
  const pet = pets.find((p) => p.id === petId) ?? pets[0];
  const result = data?.result ?? null;

  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  // Owner feedback on the prediction (closes the AI-vs-actual learning loop)
  const [fbRating, setFbRating] = useState<"helpful" | "not_helpful" | null>(null);
  const [fbMatched, setFbMatched] = useState<"yes" | "no" | "unsure">("unsure");
  const [fbComment, setFbComment] = useState("");
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbDone, setFbDone] = useState(false);

  async function handleSubmitFeedback() {
    const predictionId = result?.id;
    if (!predictionId || !fbRating) return;
    setFbSubmitting(true);
    try {
      await submitPredictionFeedback(predictionId, {
        rating: fbRating,
        matchedDiagnosis: fbMatched,
        comment: fbComment.trim(),
      });
      setFbDone(true);
      toast({ title: language === "si" ? "ඔබේ ප්‍රතිපෝෂණයට ස්තූතියි — එය ආකෘතිය වැඩිදියුණු කිරීමට උපකාරී වේ." : language === "ta" ? "உங்கள் கருத்துக்கு நன்றி — இது மாதிரியை மேம்படுத்த உதவுகிறது." : "Thanks for your feedback — it helps improve the model." });
    } catch {
      toast({ title: language === "si" ? "ප්‍රතිපෝෂණය සුරැකිය නොහැක. නැවත උත්සාහ කරන්න." : language === "ta" ? "கருத்தைச் சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." : "Could not save feedback. Please try again.", variant: "error" });
    } finally {
      setFbSubmitting(false);
    }
  }

  useEffect(() => {
    if (!historyId) return;
    let active = true;
    getPrediction(historyId)
      .then((doc) => {
        if (!active) return;
        setHistoryData({
          petId: doc.pet_id,
          symptoms: doc.payload?.symptoms ?? [],
          notes: doc.payload?.notes ?? "",
          vitals: {
            activityLevel: doc.payload?.activity_level ?? "normal",
            appetiteLevel: doc.payload?.appetite_level ?? "normal",
            waterIntake: (doc.payload as { water_intake?: string })?.water_intake ?? "normal",
            urinationLevel: doc.payload?.urine_frequency ?? "normal",
            diarrheaLevel: doc.payload?.diarrhea_level ?? "none",
            vomitingLevel: doc.payload?.vomiting_frequency ?? "none",
          },
          result: {
            id: doc.id,
            risk_level: doc.risk_level,
            confidence_score: doc.confidence_score,
            risk_score: doc.risk_score,
            predicted_diseases: doc.predicted_diseases ?? [],
            ontology_links: doc.ontology_links ?? [],
            top_features: doc.top_features ?? [],
            model_version: doc.model_version,
            disclaimer: doc.disclaimer ?? "",
          },
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [historyId]);

  useEffect(() => {
    if (!result) return;
    // /analyze already ran the full three-agent pipeline — use its output
    if (data?.agent) {
      setAgent(data.agent);
      return;
    }
    let active = true;
    setAgentLoading(true);

    const run = (location: { lat: number; lng: number } | null) => {
      getRecommendations({
        petId: data?.petId ?? "",
        riskLevel: result.risk_level,
        confidenceScore: result.confidence_score,
        predictedDiseases: result.predicted_diseases,
        symptoms: data?.symptoms ?? [],
        notes: data?.notes ?? "",
        predictionId: result.id ?? undefined,
        ownerLocation: location,
      })
        .then((response) => { if (active) setAgent(response); })
        .catch(() => undefined)
        .finally(() => { if (active) setAgentLoading(false); });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => run({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => run(null),
        { timeout: 4000, maximumAge: 300000 }
      );
    } else {
      run(null);
    }

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id]);

  if (!pet) {
    return (
      <EmptyPetState
        title={language === "si" ? "පුරෝකථන ප්‍රතිඵලය" : language === "ta" ? "கணிப்பு முடிவு" : "Prediction Result"}
        message={language === "si" ? "පුරෝකථන වාර්තා බැලීමට පෙර සුරතලෙකු එක් කරන්න." : language === "ta" ? "கணிப்பு அறிக்கைகளைப் பார்க்க முன்னர் ஒரு செல்லப்பிராணியைச் சேர்க்கவும்." : "Add a pet before viewing prediction reports."}
      />
    );
  }
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
    if (["mild", "once", "සුළු", "இலகு"].includes(normalized)) return "mild";
    if (["moderate", "reduced", "increased", "multiple", "lethargic", "මධ්‍යම", "மிதம்"].includes(normalized)) return "moderate";
    if (["severe", "persistent", "දැඩි", "கடுமை"].includes(normalized)) return "severe";
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
      "weight-loss": { en: "Weight loss", si: "බර අඩුවීම", ta: "எடை இழப்பு" },
      "swollen-abdomen": { en: "Swollen abdomen", si: "ඉදිමුණු උදරය", ta: "வீங்கிய வயிறு" },
      "lump-swelling": { en: "Lump or swelling", si: "ගැටිත්තක් / ඉදිමීමක්", ta: "கட்டி / வீக்கம்" },
      "yellow-gums": { en: "Yellow gums or eyes", si: "කහ පැහැති විදුරුමස්/ඇස්", ta: "மஞ்சள் ஈறுகள்/கண்கள்" },
      "fainting": { en: "Fainting / collapse", si: "සිහිසුන් වීම", ta: "மயக்கம்" },
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
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.waterIntake)] : 0) +
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.urinationLevel)] : 0) +
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.diarrheaLevel)] : 0) +
    (data?.vitals ? severityScore[normalizeSeverity(data.vitals.vomitingLevel)] : 0);

  // Prefer the real ML prediction; fall back to the legacy local heuristic when offline
  const localRiskScore = Math.min(98, 30 + symptomCount * 9 + vitalsScore);
  const riskScore = result ? Math.round(result.risk_score * 100) : localRiskScore;
  const riskLevel = result
    ? result.risk_level === "high" ? "HIGH RISK" : result.risk_level === "medium" ? "MODERATE RISK" : "LOW RISK"
    : localRiskScore >= 75 ? "HIGH RISK" : localRiskScore >= 50 ? "MODERATE RISK" : "LOW RISK";
  const riskWord = riskLevel === "HIGH RISK"
    ? (language === "si" ? "ඉහළ අවදානම" : language === "ta" ? "அதிக அபாயம்" : "High Risk")
    : riskLevel === "MODERATE RISK"
      ? (language === "si" ? "මධ්‍යම අවදානම" : language === "ta" ? "நடுத்தர அபாயம்" : "Moderate Risk")
      : (language === "si" ? "අඩු අවදානම" : language === "ta" ? "குறைந்த அபாயம்" : "Low Risk");
  const confidence = result
    ? Math.round(result.confidence_score * 100)
    : riskLevel === "HIGH RISK" ? 88 : riskLevel === "MODERATE RISK" ? 74 : 62;
  const topFeatures = result?.top_features ?? [];
  const maxFeatureWeight = Math.max(...topFeatures.map((f) => Math.abs(f.weight)), 0.0001);
  const topDisease = result?.predicted_diseases?.[0]?.disease_localized || result?.predicted_diseases?.[0]?.disease;
  const finding = topDisease
    ? topDisease
    : riskLevel === "HIGH RISK"
      ? (language === "si" ? "උග්‍ර ජීරණ අවදානම" : language === "ta" ? "தீவிர செரிமான அபாயம்" : "Acute Digestive Risk")
      : riskLevel === "MODERATE RISK"
        ? (language === "si" ? "ආසාත්මික රෝග ලක්ෂණ රටාව" : language === "ta" ? "அழற்சி அறிகுறி வடிவம்" : "Inflammatory Symptom Pattern")
        : (language === "si" ? "සුළු හැසිරීම් වෙනස්වීම" : language === "ta" ? "இலகு நடத்தை மாற்றம்" : "Mild Behavioral Variation");
  const remedies = riskLevel === "HIGH RISK"
    ? (language === "si"
        ? ["කුඩා ප්‍රමාණවලින් නිතර ජලය ලබා දීමට ප්‍රමුඛත්වය දෙන්න.", "වෙට් පරීක්ෂාව තෙක් නව ආහාර හඳුන්වා නොදෙන්න.", "සෑම පැය 4කට වරක් මළ සහ වමන වාර ගණන නිරීක්ෂණය කරන්න."]
        : language === "ta"
          ? ["சிறிய அளவில் அடிக்கடி நீர் வழங்குவதற்கு முன்னுரிமை கொடுங்கள்.", "வெட் பரிசோதனை வரை புதிய உணவை அறிமுகப்படுத்த வேண்டாம்.", "ஒவ்வொரு 4 மணிநேரமும் மலம் மற்றும் வாந்தியை கண்காணிக்கவும்."]
          : ["Prioritize hydration in small frequent amounts.", "Avoid introducing new food until vet review.", "Monitor stool and vomiting frequency every 4 hours."])
    : riskLevel === "MODERATE RISK"
      ? (language === "si"
          ? ["සරල ආහාර කුඩා ප්‍රමාණවලින් ලබා දෙන්න.", "විවේකය පවත්වා ශාරීරික වෙහෙස අඩු කරන්න.", "පැය 24ක් ආහාර රුචිය සහ ක්‍රියාකාරීත්ව වෙනස්කම් නිරීක්ෂණය කරන්න."]
          : language === "ta"
            ? ["எளிய உணவை சிறிய அளவில் வழங்கவும்.", "ஓய்வை பராமரித்து உடல் அழுத்தத்தை குறைக்கவும்.", "24 மணிநேரம் பசி மற்றும் செயல்பாட்டு மாற்றங்களை கண்காணிக்கவும்."]
            : ["Offer bland food in small portions.", "Maintain rest and reduce physical strain.", "Track appetite and activity changes for 24 hours."])
      : language === "si"
        ? ["සාමාන්‍ය ජලය පානය සහ සමබර ආහාර පවත්වන්න.", "පැය 24-48ක් රෝග ලක්ෂණ නිරීක්ෂණය කරන්න.", "සුරතලා අඩු ආතති පරිසරයක තබා හැසිරීම නිරීක්ෂණය කරන්න."]
        : language === "ta"
          ? ["இயல்பான நீர் அருந்துதலும் சமச்சீர் உணவும் பராமரிக்கவும்.", "24-48 மணிநேரம் அறிகுறிகளை கவனிக்கவும்.", "குறைந்த மன அழுத்த சூழலில் வைத்து நடத்தையை கண்காணிக்கவும்."]
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
      {data?.offline ? (
        <div className="rounded-xl border border-warning-fg/30 bg-warning-light px-3 py-2 text-sm text-warning-fg">
          {language === "si" ? "AI සේවාව ළඟා විය නොහැකි විය — මෙය දේශීය ඇස්තමේන්තුවකි." : language === "ta" ? "AI சேவையை அணுக முடியவில்லை — இது உள்ளூர் மதிப்பீடு." : "AI service was unreachable — this is an offline estimate, not a model prediction."}
        </div>
      ) : null}

      <section className={`${cardClassP6} text-center`}>
        <img src={pet.photoDataUrl || petBuddyImage} alt={pet.name} className="mx-auto h-28 w-28 rounded-full border-4 border-surface object-cover" />
        <h2 className="mt-4 text-2xl font-semibold text-accent">{finding}</h2>
        <Badge variant={riskLevel === "HIGH RISK" ? "danger" : riskLevel === "MODERATE RISK" ? "warning" : "success"} className="mt-3">{riskWord}</Badge>
        <p className="mt-2 text-sm text-accent-subtle">{language === "si" ? "අවදානම් ලකුණු:" : language === "ta" ? "அபாய மதிப்பு:" : "Risk Score:"} <span className="font-semibold text-accent">{riskScore}/100</span></p>
        <div className="mx-auto mt-2 h-2 w-48 overflow-hidden rounded-full bg-surface-tertiary dark:bg-neutral-800">
          <div
            className={`h-full rounded-full ${riskLevel === "HIGH RISK" ? "bg-danger-fg" : riskLevel === "MODERATE RISK" ? "bg-warning-fg" : "bg-success-fg"}`}
            style={{ width: `${Math.min(100, riskScore)}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium text-accent">
          {language === "si" ? "අවදානම් මට්ටම" : language === "ta" ? "அபாய நிலை" : "Risk level"}: <span className={riskLevel === "HIGH RISK" ? "text-danger-fg" : riskLevel === "MODERATE RISK" ? "text-warning-fg" : "text-success-fg"}>{riskWord}</span>
        </p>
        {result ? (
          <p className="mt-1 text-[11px] uppercase tracking-wide text-accent-faint">
            {language === "si" ? "ආකෘතිය" : language === "ta" ? "மாதிரி" : "Model"}: {result.model_version} · {language === "si" ? "විශ්වාසය" : language === "ta" ? "நம்பகம்" : "confidence"} {confidence}%
          </p>
        ) : null}
      </section>

      {result?.predicted_diseases?.length ? (
        <section className={cardClassP5}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{language === "si" ? "පුරෝකථනය කළ තත්ත්ව" : language === "ta" ? "கணிக்கப்பட்ட நிலைமைகள்" : "Predicted Conditions"}</h3>
          <div className="mt-3 space-y-3">
            {result.predicted_diseases.map((item) => (
              <div key={item.disease}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-accent">{item.disease_localized || item.disease}</span>
                  <span className="text-accent-subtle">{Math.round(item.probability * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary dark:bg-neutral-800">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(item.probability * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {result?.ontology_links?.length ? (
        <section className={cardClassP5}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{language === "si" ? "AI තර්කනය — රෝග ලක්ෂණ සම්බන්ධතා" : language === "ta" ? "AI காரணம் — அறிகுறி இணைப்புகள்" : "Why — Symptom-Disease Links"}</h3>
          <ul className="mt-3 space-y-2 text-sm text-accent-subtle">
            {result.ontology_links.slice(0, 5).map((link) => (
              <li key={`${link.symptom}-${link.disease}`} className="flex items-center justify-between gap-2">
                <span><span className="font-medium text-accent">{link.symptom_localized || link.symptom}</span> → {link.disease_localized || link.disease}</span>
                <Badge variant="info">{Math.round(link.weight * 100)}%</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topFeatures.length ? (
        <section className={cardClassP5}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{language === "si" ? "ප්‍රධාන බලපෑම් සාධක" : language === "ta" ? "முக்கிய தாக்க காரணிகள்" : "Key Influencing Factors"}</h3>
          <p className="mt-1 text-xs text-accent-faint">{language === "si" ? "ඉහළම පුරෝකථනයට වඩාත් බලපෑ ඔබගේ වාර්තාවේ යෙදුම්. කොළ පැහැය එය තහවුරු කරයි; අළු පැහැය එයට එරෙහිව බර තබයි." : language === "ta" ? "மேல் கணிப்பை மிகவும் பாதித்த உங்கள் அறிக்கையின் சொற்கள். பச்சை அதை ஆதரிக்கிறது; சாம்பல் அதற்கு எதிராக உள்ளது." : "Terms from your report that most influenced the top prediction. Green supports it; grey weighs against it."}</p>
          <div className="mt-3 space-y-3">
            {topFeatures.map((f) => (
              <div key={f.feature}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-accent">{f.feature}</span>
                  <span className={f.weight >= 0 ? "text-success-fg" : "text-accent-subtle"}>{f.weight >= 0 ? "+" : "−"}{Math.abs(f.weight).toFixed(2)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${f.weight >= 0 ? "bg-success-fg" : "bg-neutral-400 dark:bg-neutral-500"}`}
                    style={{ width: `${Math.round((Math.abs(f.weight) / maxFeatureWeight) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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

      {result ? (
        <section className={cardClassP5}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{language === "si" ? "AI නියෝජිත මඟපෙන්වීම" : language === "ta" ? "AI முகவர் வழிகாட்டுதல்" : "AI Agent Guidance"}</h3>
            {agent?.degraded ? <Badge variant="warning">{language === "si" ? "නීති මාදිලිය" : language === "ta" ? "விதி முறை" : "Rule-based mode"}</Badge> : null}
          </div>

          {agentLoading ? (
            <p className="mt-3 text-sm text-accent-subtle">{language === "si" ? "මඟපෙන්වීම ජනනය කරමින්..." : language === "ta" ? "வழிகாட்டுதல் உருவாக்கப்படுகிறது..." : "Generating personalized guidance..."}</p>
          ) : agent ? (
            <div className="mt-3 space-y-3">
              {agent.urgency_hours != null ? (
                <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${agent.urgency_hours <= 24 ? "border-danger-fg/30 bg-danger-light text-danger-fg" : agent.urgency_hours <= 72 ? "border-warning-fg/30 bg-warning-light text-warning-fg" : "border-success-fg/30 bg-success-light text-success-fg"}`}>
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>
                    {language === "si" ? `පැය ${agent.urgency_hours}ක් ඇතුළත පශු වෛද්‍ය උපදෙස් ලබාගන්න.` : language === "ta" ? `${agent.urgency_hours} மணிநேரத்திற்குள் கால்நடை ஆலோசனை பெறவும்.` : `Seek veterinary advice within ${agent.urgency_hours} hours.`}
                  </span>
                </div>
              ) : null}

              {agent.image_findings ? (
                <div className="rounded-xl border border-info/40 bg-info-light px-3 py-2 text-sm text-accent-muted dark:border-info/30 dark:bg-primary/10 dark:text-neutral-200">
                  <span className="font-medium text-accent dark:text-white">{language === "si" ? "ඡායාරූප විශ්ලේෂණය: " : language === "ta" ? "புகைப்பட பகுப்பாய்வு: " : "Photo analysis: "}</span>
                  {agent.image_findings}
                </div>
              ) : null}

              {agent.recommendations.map((rec, index) => (
                <div key={index} className="rounded-xl border border-border p-3 text-sm dark:border-neutral-700">
                  <div className="flex items-center gap-2">
                    <Badge variant={rec.type === "emergency" ? "danger" : rec.type === "vet_visit" ? "warning" : rec.type === "vaccination" ? "info" : "success"}>
                      {rec.type.replace("_", " ")}
                    </Badge>
                    {rec.title ? <span className="font-medium text-accent">{rec.title}</span> : null}
                  </div>
                  <p className="mt-2 text-accent-subtle">{rec.message}</p>
                </div>
              ))}

              {agent.clinic_suggestions?.length ? (
                <div>
                  <p className="text-sm font-medium text-accent">{language === "si" ? "යෝජිත ක්ලිනික්" : language === "ta" ? "பரிந்துரைக்கப்பட்ட கிளினிக்குகள்" : "Suggested clinics"}</p>
                  <div className="mt-2 space-y-2">
                    {agent.clinic_suggestions.map((clinic) => (
                      <button key={clinic.id} onClick={() => navigate("/pets?tab=clinics")} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition hover:border-primary ${clinic.recommended ? "border-primary bg-info-light dark:bg-primary/10" : "border-border dark:border-neutral-700"}`}>
                        <span>
                          <span className="flex items-center gap-2 font-medium text-accent">
                            {clinic.name}
                            {clinic.recommended ? <Badge variant="info">{language === "si" ? "නිර්දේශිත" : language === "ta" ? "பரிந்துரைக்கப்பட்டது" : "Recommended"}</Badge> : null}
                            {clinic.external ? <Badge variant="outline">{language === "si" ? "වේදිකාවේ නොමැත" : language === "ta" ? "தளத்தில் இல்லை" : "Not on platform"}</Badge> : null}
                          </span>
                          <span className="block text-xs text-accent-subtle">{clinic.address}{clinic.distance_km != null ? ` · ${clinic.distance_km.toFixed(1)} km` : ""}</span>
                          {clinic.recommended && clinic.match_reason ? <span className="block text-xs font-medium text-primary">{clinic.match_reason}</span> : null}
                          {clinic.surgeon ? <span className="block text-xs text-accent-subtle">{clinic.surgeon}</span> : null}
                        </span>
                        <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {agent.explanation ? (
                <details className="rounded-xl border border-border p-3 text-sm dark:border-neutral-700">
                  <summary className="cursor-pointer font-medium text-accent">{language === "si" ? "AI තීරණය කළ ආකාරය" : language === "ta" ? "AI எப்படி முடிவு செய்தது" : "How the AI decided"}</summary>
                  {agent.agents?.length ? (
                    <div className="mt-2 space-y-1.5">
                      {agent.agents.map((step, index) => (
                        <div key={index} className="flex items-start gap-2 rounded-lg bg-surface-secondary px-2.5 py-1.5 dark:bg-neutral-800">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">{index + 1}</span>
                          <span className="min-w-0">
                            <span className="block text-[12px] font-semibold text-accent">{step.agent}</span>
                            <span className="block truncate text-[11px] text-accent-subtle">{step.summary}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-accent-subtle">{agent.explanation}</p>
                  {agent.agent_trace?.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-accent-faint">
                      {agent.agent_trace.map((step, index) => <li key={index}>• {step}</li>)}
                    </ul>
                  ) : null}
                </details>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-accent-subtle">{language === "si" ? "නියෝජිත සේවාව නොමැත." : language === "ta" ? "முகவர் சேவை கிடைக்கவில்லை." : "Agent guidance unavailable right now."}</p>
          )}
        </section>
      ) : null}

      <Disclaimer />

      {result?.id ? (
        <section className={cardClassP5}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">{language === "si" ? "මෙම තක්සේරුව උපකාරී වූවාද?" : language === "ta" ? "இந்த மதிப்பீடு உதவியாக இருந்ததா?" : "Was this assessment helpful?"}</h3>
          {fbDone ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-success-fg/30 bg-success-light px-3 py-2 text-sm text-success-fg">
              <Check className="h-4 w-4" />
              <span>{language === "si" ? "ඔබේ ප්‍රතිපෝෂණයට ස්තූතියි — එය ආකෘතිය වැඩිදියුණු කිරීමට උපකාරී වේ." : language === "ta" ? "உங்கள் கருத்துக்கு நன்றி — இது மாதிரியை மேம்படுத்த உதவுகிறது." : "Thanks for your feedback — it helps improve the model."}</span>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFbRating("helpful")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${fbRating === "helpful" ? "border-success-fg bg-success-light text-success-fg" : "border-border text-accent hover:border-primary dark:border-neutral-700"}`}
                >
                  👍 {language === "si" ? "උපකාරී විය" : language === "ta" ? "உதவியாக இருந்தது" : "Helpful"}
                </button>
                <button
                  type="button"
                  onClick={() => setFbRating("not_helpful")}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${fbRating === "not_helpful" ? "border-danger-fg bg-danger-light text-danger-fg" : "border-border text-accent hover:border-primary dark:border-neutral-700"}`}
                >
                  👎 {language === "si" ? "උපකාරී නොවීය" : language === "ta" ? "உதவியாக இல்லை" : "Not helpful"}
                </button>
              </div>

              {fbRating ? (
                <>
                  <div>
                    <Label>{language === "si" ? "මෙය ඔබේ පශු වෛද්‍යවරයාගේ රෝග විනිශ්චයට ගැලපුණාද?" : language === "ta" ? "இது உங்கள் கால்நடை மருத்துவரின் நோயறிதலுடன் பொருந்தியதா?" : "Did this match your vet's diagnosis?"}</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {([
                        ["unsure", language === "si" ? "තවම පශු වෛද්‍යවරයකු බලා නැත" : language === "ta" ? "இன்னும் மருத்துவர் பார்க்கவில்லை" : "Not seen by a vet yet"],
                        ["yes", language === "si" ? "ඔව්" : language === "ta" ? "ஆம்" : "Yes"],
                        ["no", language === "si" ? "නැහැ" : language === "ta" ? "இல்லை" : "No"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFbMatched(value)}
                          className={`rounded-full border px-3 py-1 text-sm transition ${fbMatched === value ? "border-primary bg-info-light text-primary dark:bg-primary/10" : "border-border text-accent-subtle hover:border-primary dark:border-neutral-700"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="fb-comment">{language === "si" ? "එකතු කිරීමට යමක් තිබේද? (විකල්ප)" : language === "ta" ? "ஏதேனும் சேர்க்க வேண்டுமா? (விருப்பத்தேர்வு)" : "Anything to add? (optional)"}</Label>
                    <textarea
                      id="fb-comment"
                      value={fbComment}
                      onChange={(e) => setFbComment(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-accent outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-950"
                    />
                  </div>

                  <Button className="w-full" disabled={fbSubmitting} onClick={handleSubmitFeedback}>
                    {fbSubmitting ? "…" : language === "si" ? "ප්‍රතිපෝෂණය යවන්න" : language === "ta" ? "கருத்தை சமர்ப்பிக்கவும்" : "Submit feedback"}
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

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
