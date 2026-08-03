import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAccessToken, getProfileNameForRole, logout, saveProfileName } from "../lib/session";
import { t, useLanguageStore } from "../lib/language";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { toast } from "../lib/use-toast";
import { useTabRoute } from "../lib/use-tab-route";
import { BackButton } from "../components/BackButton";
import { ClinicDetailsPage, PetProfilePage } from "./PetOwnerFlowPages";
import {
  Home, PawPrint, Brain, MapPin, User, LogOut, Plus, Trash2, Save,
  Send, AlertTriangle, Calendar, Clock, ChevronRight, X, Menu, Pencil,
  Activity, Syringe, TrendingUp, ArrowRight, Sparkles, Info, Megaphone,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Dropzone } from "../components/ui/dropzone";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { NotificationCenter } from "../components/NotificationCenter";
import { ClinicMap, type MapClinic } from "../components/ClinicMap";
import { cn } from "../lib/utils";
import { getMyProfile, updateMyProfile } from "../lib/auth-api";
import {
  createOwnerPet,
  deleteOwnerPet,
  getOwnerId,
  listOwnerPets,
  updateOwnerPet,
  type BackendPet,
} from "../lib/pet-api";
import { cancelAppointment, createAppointment, listAppointments, listClinics, listNearbyClinics, updateAppointment, listInquiries, createInquiry, sendInquiryMessage, type NearbyClinic } from "../lib/clinic-api";
import { getPredictionHistory, deletePrediction, type PredictionHistoryItem } from "../lib/prediction-api";
import { listUpcomingVaccinations } from "../lib/vaccination-api";
import { listAnnouncements, type Announcement } from "../lib/admin-api";
import { sendChatMessage } from "../lib/agent-api";
import type { Appointment as BackendAppointment, VetClinic } from "@companion-ai/shared-types";

// ── Storage keys ──
const CLINIC_DIRECTORY_KEY = "companion_ai_clinic_directory";
const PET_OWNER_PETS_KEY = "companion_ai_pet_owner_pets";
const PET_OWNER_PROFILE_KEY = "companion_ai_pet_owner_profile";
const PET_OWNER_APPOINTMENTS_KEY = "companion_ai_pet_owner_appointments";
const PET_OWNER_SURGEON_INQUIRIES_KEY = "companion_ai_pet_owner_surgeon_inquiries";
const DISMISSED_ANNOUNCEMENTS_KEY = "companion_ai_dismissed_announcements";

// ── Types ──
interface ClinicDirectoryRecord {
  id: string; name: string; address: string; phone: string; specialization: string;
  status: "active" | "inactive"; latitude?: number; longitude?: number;
  surgeons: Array<{ id: string; name: string; specialization: string; availableSlots: string[] }>;
}
interface PetRecord { id: string; name: string; species: string; breed: string; age: string; weightKg: string; emoji: string; photoDataUrl?: string; vaccinationName?: string; vaccinationDate?: string; vaccinationFrequency?: string; nextVaccinationDate?: string; }
interface OwnerProfile { displayName: string; email: string; phone: string; address: string; dateOfBirth: string; photoDataUrl?: string; }
interface AppointmentRecord extends BackendAppointment { slot: string; bookedAt: string; clinicName: string; surgeonName: string; petName: string; ownerName: string; ownerPhone?: string; }
interface InquiryThreadMessageRecord { senderRole: "owner" | "vet"; body: string; createdAt: string; }
interface SurgeonInquiryRecord { id: string; clinicId: string; clinicName: string; surgeonId: string; surgeonName: string; petId: string; petName: string; message: string; messages: InquiryThreadMessageRecord[]; status: "awaiting_vet" | "answered" | "closed"; remainingMessages: number; maxMessages: number; createdAt: string; }
interface ChatMessage { id: string; sender: "owner" | "assistant"; text: string; }
const OWNER_TABS = ["home", "pets", "ai", "clinics", "profile"] as const;
type Tab = (typeof OWNER_TABS)[number];
type SlotLookup = Record<string, Record<string, Record<string, string>>>;

const breedsBySpecies: Record<string, string[]> = {
  Dog: [
    "Golden Retriever", "Labrador Retriever", "German Shepherd", "Bulldog", "Poodle",
    "Beagle", "Rottweiler", "Dachshund", "Boxer", "Siberian Husky",
    "Doberman Pinscher", "Shih Tzu", "Pomeranian", "Border Collie", "Great Dane",
    "Cocker Spaniel", "Dalmatian", "Chihuahua", "Maltese", "Yorkshire Terrier",
    "Pug", "Cavalier King Charles Spaniel", "French Bulldog", "Bernese Mountain Dog",
    "Australian Shepherd", "Jack Russell Terrier", "Mixed Breed",
  ],
  Cat: [
    "Siamese", "Persian", "Maine Coon", "Ragdoll", "Bengal",
    "British Shorthair", "Abyssinian", "Scottish Fold", "Sphynx", "Birman",
    "Russian Blue", "Norwegian Forest Cat", "Burmese", "Oriental Shorthair",
    "Devon Rex", "Exotic Shorthair", "Tonkinese", "American Shorthair",
    "Himalayan", "Turkish Angora", "Mixed Breed",
  ],
};

function loadJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

function removeLegacySeedPets(pets: PetRecord[]): PetRecord[] {
  return pets.filter(
    (pet) =>
      !(
        (pet.id === "pet-1" && pet.name === "Buddy") ||
        (pet.id === "pet-2" && pet.name === "Luna")
      )
  );
}

function toPetRecord(pet: BackendPet): PetRecord {
  const speciesLabel = pet.species === "cat" ? "Cat" : "Dog";
  const normalizedId = pet.id || pet._id;

  if (!normalizedId) {
    throw new Error("Pet id is missing from backend response");
  }

  return {
    id: normalizedId,
    name: pet.name,
    species: speciesLabel,
    breed: pet.breed,
    age: String(pet.ageYears),
    weightKg: String(pet.weightKg),
    emoji: pet.species === "cat" ? "🐈" : "🐕",
    photoDataUrl: pet.photoURL,
    vaccinationName: pet.vaccinationName,
    vaccinationDate: pet.vaccinationDate,
    vaccinationFrequency: pet.vaccinationFrequency,
    nextVaccinationDate: pet.nextVaccinationDate,
  };
}

function formatClinicSlotLabel(slot: VetClinic["surgeons"][number]["availableSlots"][number]): string {
  return new Date(slot.datetime).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapClinicFromBackend(clinic: VetClinic): ClinicDirectoryRecord {
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address,
    phone: clinic.phone,
    specialization: clinic.specializations.join(" • ") || "General Practice",
    status: clinic.isOpen ? "active" : "inactive",
    latitude: clinic.latitude,
    longitude: clinic.longitude,
    surgeons: clinic.surgeons.map((surgeon) => ({
      id: surgeon.id,
      name: surgeon.name,
      specialization: surgeon.specialization,
      availableSlots: surgeon.availableSlots.map((slot) => formatClinicSlotLabel(slot)),
    })),
  };
}

function buildSlotLookup(clinics: VetClinic[]): SlotLookup {
  return clinics.reduce<SlotLookup>((clinicAcc, clinic) => {
    clinicAcc[clinic.id] = clinic.surgeons.reduce<Record<string, Record<string, string>>>((surgeonAcc, surgeon) => {
      surgeonAcc[surgeon.id] = surgeon.availableSlots.reduce<Record<string, string>>((slotAcc, slot) => {
        slotAcc[formatClinicSlotLabel(slot)] = slot.id;
        return slotAcc;
      }, {});
      return surgeonAcc;
    }, {});
    return clinicAcc;
  }, {});
}

function resolveSlotLabelFromLookup(slotLookup: SlotLookup, clinicId: string, surgeonId: string, slotId: string): string {
  const slots = slotLookup[clinicId]?.[surgeonId] ?? {};
  const found = Object.entries(slots).find(([, value]) => value === slotId);
  return found?.[0] || slotId;
}

function resolveSlotIdFromLookup(slotLookup: SlotLookup, clinicId: string, surgeonId: string, slotLabel: string): string | null {
  return slotLookup[clinicId]?.[surgeonId]?.[slotLabel] || null;
}

function mapAppointmentFromBackend(
  appointment: BackendAppointment,
  clinics: ClinicDirectoryRecord[],
  slotLookup: SlotLookup,
  petName: string,
  ownerName: string,
  ownerPhone?: string,
): AppointmentRecord {
  const clinic = clinics.find((item) => item.id === appointment.clinicId);
  const surgeon = clinic?.surgeons.find((item) => item.id === appointment.surgeonId);

  return {
    ...appointment,
    bookedAt: appointment.createdAt,
    slot: resolveSlotLabelFromLookup(slotLookup, appointment.clinicId, appointment.surgeonId, appointment.slotId),
    clinicName: clinic?.name || appointment.clinicId,
    surgeonName: surgeon?.name || appointment.surgeonId,
    petName,
    ownerName,
    ownerPhone,
  };
}

const EMPTY_PET_FORM = {
  name: "",
  species: "Dog",
  breed: "",
  age: "",
  weightKg: "",
  photoDataUrl: "",
  vaccinationName: "",
  vaccinationDate: "",
  vaccinationFrequency: "Annual",
  nextVaccinationDate: "",
};

const navItems: Array<{ id: Tab; labelKey: string; icon: typeof Home }> = [
  { id: "home", labelKey: "navOverview", icon: Home },
  { id: "pets", labelKey: "navPets", icon: PawPrint },
  { id: "ai", labelKey: "navAiChat", icon: Brain },
  { id: "clinics", labelKey: "navClinics", icon: MapPin },
  { id: "profile", labelKey: "navAccount", icon: User },
];

interface PredictionDisplay {
  id: string;
  title: string;
  pet: string;
  age: string;
  risk: "low" | "moderate" | "high";
  confidence: number;
  riskScore: number;
  recommendation: string;
  variant: "success" | "warning" | "danger";
}

function relativeTime(iso: string): string {
  // Treat a timezone-less timestamp as UTC (server stores UTC); otherwise a
  // UTC+5:30 client misreads it and every fresh record shows "~5h ago".
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const then = new Date(normalized).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function mapHistoryItem(item: PredictionHistoryItem, petName: string, tr: (key: string) => string): PredictionDisplay {
  const risk = item.risk_level === "medium" ? "moderate" : item.risk_level;
  return {
    id: item.id,
    title: item.predicted_diseases?.[0]?.disease_localized || item.predicted_diseases?.[0]?.disease || tr("healthAssessment"),
    pet: petName,
    age: relativeTime(item.created_at),
    risk,
    confidence: Math.round((item.confidence_score ?? 0) * 100),
    riskScore: Math.round((item.risk_score ?? 0) * 100),
    recommendation: risk === "high" ? tr("recHigh") : risk === "moderate" ? tr("recModerate") : tr("recLow"),
    variant: risk === "high" ? "danger" : risk === "moderate" ? "warning" : "success",
  };
}

const riskColors = { low: "text-emerald-600", moderate: "text-amber-600", high: "text-red-600" };
const riskBg = { low: "bg-emerald-500", moderate: "bg-amber-500", high: "bg-red-500" };
const DASHBOARD_CALENDAR_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DASHBOARD_CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PetOwnerDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fallbackName = getProfileNameForRole("pet-owner", "Pet Owner");
  const ownerId = useMemo(() => getOwnerId(), []);
  const petsStorageKey = `${PET_OWNER_PETS_KEY}_${ownerId}`;
  const profileStorageKey = `${PET_OWNER_PROFILE_KEY}_${ownerId}`;
  const appointmentsStorageKey = `${PET_OWNER_APPOINTMENTS_KEY}_${ownerId}`;
  const inquiriesStorageKey = `${PET_OWNER_SURGEON_INQUIRIES_KEY}_${ownerId}`;

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pets, setPets] = useState<PetRecord[]>(() => removeLegacySeedPets(loadJson<PetRecord[]>(petsStorageKey, [])));
  const [predictions, setPredictions] = useState<PredictionDisplay[]>([]);
  const [deletingAssessment, setDeletingAssessment] = useState<PredictionDisplay | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);

  // Localize backend enum values so nothing renders as raw English in si/ta.
  const STATUS_KEY: Record<string, string> = {
    pending: "statusPending", confirmed: "statusConfirmed", cancelled: "statusCancelled",
    completed: "statusCompleted", open: "statusOpen", replied: "statusReplied",
    awaiting_vet: "statusAwaitingVet", answered: "statusAnswered", closed: "statusClosed",
  };
  const statusLabel = (status: string) => (STATUS_KEY[status] ? tr(STATUS_KEY[status]) : status);
  const riskLabel = (risk: string) =>
    risk === "high" ? tr("levelHigh") : risk === "moderate" ? tr("levelModerate") : risk === "low" ? tr("levelLow") : tr("levelMedium");

  useEffect(() => {
    let active = true;
    getPredictionHistory(undefined, 20)
      .then((items) => {
        if (!active) return;
        setPredictions(
          items.map((item) =>
            mapHistoryItem(item, pets.find((p) => p.id === item.pet_id)?.name || "Pet", tr)
          )
        );
      })
      .catch(() => undefined);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pets.length, language]);
  // Platform announcements published by an administrator for pet owners.
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>(
    () => loadJson<string[]>(DISMISSED_ANNOUNCEMENTS_KEY, []),
  );

  useEffect(() => {
    let active = true;
    listAnnouncements()
      .then((rows) => { if (active) setAnnouncements(rows); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Dismissal is presentational only, so it lives in the browser rather than
  // creating a per-user row for every announcement on the server.
  function dismissAnnouncement(id: string) {
    const next = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(next);
    localStorage.setItem(DISMISSED_ANNOUNCEMENTS_KEY, JSON.stringify(next));
  }

  const visibleAnnouncements = announcements.filter((a) => !dismissedAnnouncements.includes(a.id));

  // Soonest upcoming vaccination across the owner's pets, or null when none is
  // due. This banner used to render a hardcoded "due in 3 days" for everyone,
  // including owners with no vaccination records at all.
  const [dueVaccination, setDueVaccination] = useState<{ petName: string; vaccineName: string; days: number } | null>(null);
  const petIdKey = useMemo(() => pets.map((pet) => pet.id).join(","), [pets]);

  useEffect(() => {
    if (!pets.length) { setDueVaccination(null); return; }
    let active = true;
    Promise.all(
      pets.map((pet) =>
        listUpcomingVaccinations(pet.id)
          .then((records) => records.map((record) => ({ record, petName: pet.name })))
          .catch(() => [] as { record: { vaccineName: string; nextDueAt: string }; petName: string }[])
      )
    )
      .then((groups) => {
        if (!active) return;
        const now = Date.now();
        const soonest = groups
          .flat()
          .map(({ record, petName }) => ({
            petName,
            vaccineName: record.vaccineName,
            days: Math.ceil((new Date(record.nextDueAt).getTime() - now) / 86_400_000),
          }))
          .filter((item) => Number.isFinite(item.days))
          .sort((a, b) => a.days - b.days)[0];
        setDueVaccination(soonest ?? null);
      })
      .catch(() => undefined);
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petIdKey]);

  const [petsLoading, setPetsLoading] = useState(false);
  const [savingPet, setSavingPet] = useState(false);
  const [deletingPetId, setDeletingPetId] = useState<string | null>(null);
  const [newPet, setNewPet] = useState(EMPTY_PET_FORM);
  const [profile, setProfile] = useState<OwnerProfile>(() => loadJson(profileStorageKey, { displayName: fallbackName, email: "", phone: "", address: "", dateOfBirth: "" }));
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileBeforeEdit, setProfileBeforeEdit] = useState<OwnerProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "msg-1", sender: "assistant", text: tr("aiGreeting") }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(() => loadJson(appointmentsStorageKey, []));
  const [bookingPetByClinic, setBookingPetByClinic] = useState<Record<string, string>>({});
  const [pendingBooking, setPendingBooking] = useState<{
    clinic: ClinicDirectoryRecord;
    surgeon: ClinicDirectoryRecord["surgeons"][number];
    slot: string;
    slotId: string;
    petId: string;
    petName: string;
  } | null>(null);
  const [rescheduleSlotByAppointment, setRescheduleSlotByAppointment] = useState<Record<string, string>>({});
  const [inquiryBySurgeon, setInquiryBySurgeon] = useState<Record<string, string>>({});
  const [surgeonInquiries, setSurgeonInquiries] = useState<SurgeonInquiryRecord[]>(() => loadJson(inquiriesStorageKey, []));
  const [followUpByInquiry, setFollowUpByInquiry] = useState<Record<string, string>>({});
  const [sendingFollowUpId, setSendingFollowUpId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; accuracyKm?: number } | null>(null);
  const [externalClinics, setExternalClinics] = useState<NearbyClinic[]>([]);
  // Clinics are created by an administrator, often while an owner already has
  // this page open. The list was loaded once on mount, so a new clinic never
  // reached the directory or the map until a full reload. Bumping this key
  // re-runs the load.
  const [clinicRefreshKey, setClinicRefreshKey] = useState(0);

  // Real-world discovery: OpenStreetMap veterinary POIs near the user (display-only)
  useEffect(() => {
    if (!userLocation) return;
    let active = true;
    listNearbyClinics(userLocation.latitude, userLocation.longitude, 50)
      .then((results) => {
        if (active) setExternalClinics(results.filter((clinic) => clinic.external));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [userLocation]);
  const [locationError, setLocationError] = useState("");
  const [ownerCalendarMonth, setOwnerCalendarMonth] = useState(new Date().getMonth());
  const [ownerCalendarYear, setOwnerCalendarYear] = useState(new Date().getFullYear());
  const [clinics, setClinics] = useState<ClinicDirectoryRecord[]>(() => {
    const stored = loadJson<ClinicDirectoryRecord[]>(CLINIC_DIRECTORY_KEY, []);
    return stored.filter((clinic) => clinic.status === "active");
  });
  const [slotLookup, setSlotLookup] = useState<SlotLookup>({});

  useEffect(() => { localStorage.setItem(appointmentsStorageKey, JSON.stringify(appointments)); }, [appointments, appointmentsStorageKey]);
  useEffect(() => { localStorage.setItem(inquiriesStorageKey, JSON.stringify(surgeonInquiries)); }, [surgeonInquiries, inquiriesStorageKey]);
  // Inquiries are now server-backed (a vet on any device can see + reply);
  // localStorage is just a render cache.
  useEffect(() => {
    let active = true;
    listInquiries()
      .then((items) => { if (active) setSurgeonInquiries(items as SurgeonInquiryRecord[]); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => { localStorage.setItem(CLINIC_DIRECTORY_KEY, JSON.stringify(clinics)); }, [clinics]);
  useEffect(() => {
    let active = true;
    setPetsLoading(true);
    listOwnerPets(ownerId)
      .then((items) => {
        if (!active) return;
        persistPets(removeLegacySeedPets(items.map(toPetRecord)));
      })
      .catch((err: Error) => {
        if (!active) return;
        toast({ title: tr("failedLoadPets"), description: err.message, variant: "error" });
      })
      .finally(() => {
        if (!active) return;
        setPetsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ownerId]);
  useEffect(() => {
    let active = true;

    Promise.allSettled([listClinics(), listAppointments(ownerId)]).then(([clinicResult, appointmentResult]) => {
      if (!active) return;

      let nextClinics = clinics;
      let nextSlotLookup = slotLookup;

      if (clinicResult.status === "fulfilled") {
        const mappedClinics = clinicResult.value.map(mapClinicFromBackend).filter((clinic) => clinic.status === "active");
        nextClinics = mappedClinics;
        nextSlotLookup = buildSlotLookup(clinicResult.value.length > 0 ? clinicResult.value : []);
        setClinics(mappedClinics);
        setSlotLookup(nextSlotLookup);
        localStorage.setItem(CLINIC_DIRECTORY_KEY, JSON.stringify(mappedClinics));
      }

      if (appointmentResult.status === "fulfilled") {
        const mappedAppointments = appointmentResult.value.map((appointment) => mapAppointmentFromBackend(
          appointment,
          nextClinics,
          nextSlotLookup,
          pets.find((pet) => pet.id === appointment.petId)?.name || appointment.petId,
          profile.displayName.trim() || fallbackName,
          profile.phone.trim() || undefined,
        ));
        setAppointments(mappedAppointments);
        localStorage.setItem(appointmentsStorageKey, JSON.stringify(mappedAppointments));
      }
    }).catch((error: unknown) => {
      if (!active) return;
      toast({ title: tr("failedLoadClinics"), description: error instanceof Error ? error.message : "Unable to load clinic data", variant: "error" });
    });

    return () => {
      active = false;
    };
  }, [ownerId, appointmentsStorageKey, clinicRefreshKey]);

  // Refresh when the owner opens the clinics tab, and when the window regains
  // focus — that second one covers the common case of an administrator adding
  // a clinic in another tab or window while this page sits open.
  useEffect(() => {
    if (activeTab !== "clinics") return;
    setClinicRefreshKey((key) => key + 1);
  }, [activeTab]);

  useEffect(() => {
    const refresh = () => setClinicRefreshKey((key) => key + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    let active = true;
    const token = getAccessToken();
    if (!token) return;

    setProfileLoading(true);
    getMyProfile(token)
      .then((remoteProfile) => {
        if (!active) return;
        const normalized: OwnerProfile = {
          displayName: remoteProfile.displayName || fallbackName,
          email: remoteProfile.email || "",
          phone: remoteProfile.phoneNumber || "",
          address: remoteProfile.address || "",
          dateOfBirth: remoteProfile.dateOfBirth || "",
          photoDataUrl: remoteProfile.photoURL,
        };
        setProfile(normalized);
        localStorage.setItem(profileStorageKey, JSON.stringify(normalized));
        saveProfileName(normalized.displayName, "pet-owner");
      })
      .catch((err: Error) => {
        if (!active) return;
        toast({ title: tr("failedLoadProfile"), description: err.message, variant: "error" });
      })
      .finally(() => {
        if (!active) return;
        setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fallbackName, profileStorageKey]);
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError(tr("locNotSupported")); return; }
    // Browsers only allow geolocation on a secure origin (https or localhost).
    // Accessing via a LAN IP over http silently blocks it — report that clearly.
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setLocationError(tr("locInsecure"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyKm: pos.coords.accuracy ? Math.round(pos.coords.accuracy / 100) / 10 : undefined,
        });
        setLocationError("");
      },
      (err) => {
        // Report the ACTUAL failure instead of always saying "denied".
        if (err.code === err.PERMISSION_DENIED) setLocationError(tr("locDenied"));
        else if (err.code === err.POSITION_UNAVAILABLE) setLocationError(tr("locUnavailable"));
        else setLocationError(tr("locTimeout"));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const R = 6371, toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  const nearbyClinics = useMemo(() => {
    if (!userLocation) return clinics;
    return [...clinics].sort((a, b) => {
      const dA = typeof a.latitude === "number" && typeof a.longitude === "number" ? distanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude) : Infinity;
      const dB = typeof b.latitude === "number" && typeof b.longitude === "number" ? distanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude) : Infinity;
      return dA - dB;
    });
  }, [clinics, userLocation]);

  function persistPets(next: PetRecord[]) { setPets(next); localStorage.setItem(petsStorageKey, JSON.stringify(next)); }
  async function handleAddPet(): Promise<boolean> {
    if (!newPet.name.trim() || !newPet.breed.trim() || !newPet.age.trim() || !newPet.weightKg.trim()) {
      toast({ title: tr("missingFields"), description: tr("fillPetInfoCreate"), variant: "error" });
      return false;
    }

    const ageYears = Number(newPet.age);
    const weightKg = Number(newPet.weightKg);
    if (Number.isNaN(ageYears) || Number.isNaN(weightKg)) {
      toast({ title: tr("invalidValues"), description: tr("ageWeightNumbers"), variant: "error" });
      return false;
    }

    try {
      setSavingPet(true);
      const created = await createOwnerPet({
        ownerId,
        name: newPet.name.trim(),
        species: newPet.species === "Cat" ? "cat" : "dog",
        breed: newPet.breed.trim(),
        ageYears,
        weightKg,
        sex: "male",
        neutered: false,
        photoURL: newPet.photoDataUrl || undefined,
          vaccinationName: newPet.vaccinationName.trim() || undefined,
          vaccinationDate: newPet.vaccinationDate || undefined,
          vaccinationFrequency: newPet.vaccinationFrequency || undefined,
          nextVaccinationDate: newPet.nextVaccinationDate || undefined,
      });
      persistPets([toPetRecord(created), ...pets]);
      setNewPet(EMPTY_PET_FORM);
      toast({ title: tr("petAdded"), variant: "success" });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create pet";
      toast({ title: tr("failedCreatePet"), description: message, variant: "error" });
      return false;
    } finally {
      setSavingPet(false);
    }
  }

  async function handleUpdatePet(id: string): Promise<boolean> {
    if (!newPet.name.trim() || !newPet.breed.trim() || !newPet.age.trim() || !newPet.weightKg.trim()) {
      toast({ title: tr("missingFields"), description: tr("fillPetInfoUpdate"), variant: "error" });
      return false;
    }

    const ageYears = Number(newPet.age);
    const weightKg = Number(newPet.weightKg);
    if (Number.isNaN(ageYears) || Number.isNaN(weightKg)) {
      toast({ title: tr("invalidValues"), description: tr("ageWeightNumbers"), variant: "error" });
      return false;
    }

    try {
      setSavingPet(true);
      const updated = await updateOwnerPet(id, {
        name: newPet.name.trim(),
        species: newPet.species === "Cat" ? "cat" : "dog",
        breed: newPet.breed.trim(),
        ageYears,
        weightKg,
        photoURL: newPet.photoDataUrl || undefined,
          vaccinationName: newPet.vaccinationName.trim() || undefined,
          vaccinationDate: newPet.vaccinationDate || undefined,
          vaccinationFrequency: newPet.vaccinationFrequency || undefined,
          nextVaccinationDate: newPet.nextVaccinationDate || undefined,
      });
      persistPets(pets.map((pet) => (pet.id === id ? toPetRecord(updated) : pet)));
      toast({ title: tr("petUpdated"), variant: "success" });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update pet";
      toast({ title: tr("failedUpdatePet"), description: message, variant: "error" });
      return false;
    } finally {
      setSavingPet(false);
    }
  }

  async function handleDeletePet(id: string): Promise<boolean> {
    try {
      setDeletingPetId(id);
      await deleteOwnerPet(id);
      persistPets(pets.filter((p) => p.id !== id));
      toast({ title: tr("petRemoved") });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete pet";
      toast({ title: tr("failedDeletePet"), description: message, variant: "error" });
      return false;
    } finally {
      setDeletingPetId(null);
    }
  }
  async function handleSaveProfile() {
    if (!profile.displayName.trim()) { toast({ title: tr("nameRequired"), variant: "error" }); return; }

    const normalizedLocal: OwnerProfile = {
      ...profile,
      displayName: profile.displayName.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
      address: profile.address.trim(),
      dateOfBirth: profile.dateOfBirth,
      photoDataUrl: profile.photoDataUrl,
    };

    const token = getAccessToken();
    if (!token) {
      setProfile(normalizedLocal);
      saveProfileName(normalizedLocal.displayName, "pet-owner");
      localStorage.setItem(profileStorageKey, JSON.stringify(normalizedLocal));
      toast({ title: tr("profileSaved"), variant: "success" });
      return;
    }

    try {
      setProfileSaving(true);
      const updated = await updateMyProfile(token, {
        displayName: normalizedLocal.displayName,
        phoneNumber: normalizedLocal.phone || undefined,
        address: normalizedLocal.address || undefined,
        dateOfBirth: normalizedLocal.dateOfBirth || undefined,
        photoURL: normalizedLocal.photoDataUrl || undefined,
      });

      const normalizedRemote: OwnerProfile = {
        displayName: updated.displayName || normalizedLocal.displayName,
        email: updated.email || normalizedLocal.email,
        phone: updated.phoneNumber || "",
        address: updated.address || "",
        dateOfBirth: updated.dateOfBirth || "",
        photoDataUrl: updated.photoURL,
      };

      setProfile(normalizedRemote);
      saveProfileName(normalizedRemote.displayName, "pet-owner");
      localStorage.setItem(profileStorageKey, JSON.stringify(normalizedRemote));
      setIsProfileEditing(false);
      setProfileBeforeEdit(null);
      toast({ title: tr("profileSaved"), variant: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      toast({ title: tr("failedSaveProfile"), description: message, variant: "error" });
    } finally {
      setProfileSaving(false);
    }
  }
  function handleLogout() { logout(); navigate("/auth/login", { replace: true }); }
  function isSlotBooked(clinicId: string, surgeonId: string, slot: string) { return appointments.some((a) => a.status !== "cancelled" && a.clinicId === clinicId && a.surgeonId === surgeonId && a.slot === slot); }
  /**
   * Tapping a slot used to create the appointment immediately - no review, no
   * confirmation. With more than one pet it silently booked whichever happened
   * to be first in the list, so an owner could commit the wrong animal to a
   * real appointment with a single accidental tap. This now opens a
   * confirmation showing exactly what is about to be booked.
   */
  function requestBooking(clinic: ClinicDirectoryRecord, surgeon: ClinicDirectoryRecord["surgeons"][number], slot: string) {
    const petId = bookingPetByClinic[clinic.id] || pets[0]?.id;
    const pet = pets.find((p) => p.id === petId);
    if (!pet) { toast({ title: tr("addPetFirst"), variant: "error" }); return; }
    if (isSlotBooked(clinic.id, surgeon.id, slot)) { toast({ title: tr("slotTaken"), variant: "error" }); return; }
    const slotId = resolveSlotIdFromLookup(slotLookup, clinic.id, surgeon.id, slot);
    if (!slotId) { toast({ title: tr("slotUnavailable"), description: tr("reloadClinicsRetry"), variant: "error" }); return; }
    setPendingBooking({ clinic, surgeon, slot, slotId, petId: pet.id, petName: pet.name });
  }

  function confirmPendingBooking() {
    if (!pendingBooking) return;
    const { clinic, surgeon, slot, slotId, petId, petName } = pendingBooking;
    setPendingBooking(null);
    handleBookAppointment(clinic, surgeon, slot, slotId, petId, petName);
  }

  function handleBookAppointment(
    clinic: ClinicDirectoryRecord,
    surgeon: ClinicDirectoryRecord["surgeons"][number],
    slot: string,
    slotId: string,
    petId: string,
    petName: string,
  ) {
    const pet = { id: petId, name: petName };

    createAppointment({
      ownerId,
      petId: pet.id,
      clinicId: clinic.id,
      surgeonId: surgeon.id,
      slotId,
      status: "pending",
      notes: "",
    })
      .then((created) => {
        const mapped = mapAppointmentFromBackend(created, clinics, slotLookup, pet.name, profile.displayName.trim() || fallbackName, profile.phone.trim() || undefined);
        setAppointments((prev) => [mapped, ...prev]);
        localStorage.setItem("companion_ai_last_booking", JSON.stringify({ petId: pet.id, petName: pet.name, clinicId: clinic.id, clinicName: clinic.name, surgeonName: surgeon.name, slot }));
        toast({ title: tr("appointmentBooked"), description: `${surgeon.name} at ${slot}`, variant: "success" });
        navigate("/pets/booking-confirmed");
      })
      .catch((error: unknown) => {
        toast({ title: tr("failedBookAppointment"), description: error instanceof Error ? error.message : "Unable to create booking", variant: "error" });
      });
  }
  // Cancelling removes the booking rather than leaving a cancelled row in the
  // list. The slot is released and the appointment-based access grant revoked
  // server-side when no other live appointment links this pet to that vet.
  function handleCancelAppointment(id: string) {
    cancelAppointment(id)
      .then(() => {
        setAppointments((prev) => prev.filter((a) => a.id !== id));
        toast({ title: tr("appointmentCancelled") });
      })
      .catch((error: unknown) => {
        toast({ title: tr("failedCancelAppointment"), description: error instanceof Error ? error.message : "Unable to cancel appointment", variant: "error" });
      });
  }
  function handleRescheduleAppointment(appt: AppointmentRecord) {
    const slot = rescheduleSlotByAppointment[appt.id]; if (!slot) return;
    if (appointments.some((a) => a.id !== appt.id && a.status !== "cancelled" && a.clinicId === appt.clinicId && a.surgeonId === appt.surgeonId && a.slot === slot)) { toast({ title: tr("slotTaken"), variant: "error" }); return; }
    const nextSlotId = resolveSlotIdFromLookup(slotLookup, appt.clinicId, appt.surgeonId, slot);
    if (!nextSlotId) { toast({ title: tr("slotUnavailable"), description: tr("reloadClinicsRetry"), variant: "error" }); return; }

    updateAppointment(appt.id, { slotId: nextSlotId, status: "pending" })
      .then((updated) => {
        const mapped = mapAppointmentFromBackend(updated, clinics, slotLookup, appt.petName, appt.ownerName, appt.ownerPhone);
        setAppointments((prev) => prev.map((a) => (a.id === appt.id ? mapped : a)));
        toast({ title: tr("rescheduled"), variant: "success" });
      })
      .catch((error: unknown) => {
        toast({ title: tr("failedReschedule"), description: error instanceof Error ? error.message : "Unable to update appointment", variant: "error" });
      });
  }
  async function handleSendInquiry(clinic: ClinicDirectoryRecord, surgeon: ClinicDirectoryRecord["surgeons"][number]) {
    const key = `${clinic.id}_${surgeon.id}`, msg = inquiryBySurgeon[key]?.trim(); if (!msg) return;
    const pet = pets.find((p) => p.id === (bookingPetByClinic[clinic.id] || pets[0]?.id));
    if (!pet) { toast({ title: tr("addPetFirst"), variant: "error" }); return; }
    try {
      const created = await createInquiry({
        clinicId: clinic.id, clinicName: clinic.name,
        surgeonId: surgeon.id, surgeonName: surgeon.name,
        petId: pet.id, petName: pet.name, message: msg,
      });
      setSurgeonInquiries((prev) => [created as SurgeonInquiryRecord, ...prev]);
      setInquiryBySurgeon((prev) => ({ ...prev, [key]: "" }));
      toast({ title: tr("inquirySent"), variant: "success" });
    } catch (err) {
      toast({ title: tr("actionFailed"), description: (err as Error).message, variant: "error" });
    }
  }
  /**
   * Owner adds a turn to an existing thread — usually answering the clarifying
   * question a vet's reply ends with. Rejected once the thread hits its cap.
   */
  async function handleDeleteAssessment() {
    const target = deletingAssessment;
    if (!target) return;
    setDeletingId(target.id);
    try {
      await deletePrediction(target.id);
      setPredictions((prev) => prev.filter((p) => p.id !== target.id));
      setDeletingAssessment(null);
      toast({ title: tr("assessmentRemoved"), variant: "success" });
    } catch (err) {
      toast({ title: (err as Error).message || tr("actionFailed"), variant: "error" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSendFollowUp(inquiryId: string) {
    const body = (followUpByInquiry[inquiryId] || "").trim();
    if (!body) return;
    setSendingFollowUpId(inquiryId);
    try {
      const updated = await sendInquiryMessage(inquiryId, body);
      setSurgeonInquiries((prev) => prev.map((inq) => (inq.id === inquiryId ? (updated as SurgeonInquiryRecord) : inq)));
      setFollowUpByInquiry((prev) => ({ ...prev, [inquiryId]: "" }));
      toast({ title: tr("messageSent"), variant: "success" });
    } catch (err) {
      toast({ title: (err as Error).message || tr("actionFailed"), variant: "error" });
    } finally {
      setSendingFollowUpId(null);
    }
  }
  async function handleSendMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const history = messages.map((m) => ({ role: m.sender, text: m.text }));
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, sender: "owner", text }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const { reply } = await sendChatMessage(text, history);
      setMessages((prev) => [...prev, { id: `msg-${Date.now() + 1}`, sender: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: `msg-${Date.now() + 1}`, sender: "assistant", text: tr("assistantError") }]);
    } finally {
      setChatLoading(false);
    }
  }

  function handlePrevOwnerCalendarMonth() {
    if (ownerCalendarMonth === 0) {
      setOwnerCalendarMonth(11);
      setOwnerCalendarYear((prev) => prev - 1);
      return;
    }
    setOwnerCalendarMonth((prev) => prev - 1);
  }

  function handleNextOwnerCalendarMonth() {
    if (ownerCalendarMonth === 11) {
      setOwnerCalendarMonth(0);
      setOwnerCalendarYear((prev) => prev + 1);
      return;
    }
    setOwnerCalendarMonth((prev) => prev + 1);
  }

  const highRisk = predictions.find((p) => p.risk === "high");
  const activeAppts = appointments.filter((a) => a.status !== "cancelled").length;
  const ownerToday = new Date();
  const isOwnerCurrentCalendarMonth = ownerToday.getFullYear() === ownerCalendarYear && ownerToday.getMonth() === ownerCalendarMonth;
  const ownerBookedDaysThisMonth = useMemo(() => {
    const days = new Set<number>();
    appointments.forEach((appointment) => {
      if (!appointment.bookedAt) return;
      const date = new Date(appointment.bookedAt);
      if (Number.isNaN(date.getTime())) return;
      if (date.getFullYear() === ownerCalendarYear && date.getMonth() === ownerCalendarMonth) {
        days.add(date.getDate());
      }
    });
    return days;
  }, [appointments, ownerCalendarMonth, ownerCalendarYear]);
  const ownerCalendarWeeks = useMemo(() => {
    const firstDayOfMonth = new Date(ownerCalendarYear, ownerCalendarMonth, 1).getDay();
    const daysInMonth = new Date(ownerCalendarYear, ownerCalendarMonth + 1, 0).getDate();
    const cells: Array<number | null> = [
      ...Array.from({ length: firstDayOfMonth }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, weekIndex) => cells.slice(weekIndex * 7, weekIndex * 7 + 7));
  }, [ownerCalendarMonth, ownerCalendarYear]);
  const editingPetId = new URLSearchParams(location.search).get("edit");
  const petProfileRoutePetId = location.pathname.match(/^\/pets\/profile\/([^/]+)$/)?.[1];
  const clinicRouteClinicId = location.pathname.match(/^\/pets\/clinic\/([^/]+)$/)?.[1];
  const isCreatePetRoute = location.pathname === "/pets/create";
  const isFlowRoute = Boolean(petProfileRoutePetId || clinicRouteClinicId || isCreatePetRoute);
  const headerTitle = petProfileRoutePetId
    ? (language === "si" ? "සුරතල් විස්තර" : language === "ta" ? "செல்லப்பிராணி விவரங்கள்" : "Pet Details")
    : clinicRouteClinicId
      ? (language === "si" ? "ක්ලිනික් විස්තර" : language === "ta" ? "கிளினிக் விவரங்கள்" : "Clinic Details")
      : isCreatePetRoute
        ? (editingPetId
            ? (language === "si" ? "සුරතල් පැතිකඩ සංස්කරණය" : language === "ta" ? "சுயவிவரத்தைத் திருத்து" : "Edit Pet Profile")
            : (language === "si" ? "සුරතල් පැතිකඩක් සාදන්න" : language === "ta" ? "சுயவிவரத்தை உருவாக்கு" : "Create Pet Profile"))
      : tr(navItems.find((n) => n.id === activeTab)?.labelKey ?? "navOverview");

  useEffect(() => {
    if (!isCreatePetRoute) return;
    if (!editingPetId) {
      setNewPet(EMPTY_PET_FORM);
      return;
    }

    const editTarget = pets.find((pet) => pet.id === editingPetId);
    if (!editTarget) return;

    setNewPet((prev) => ({
      ...prev,
      name: editTarget.name,
      species: editTarget.species,
      breed: editTarget.breed,
      age: editTarget.age,
      weightKg: editTarget.weightKg,
      photoDataUrl: editTarget.photoDataUrl || "",
      vaccinationName: editTarget.vaccinationName || "",
      vaccinationDate: editTarget.vaccinationDate || "",
      vaccinationFrequency: editTarget.vaccinationFrequency || "Annual",
      nextVaccinationDate: editTarget.nextVaccinationDate || "",
    }));
  }, [isCreatePetRoute, editingPetId, pets]);

  // The section now lives in the URL, so the PWA's back gesture walks sections
  // instead of dropping the user out of the dashboard.
  const { selectTab, canGoBack, goBack } = useTabRoute<Tab>({
    basePath: "/pets",
    tabs: OWNER_TABS,
    defaultTab: "home",
    activeTab,
    setActiveTab,
  });

  function handleSelectTab(tab: Tab) {
    selectTab(tab);
  }

  const resolvedDisplayName = profile.displayName.trim() || fallbackName;
  const firstName = resolvedDisplayName.trim().split(/\s+/)[0] || "Pet Owner";

  // ── RENDER ──
  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-secondary dark:bg-neutral-950">
      {/* ─── Sidebar ─── */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900 lg:flex">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-fg dark:bg-surface">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white dark:fill-neutral-900"><ellipse cx="12" cy="17.5" rx="3.5" ry="3" /><circle cx="8.2" cy="11.2" r="1.8" /><circle cx="15.8" cy="11.2" r="1.8" /><circle cx="6.5" cy="14.8" r="1.6" /><circle cx="17.5" cy="14.8" r="1.6" /></svg>
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-accent dark:text-white">PetCare AI</span>
        </div>

        <Separator className="dark:bg-neutral-800" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle">{tr("menu")}</p>
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => handleSelectTab(item.id)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-100",
                  activeTab === item.id
                    ? "bg-primary text-primary-fg shadow-sm"
                    : "text-accent-subtle hover:bg-surface-tertiary hover:text-accent-muted dark:text-accent-faint dark:hover:bg-primary dark:hover:text-neutral-200")}>
                <item.icon className="h-[15px] w-[15px]" />
                {tr(item.labelKey)}
              </button>
            ))}
          </div>

        </nav>

        {/* Theme */}
        <div className="px-3 pb-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>

        {/* Sidebar footer */}
        <div className="border-t border-border/80 p-3 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <Avatar className="h-7 w-7">
              {profile.photoDataUrl ? <AvatarImage src={profile.photoDataUrl} /> : null}
              <AvatarFallback className="text-[11px]">{firstName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-accent truncate dark:text-white">{resolvedDisplayName}</p>
              <p className="text-[10px] text-accent-faint dark:text-accent-subtle">{tr("petOwner")}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12px] font-medium text-accent-faint transition hover:bg-surface-tertiary hover:text-accent-muted dark:hover:bg-primary dark:hover:text-neutral-300">
            <LogOut className="h-3.5 w-3.5" />{tr("signOut")}
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-surface px-4 lg:px-8 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-3">
            {canGoBack && <BackButton onClick={goBack} label={tr("goBack")} />}
            <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="rounded-md p-1.5 text-accent-subtle hover:bg-surface-tertiary lg:hidden dark:hover:bg-primary"><Menu className="h-5 w-5" /></button>
            <div className="hidden h-5 w-px bg-neutral-200 lg:block dark:bg-neutral-700" />
            <h1 className="text-[13px] font-semibold text-accent dark:text-white">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <ThemeSwitcher compact />
            <Badge variant="outline" className="hidden sm:inline-flex gap-1"><Sparkles className="h-3 w-3" />{tr("aiActive")}</Badge>
            <NotificationCenter />
            <Avatar className="h-7 w-7 cursor-pointer" onClick={() => handleSelectTab("profile")}>
              {profile.photoDataUrl ? <AvatarImage src={profile.photoDataUrl} /> : null}
              <AvatarFallback className="text-[11px]">{firstName[0]}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Mobile nav */}
        {mobileNavOpen && (
          <div className="border-b border-border bg-surface p-2 lg:hidden animate-slide-down dark:border-neutral-800 dark:bg-neutral-900">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => { handleSelectTab(item.id); setMobileNavOpen(false); }}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                  activeTab === item.id ? "bg-surface-tertiary text-accent dark:bg-neutral-800 dark:text-white" : "text-accent-subtle dark:text-accent-faint")}>
                <item.icon className="h-4 w-4" />{tr(item.labelKey)}
              </button>
            ))}
            <Separator className="my-1 dark:bg-neutral-800" />
            <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-accent-faint"><LogOut className="h-4 w-4" />{tr("signOut")}</button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">
            {petProfileRoutePetId && (
              <PetProfilePage embedded petIdOverride={petProfileRoutePetId} onBack={goBack} />
            )}

            {clinicRouteClinicId && (
              <ClinicDetailsPage embedded clinicIdOverride={clinicRouteClinicId} onBack={goBack} />
            )}

            {isCreatePetRoute && (
              <div className="max-w-2xl space-y-6 animate-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-accent">{editingPetId ? "Edit Pet Profile" : "Create Pet Profile"}</h2>
                    <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{editingPetId ? "Update your pet information and photo" : "Add your pet information and photo"}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigate("/pets?tab=pets")}>{tr("back")}</Button>
                </div>

                <div className="rounded-xl border border-border/80 bg-surface p-5 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5"><Label className="text-[12px]">{tr("name")}</Label><Input value={newPet.name} onChange={(e) => setNewPet((p) => ({ ...p, name: e.target.value }))} placeholder={tr("petName")} /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">{tr("species")}</Label>
                      <select value={newPet.species} onChange={(e) => setNewPet((p) => ({ ...p, species: e.target.value, breed: "" }))} className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"><option>{tr("dog")}</option><option>{tr("cat")}</option></select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">{tr("breed")}</Label>
                      <select
                        value={newPet.breed}
                        onChange={(e) => setNewPet((p) => ({ ...p, breed: e.target.value }))}
                        className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                      >
                        <option value="">{tr("selectBreed")}</option>
                        {(breedsBySpecies[newPet.species] ?? []).map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-[12px]">{tr("ageYearsLabel")}</Label><Input value={newPet.age} onChange={(e) => setNewPet((p) => ({ ...p, age: e.target.value }))} placeholder="e.g. 3" /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">{tr("weightKgLabel")}</Label><Input value={newPet.weightKg} onChange={(e) => setNewPet((p) => ({ ...p, weightKg: e.target.value }))} placeholder="e.g. 12" /></div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border/80 bg-surface-secondary p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <h3 className="text-[13px] font-semibold text-accent">{tr("vaccinationDetails")}</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label className="text-[12px]">{tr("vaccineName")}</Label><Input value={newPet.vaccinationName} onChange={(e) => setNewPet((p) => ({ ...p, vaccinationName: e.target.value }))} placeholder={tr("egRabies")} /></div>
                      <div className="space-y-1.5"><Label className="text-[12px]">{tr("lastVaccinationDate")}</Label><Input type="date" value={newPet.vaccinationDate} onChange={(e) => setNewPet((p) => ({ ...p, vaccinationDate: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label className="text-[12px]">{tr("frequency")}</Label>
                        <select value={newPet.vaccinationFrequency} onChange={(e) => setNewPet((p) => ({ ...p, vaccinationFrequency: e.target.value }))} className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"><option>{tr("annual")}</option><option>{tr("everySixMonths")}</option><option>{tr("custom")}</option></select>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[12px]">{tr("nextDueDateOptional")}</Label><Input type="date" value={newPet.nextVaccinationDate} onChange={(e) => setNewPet((p) => ({ ...p, nextVaccinationDate: e.target.value }))} /></div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label className="text-[12px] font-medium text-accent-muted">{tr("petPhoto")}</Label>
                    <Dropzone
                      value={newPet.photoDataUrl || undefined}
                      cropShape="rect"
                      onChange={(url) => setNewPet((p) => ({ ...p, photoDataUrl: url }))}
                      onClear={() => setNewPet((p) => ({ ...p, photoDataUrl: "" }))}
                      label={tr("dragDropBrowse")}
                      hint="PNG, JPG, or WEBP — maximum 5 MB"
                    />
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Button
                      size="sm"
                      disabled={savingPet}
                      onClick={async () => {
                        const success = editingPetId ? await handleUpdatePet(editingPetId) : await handleAddPet();
                        if (success) navigate("/pets?tab=pets");
                      }}
                    >
                      {editingPetId ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {savingPet ? "..." : (editingPetId ? tr("saveChanges") : (language === "si" ? "සුරතල් පැතිකඩක් සාදන්න" : language === "ta" ? "சுயவிவரத்தை உருவாக்கு" : "Create Pet Profile"))}
                    </Button>
                    {editingPetId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletingPetId === editingPetId}
                        onClick={async () => {
                          if (!confirm(tr("deletePetConfirm"))) return;
                          const success = await handleDeletePet(editingPetId);
                          if (success) navigate("/pets?tab=pets");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />{tr("delete")}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="secondary" onClick={() => navigate("/pets?tab=pets")}>{tr("cancel")}</Button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ HOME ═══ */}
            {activeTab === "home" && !isFlowRoute && (
              <div className="space-y-5 animate-in">
                {/* Top section */}
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
                  {/* Left: welcome, stats, compact vaccine reminder */}
                  <div className="space-y-4">
                    <h2 className="text-2xl font-semibold tracking-tight text-accent dark:text-white">{tr("welcomeBack")} {firstName}</h2>
                    <p className="mt-1 text-sm text-accent-subtle dark:text-accent-faint">{language === "si" ? "ඔබේ සුරතලුන් සමඟ අද සිදුවන දේ මෙන්න." : language === "ta" ? "இன்று உங்கள் செல்லப்பிராணிகளுடன் நடப்பது இதோ." : "Here's what's happening with your pets today."}</p>

                    {/* Stats row */}
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: tr("navPets"), value: pets.length, icon: PawPrint, onClick: () => handleSelectTab("pets") },
                        { label: tr("appointments"), value: activeAppts, icon: Calendar, onClick: () => handleSelectTab("clinics") },
                        { label: tr("assessments"), value: predictions.length, icon: Brain, onClick: () => handleSelectTab("ai") },
                        // Health score derived from the most recent assessment's risk (— when none yet)
                        { label: tr("healthScore"), value: predictions.length === 0 ? "—" : (predictions[0].risk === "high" ? "45%" : predictions[0].risk === "moderate" ? "70%" : "90%"), icon: Activity, onClick: () => handleSelectTab("ai") },
                      ].map((s) => (
                        <button key={s.label} onClick={s.onClick} className="group rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900 p-4 text-left transition-all hover:border-border-strong hover:shadow-sm">
                          <div className="flex items-center justify-between">
                            <s.icon className="h-4 w-4 text-accent-faint group-hover:text-accent-muted transition-colors" />
                            <ChevronRight className="h-3.5 w-3.5 text-neutral-200 group-hover:text-accent-faint transition-colors" />
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-accent dark:text-white">{s.value}</p>
                          <p className="mt-0.5 text-[12px] text-accent-subtle dark:text-accent-faint">{s.label}</p>
                        </button>
                      ))}
                    </div>

                    {/* Announcements published by an administrator */}
                    {visibleAnnouncements.map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          "mt-4 w-full max-w-[560px] rounded-xl border px-4 py-3",
                          a.severity === "warning"
                            ? "border-red-200/60 bg-red-50/60"
                            : "border-sky-200/60 bg-sky-50/60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                              a.severity === "warning" ? "bg-red-100" : "bg-sky-100",
                            )}>
                              <Megaphone className={cn("h-4 w-4", a.severity === "warning" ? "text-red-600" : "text-sky-600")} />
                            </div>
                            <div>
                              <p className={cn(
                                "text-[13px] font-medium",
                                a.severity === "warning" ? "text-red-900" : "text-sky-900",
                              )}>{a.title}</p>
                              <p className={cn(
                                "text-[12px]",
                                a.severity === "warning" ? "text-red-700/80" : "text-sky-700/80",
                              )}>{a.body}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => dismissAnnouncement(a.id)}
                            className="shrink-0 rounded-md p-1 text-accent-faint transition hover:bg-white/60 hover:text-accent"
                            aria-label={tr("dismissLabel")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Vaccination banner — only when a record is actually due */}
                    {dueVaccination ? (
                      <div className="mt-4 w-full max-w-[560px] rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                              <Syringe className="h-4 w-4 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-amber-900">
                                {dueVaccination.days <= 0
                                  ? (language === "si" ? `${dueVaccination.petName} සඳහා ${dueVaccination.vaccineName} අදම නියමිතයි` : language === "ta" ? `${dueVaccination.petName}க்கு ${dueVaccination.vaccineName} இன்றே நிலுவை` : `${dueVaccination.vaccineName} is due today for ${dueVaccination.petName}`)
                                  : dueVaccination.days === 1
                                    ? (language === "si" ? `${dueVaccination.petName} සඳහා ${dueVaccination.vaccineName} හෙට නියමිතයි` : language === "ta" ? `${dueVaccination.petName}க்கு ${dueVaccination.vaccineName} நாளை நிலுவை` : `${dueVaccination.vaccineName} is due tomorrow for ${dueVaccination.petName}`)
                                    : (language === "si" ? `${dueVaccination.petName} සඳහා ${dueVaccination.vaccineName} දින ${dueVaccination.days}කින් නියමිතයි` : language === "ta" ? `${dueVaccination.petName}க்கு ${dueVaccination.vaccineName} ${dueVaccination.days} நாட்களில் நிலுவை` : `${dueVaccination.vaccineName} is due in ${dueVaccination.days} days for ${dueVaccination.petName}`)}
                              </p>
                              <p className="text-[12px] text-amber-700/70">{language === "si" ? "එන්නත් වාර්තා පරීක්ෂා කර ඉදිරි බූස්ටර වෙන් කරන්න." : language === "ta" ? "தடுப்பூசி பதிவுகளைச் சரிபார்த்து அடுத்த பூஸ்டரை பதிவு செய்யவும்." : "Check vaccination records and schedule upcoming boosters."}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="secondary" onClick={() => handleSelectTab("clinics")}>
                            {language === "si" ? "වෙන් කරන්න" : language === "ta" ? "பதிவு செய்" : "Schedule"} <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {/* Your pets moved up to reduce whitespace */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[15px] font-semibold text-accent">{tr("yourPets")}</h3>
                        <button onClick={() => (pets[0] ? navigate(`/pets/profile/${pets[0].id}`) : navigate("/pets/create"))} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-subtle hover:text-accent transition-colors">
                          View all <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {pets.slice(0, 4).map((pet) => (
                          <div key={pet.id} className="group flex items-center gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 transition-all hover:border-border-strong hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 cursor-pointer" onClick={() => navigate(`/pets/profile/${pet.id}`)}>
                            <Avatar className="h-11 w-11 rounded-xl ring-2 ring-neutral-100">
                              {pet.photoDataUrl ? <AvatarImage src={pet.photoDataUrl} alt={pet.name} className="rounded-xl object-cover" /> : null}
                              <AvatarFallback className="rounded-xl text-lg bg-surface-tertiary">{pet.emoji}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-accent dark:text-white">{pet.name}</p>
                              <p className="text-[12px] text-accent-subtle">{pet.breed}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[12px] font-medium text-accent-muted">{pet.age}y</p>
                              <p className="text-[11px] text-accent-faint">{pet.weightKg} kg</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-neutral-200 transition-colors group-hover:text-accent-faint" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: urgent insight + calendar */}
                  <div className="w-full space-y-4 lg:w-[360px]">
                    {highRisk ? (
                      <div className="rounded-xl border border-red-200/60 bg-gradient-to-br from-red-50 to-white p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[13px] font-semibold text-red-900">{tr("attentionRequired")}</p>
                            <p className="mt-0.5 text-[12px] leading-relaxed text-red-700/80">
                              {highRisk.pet}'s {highRisk.title.toLowerCase()} assessment shows <span className="font-medium text-red-800">high risk</span> with {highRisk.confidence}% confidence.
                            </p>
                            <Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700" onClick={() => handleSelectTab("clinics")}>
                              Book appointment <ArrowRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-border/80 bg-surface p-4 dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handlePrevOwnerCalendarMonth}
                          className="rounded bg-surface-tertiary px-2 py-1 text-xs font-semibold text-accent-muted hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
                        >
                          Prev
                        </button>
                        <div className="flex items-center gap-2">
                          <select
                            value={ownerCalendarMonth}
                            onChange={(e) => setOwnerCalendarMonth(Number(e.target.value))}
                            className="rounded-md border border-border bg-surface px-2 py-1 text-sm font-semibold text-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          >
                            {DASHBOARD_CALENDAR_MONTHS.map((month, index) => (
                              <option key={month} value={index}>{month}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1900}
                            max={9999}
                            value={ownerCalendarYear}
                            onChange={(e) => {
                              const nextYear = Number(e.target.value);
                              if (!Number.isNaN(nextYear)) {
                                setOwnerCalendarYear(nextYear);
                              }
                            }}
                            className="w-[88px] rounded-md border border-border bg-surface px-2 py-1 text-sm font-semibold text-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleNextOwnerCalendarMonth}
                          className="rounded bg-surface-tertiary px-2 py-1 text-xs font-semibold text-accent-muted hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
                        >
                          Next
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-accent-faint">
                        {DASHBOARD_CALENDAR_WEEKDAYS.map((weekday) => (
                          <div key={weekday}>{weekday}</div>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-7 gap-1">
                        {ownerCalendarWeeks.flat().map((day, index) => {
                          if (!day) return <div key={`pet-empty-${index}`} className="h-8 rounded-md bg-transparent" />;
                          const isToday = isOwnerCurrentCalendarMonth && day === ownerToday.getDate();
                          const hasAppointment = ownerBookedDaysThisMonth.has(day);
                          return (
                            <div
                              key={`pet-day-${day}-${index}`}
                              className={cn(
                                "flex h-8 items-center justify-center rounded-md text-xs font-medium",
                                isToday
                                  ? "bg-blue-600 text-white"
                                  : hasAppointment
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "bg-surface-tertiary text-accent-muted dark:bg-neutral-800/70 dark:text-neutral-200",
                              )}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk assessments */}
                <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-accent">{tr("riskAssessments")}</h3>
                        <Badge variant="info" className="gap-1"><Sparkles className="h-2.5 w-2.5" />AI</Badge>
                      </div>
                      <button onClick={() => handleSelectTab("ai")} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-subtle hover:text-accent transition-colors">
                        {tr("history")} <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {predictions.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border/80 bg-surface p-4 text-center text-[13px] text-accent-subtle dark:border-neutral-800 dark:bg-neutral-900">
                          {tr("noAssessmentsYet")}
                        </div>
                      )}
                      {predictions.map((item) => (
                        <div key={item.id} className="rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900 p-4 transition-all hover:border-border-strong hover:shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", item.risk === "high" ? "bg-red-50" : item.risk === "moderate" ? "bg-amber-50" : "bg-emerald-50")}>
                                <TrendingUp className={cn("h-4 w-4", riskColors[item.risk])} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-accent dark:text-white">{item.title}</p>
                                <p className="text-[11px] text-accent-subtle">{item.pet} &middot; {item.age}</p>
                              </div>
                            </div>
                            <Badge variant={item.variant} className="shrink-0">{riskLabel(item.risk)}</Badge>
                          </div>
                          {/* Risk score bar */}
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-[11px] text-accent-faint">{tr("riskScoreLabel")}</span>
                            <div className="flex-1">
                              <div className="h-1.5 w-full rounded-full bg-surface-tertiary dark:bg-neutral-800">
                                <div className={cn("h-1.5 rounded-full transition-all duration-700", riskBg[item.risk])} style={{ width: `${item.riskScore}%` }} />
                              </div>
                            </div>
                            <span className="text-[11px] font-medium text-accent-subtle">{item.riskScore}/100</span>
                          </div>
                          {/* Recommendation */}
                          <p className="mt-2.5 text-[12px] leading-relaxed text-accent-subtle">
                            <span className="font-medium text-accent-muted">{tr("recommendationLabel")}</span> {item.recommendation}
                          </p>
                          <div className="mt-3 flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingAssessment(item)}
                              disabled={deletingId === item.id}
                              aria-label={tr("deleteAssessment")}
                            >
                              <Trash2 className="h-3 w-3" /> {tr("delete")}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const matchedPet = pets.find((p) => p.name.toLowerCase() === item.pet.toLowerCase());
                                const predictionPetId = matchedPet?.id || pets[0]?.id;
                                if (!predictionPetId) {
                                  toast({ title: tr("addPetFirst"), variant: "error" });
                                  navigate("/pets/create");
                                  return;
                                }
                                navigate(`/pets/prediction/${predictionPetId}?prediction=${encodeURIComponent(item.id)}`);
                              }}
                            >
                              {tr("viewReport")} <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                </div>
              </div>
            )}

            {/* ═══ PETS ═══ */}
            {activeTab === "pets" && !isFlowRoute && (
              <div className="space-y-6 animate-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-accent">{tr("myPets")}</h2>
                    <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{tr("managePetProfiles")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{pets.length} registered</Badge>
                    <Button size="sm" onClick={() => navigate("/pets/create")}><Plus className="h-3.5 w-3.5" />{tr("add")}</Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {petsLoading && (
                    <div className="rounded-xl border border-border/80 bg-surface p-4 text-sm text-accent-subtle dark:border-neutral-800 dark:bg-neutral-900">
                      Loading pets...
                    </div>
                  )}
                  {pets.map((pet) => (
                    <div key={pet.id} onClick={() => navigate(`/pets/profile/${pet.id}`)} className="group cursor-pointer rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900 p-4 transition-all hover:border-border-strong hover:shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 rounded-xl ring-2 ring-neutral-100">
                            {pet.photoDataUrl ? <AvatarImage src={pet.photoDataUrl} alt={pet.name} className="rounded-xl object-cover" /> : null}
                            <AvatarFallback className="rounded-xl text-xl bg-surface-tertiary">{pet.emoji}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[14px] font-semibold text-accent dark:text-white">{pet.name}</p>
                            <p className="text-[12px] text-accent-subtle">{pet.species} &middot; {pet.breed}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pets/create?edit=${pet.id}`);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-accent-faint" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deletingPetId === pet.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleDeletePet(pet.id);
                            }}
                            className="disabled:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-accent-faint" />
                          </Button>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg bg-surface-secondary dark:bg-neutral-800 px-3 py-2">
                          <p className="text-[15px] font-semibold text-accent dark:text-white">{pet.age}</p>
                          <p className="text-[10px] text-accent-faint">{tr("yearsOld")}</p>
                        </div>
                        <div className="rounded-lg bg-surface-secondary dark:bg-neutral-800 px-3 py-2">
                          <p className="text-[15px] font-semibold text-accent dark:text-white">{pet.weightKg}</p>
                          <p className="text-[10px] text-accent-faint">{tr("kgWeight")}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => navigate(`/pets/profile/${pet.id}`)}>
                        View details
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ AI CHAT ═══ */}
            {activeTab === "ai" && !isFlowRoute && (
              <div className="flex h-[calc(100vh-8rem)] flex-col animate-in">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-accent">{tr("aiHealthAssistant")}</h2>
                    <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{tr("describeSymptomsGuidance")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="gap-1"><Sparkles className="h-3 w-3" />{tr("poweredByAI")}</Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (!pets[0]) {
                          toast({ title: tr("addPetFirst"), variant: "error" });
                          navigate("/pets/create");
                          return;
                        }
                        navigate(`/pets/symptoms/${pets[0].id}`);
                      }}
                    >
                      {tr("structuredForm")}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900 p-5">
                  <div className="mx-auto max-w-2xl space-y-3">
                    {messages.map((m) => (
                      <div key={m.id} className={cn("max-w-[80%] rounded-xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                        m.sender === "owner" ? "ml-auto bg-primary text-primary-fg" : "bg-surface-secondary text-neutral-800 border border-neutral-100 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700")}>
                        {m.sender === "assistant" && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-faint">{tr("aiAssistant")}</p>}
                        {m.text}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="max-w-[80%] rounded-xl border border-neutral-100 bg-surface-secondary px-4 py-2.5 text-[13px] text-accent-subtle dark:border-neutral-700 dark:bg-neutral-800">
                        {tr("assistantThinking")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }} placeholder={tr("describeSymptomsPlaceholder")} className="flex-1" disabled={chatLoading} />
                  <Button onClick={handleSendMessage} disabled={chatLoading || !chatInput.trim()}><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {/* ═══ CLINICS ═══ */}
            {activeTab === "clinics" && !isFlowRoute && (
              <div className="space-y-6 animate-in">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-xl font-semibold text-accent">{tr("clinicsAppointments")}</h2><p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{tr("findClinicsManage")}</p></div>
                  {nearbyClinics.length > 0 && <Badge variant="success">{nearbyClinics.length} available</Badge>}
                </div>
                {locationError && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800"><Info className="h-4 w-4 shrink-0" />{locationError}</div>}

                {userLocation && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-surface px-4 py-2 text-[12px] text-accent-subtle dark:border-neutral-800 dark:bg-neutral-900">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="font-medium text-accent dark:text-white">{tr("yourLocation")}:</span>
                    <span>{userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}</span>
                    {userLocation.accuracyKm != null && userLocation.accuracyKm > 2 ? (
                      <span className="text-amber-600 dark:text-amber-400">±{userLocation.accuracyKm} km — {tr("locationApprox")}</span>
                    ) : null}
                  </div>
                )}

                {userLocation && nearbyClinics.length > 0 && (() => {
                  const nearest = nearbyClinics
                    .map((clinic) => (typeof clinic.latitude === "number" && typeof clinic.longitude === "number"
                      ? distanceKm(userLocation.latitude, userLocation.longitude, clinic.latitude, clinic.longitude)
                      : Infinity))
                    .reduce((min, value) => Math.min(min, value), Infinity);
                  return nearest > 25 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-info/40 bg-info-light px-4 py-2.5 text-[13px] text-accent-muted dark:bg-primary/10 dark:text-neutral-300">
                      <Info className="h-4 w-4 shrink-0 text-info" />
                      {tr("noNearbyRegistered").replace("{km}", "25")}
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const mapClinics: MapClinic[] = [
                    ...nearbyClinics
                      .filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number")
                      .map((c) => ({ id: c.id, name: c.name, latitude: c.latitude as number, longitude: c.longitude as number, external: false })),
                    ...externalClinics.map((c) => ({ id: `ext-${c.id}`, name: c.name, latitude: c.latitude, longitude: c.longitude, distanceKm: c.distanceKm, external: true })),
                  ];
                  if (!userLocation && mapClinics.length === 0) return null;
                  return (
                    <div>
                      <h3 className="mb-2 text-[13px] font-semibold text-accent">{tr("nearbyClinicsMap")}</h3>
                      <ClinicMap userLocation={userLocation} clinics={mapClinics} />
                    </div>
                  );
                })()}

                {appointments.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-accent">{tr("myAppointments")}</h3>
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                      {appointments.map((appt) => {
                        const clinic = clinics.find((c) => c.id === appt.clinicId);
                        const surgeon = clinic?.surgeons.find((s) => s.id === appt.surgeonId);
                        const slots = surgeon?.availableSlots ?? [];
                        return (
                          <div key={appt.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Calendar className="h-4 w-4 shrink-0 text-accent-faint" />
                                <div className="min-w-0"><p className="text-[13px] font-medium text-accent truncate">{appt.clinicName}</p><p className="text-[12px] text-accent-subtle">{appt.surgeonName} &middot; {appt.slot} &middot; {appt.petName}</p></div>
                              </div>
                              <Badge variant={appt.status === "confirmed" ? "success" : appt.status === "cancelled" ? "danger" : "warning"}>{statusLabel(appt.status)}</Badge>
                            </div>
                            {appt.status !== "cancelled" && slots.length > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <select value={rescheduleSlotByAppointment[appt.id] || ""} onChange={(e) => setRescheduleSlotByAppointment((p) => ({ ...p, [appt.id]: e.target.value }))} className="h-7 flex-1 rounded border border-border px-2 text-xs text-accent-muted focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                                  <option value="">{tr("rescheduleTo")}</option>{slots.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <Button size="sm" variant="secondary" onClick={() => handleRescheduleAppointment(appt)}>{tr("reschedule")}</Button>
                                <Button size="sm" variant="ghost" onClick={() => handleCancelAppointment(appt.id)}><X className="h-3.5 w-3.5 text-accent-faint" /></Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {nearbyClinics.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-strong bg-surface px-4 py-10 text-center"><MapPin className="mx-auto mb-2 h-5 w-5 text-neutral-300" /><p className="text-sm text-accent-subtle">{tr("noClinicsYet")}</p></div>
                ) : nearbyClinics.map((clinic) => (
                  <div key={clinic.id} className="rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-start justify-between p-5">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/pets/clinic/${clinic.id}`)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/pets/clinic/${clinic.id}`); } }}
                        className="group flex-1 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <p className="text-[14px] font-semibold text-accent dark:text-white group-hover:underline">{clinic.name}</p>
                        <p className="mt-0.5 text-[12px] text-accent-subtle">{clinic.address} &middot; {clinic.phone}</p>
                        <Badge variant="info" className="mt-1.5">{clinic.specialization}</Badge>
                        {userLocation && typeof clinic.latitude === "number" && typeof clinic.longitude === "number" && <p className="mt-1 text-[11px] text-accent-faint">{distanceKm(userLocation.latitude, userLocation.longitude, clinic.latitude, clinic.longitude).toFixed(1)} km away</p>}
                        <p className="mt-1.5 text-[11px] font-medium text-primary group-hover:underline">{language === "si" ? "විස්තර බලන්න →" : language === "ta" ? "விவரங்களைக் காண்க →" : "View details →"}</p>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[11px]">{language === "si" ? "සුරතලා" : language === "ta" ? "பிராணி" : "Pet"}</Label><select value={bookingPetByClinic[clinic.id] || pets[0]?.id || ""} onChange={(e) => setBookingPetByClinic((p) => ({ ...p, [clinic.id]: e.target.value }))} disabled={!pets.length} className="h-7 rounded border border-border px-2 text-xs focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{pets.length ? pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">{tr("addPetFirst")}</option>}</select></div>
                    </div>
                    {clinic.surgeons.length > 0 && (
                      <div className="border-t border-neutral-100 dark:border-neutral-800 p-5 pt-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-accent-faint">{tr("surgeonsAvailability")}</p>
                        <div className="space-y-4">
                          {clinic.surgeons.map((surgeon) => (
                            <div key={surgeon.id}>
                              <p className="text-[13px] font-medium text-accent dark:text-white">{surgeon.name}</p>
                              <p className="text-[11px] text-accent-subtle">{surgeon.specialization}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {surgeon.availableSlots.length === 0 ? <span className="text-[11px] text-accent-faint">{tr("noSlots")}</span> : surgeon.availableSlots.map((slot) => {
                                  const booked = isSlotBooked(clinic.id, surgeon.id, slot);
                                  return <button key={slot} onClick={() => requestBooking(clinic, surgeon, slot)} disabled={booked} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition", booked ? "bg-surface-tertiary text-accent-faint cursor-not-allowed dark:bg-neutral-800 dark:text-accent-muted" : "bg-primary text-primary-fg hover:bg-primary-hover")}><Clock className="h-3 w-3" />{slot}</button>;
                                })}
                              </div>
                              <div className="mt-2 flex gap-2"><Input value={inquiryBySurgeon[`${clinic.id}_${surgeon.id}`] || ""} onChange={(e) => setInquiryBySurgeon((p) => ({ ...p, [`${clinic.id}_${surgeon.id}`]: e.target.value }))} placeholder={tr("sendInquiryPlaceholder")} className="h-7 flex-1 text-xs" /><Button size="sm" variant="secondary" onClick={() => handleSendInquiry(clinic, surgeon)}><Send className="h-3 w-3" /></Button></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {surgeonInquiries.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-accent">{tr("inquiries")}</h3>
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                      {/* A bounded thread rather than a single question: a vet's
                          answer is usually a clarifying question, and without a
                          way to answer it the conversation dead-ended here. */}
                      {surgeonInquiries.slice(0, 8).map((inq) => (
                        <div key={inq.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-accent dark:text-white">{inq.surgeonName}</p>
                              <p className="text-[11px] text-accent-faint">{inq.petName}</p>
                            </div>
                            <Badge variant={inq.status === "answered" ? "success" : inq.status === "closed" ? "info" : "warning"}>
                              {statusLabel(inq.status)}
                            </Badge>
                          </div>

                          <div className="mt-2 space-y-2">
                            {(inq.messages ?? []).map((msg, index) => (
                              <div
                                key={index}
                                className={cn(
                                  "rounded-lg px-3 py-2 text-[12px]",
                                  msg.senderRole === "vet"
                                    ? "ml-6 border-l-2 border-primary/50 bg-surface-tertiary/40 dark:bg-neutral-800/40"
                                    : "mr-6 bg-surface-tertiary/20 dark:bg-neutral-800/20"
                                )}
                              >
                                <p className="text-[11px] font-medium text-accent-subtle">
                                  {msg.senderRole === "vet" ? tr("vetReply") : tr("threadYouLabel")}
                                  {" · "}
                                  {new Date(msg.createdAt).toLocaleString()}
                                </p>
                                <p className="mt-0.5 text-accent dark:text-white">{msg.body}</p>
                              </div>
                            ))}
                          </div>

                          {inq.status === "closed" ? (
                            <p className="mt-2 text-[11px] text-accent-subtle">{tr("threadClosedOwner")}</p>
                          ) : (
                            <div className="mt-2 flex items-center gap-2">
                              <Input
                                value={followUpByInquiry[inq.id] || ""}
                                onChange={(e) => setFollowUpByInquiry((p) => ({ ...p, [inq.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSendFollowUp(inq.id); }}
                                placeholder={tr("followUpPlaceholder")}
                                className="h-7 flex-1 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleSendFollowUp(inq.id)}
                                disabled={!(followUpByInquiry[inq.id] || "").trim() || sendingFollowUpId === inq.id}
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {externalClinics.length > 0 && (
                  <div className="mt-2">
                    <div className="mb-2">
                      <h3 className="text-[13px] font-semibold text-accent dark:text-white">{tr("alsoNearby")}</h3>
                      <p className="text-[11px] text-accent-subtle">{tr("alsoNearbyHint")}</p>
                    </div>
                    <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-surface dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
                      {externalClinics.slice(0, 10).map((clinic) => (
                        <div key={clinic.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[13px] font-medium text-accent dark:text-white">{clinic.name}</p>
                              <Badge variant="outline">{tr("notOnPlatform")}</Badge>
                            </div>
                            <p className="truncate text-[11px] text-accent-subtle">
                              {clinic.address || "—"}{clinic.distanceKm != null ? ` · ${clinic.distanceKm.toFixed(1)} km` : ""}
                            </p>
                          </div>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${clinic.latitude},${clinic.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-accent transition hover:border-primary dark:border-neutral-700"
                          >
                            <MapPin className="h-3 w-3" />{tr("directions")}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ PROFILE ═══ */}
            {activeTab === "profile" && !isFlowRoute && (
              <div className="max-w-2xl space-y-6 animate-in">
                <div><h2 className="text-xl font-semibold text-accent">{tr("navAccount")}</h2><p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{tr("manageProfileInfo")}</p></div>
                <div className="rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900 p-5">
                  {profileLoading ? <p className="mb-4 text-sm text-accent-subtle dark:text-accent-faint">{tr("loadingProfile")}</p> : null}
                  <div className="mb-5 space-y-2">
                    <Label className="text-[12px] font-medium text-accent-muted">{tr("profilePhoto")}</Label>
                    <Dropzone
                      value={profile.photoDataUrl}
                      disabled={!isProfileEditing}
                      avatar
                      cropShape="round"
                      onChange={(url) => { setProfile((p) => ({ ...p, photoDataUrl: url })); }}
                      onClear={() => { setProfile((p) => ({ ...p, photoDataUrl: undefined })); }}
                      label={tr("profilePhotoChoose")}
                      hint="Tap to upload and crop"
                    />
                  </div>
                  <Separator className="mb-5" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-[12px]">{tr("fullName")}</Label><Input disabled={!isProfileEditing} value={profile.displayName} onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">{tr("email")}</Label><Input disabled value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} placeholder="you@email.com" /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">{tr("phone")}</Label><Input disabled={!isProfileEditing} value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder={tr("phoneNumber")} /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">{tr("dateOfBirth")}</Label><Input disabled={!isProfileEditing} type="date" value={profile.dateOfBirth} onChange={(e) => setProfile((p) => ({ ...p, dateOfBirth: e.target.value }))} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label className="text-[12px]">{tr("address")}</Label><Input disabled={!isProfileEditing} value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} placeholder={tr("address")} /></div>
                  </div>
                  <Separator className="my-5" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isProfileEditing ? (
                        <>
                          <Button size="sm" onClick={handleSaveProfile} disabled={profileSaving}><Save className="h-3.5 w-3.5" />{profileSaving ? "Saving..." : "Save changes"}</Button>
                          <Button size="sm" variant="secondary" onClick={() => { if (profileBeforeEdit) setProfile(profileBeforeEdit); setIsProfileEditing(false); setProfileBeforeEdit(null); }}>{tr("cancel")}</Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => { setProfileBeforeEdit(profile); setIsProfileEditing(true); }}><Pencil className="h-3.5 w-3.5" />{tr("editProfile")}</Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { localStorage.removeItem(profileStorageKey); localStorage.removeItem(petsStorageKey); localStorage.removeItem(appointmentsStorageKey); localStorage.removeItem(inquiriesStorageKey); handleLogout(); }} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />Delete account
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Booking confirmation. Shows exactly which pet is being committed,
          since the pet defaults to the first in the list when not chosen. */}
      <Dialog open={Boolean(pendingBooking)} onOpenChange={(open) => { if (!open) setPendingBooking(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("confirmBookingTitle")}</DialogTitle>
            <DialogDescription>{tr("confirmBookingIntro")}</DialogDescription>
          </DialogHeader>

          {pendingBooking && (
            <div className="mt-4 space-y-2 rounded-lg border border-border/70 p-3 text-sm dark:border-neutral-800">
              <div className="flex justify-between gap-3">
                <span className="text-accent-subtle">{tr("navPets")}</span>
                <span className="font-medium text-accent dark:text-white">{pendingBooking.petName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-accent-subtle">{tr("clinic")}</span>
                <span className="text-right font-medium text-accent dark:text-white">{pendingBooking.clinic.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-accent-subtle">{tr("veterinarian")}</span>
                <span className="text-right font-medium text-accent dark:text-white">{pendingBooking.surgeon.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-accent-subtle">{tr("dateTime")}</span>
                <span className="font-medium text-accent dark:text-white">{pendingBooking.slot}</span>
              </div>
            </div>
          )}

          <p className="mt-3 text-[12px] text-accent-faint">{tr("bookingPendingNote")}</p>

          <div className="mt-4 flex gap-2">
            <Button className="flex-1" onClick={confirmPendingBooking}>{tr("confirmBooking")}</Button>
            <Button className="flex-1" variant="secondary" onClick={() => setPendingBooking(null)}>{tr("cancel")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deleting is the owner's call, but it should never happen on a stray
          tap - and the copy says plainly what it does and does not affect. */}
      <Dialog open={Boolean(deletingAssessment)} onOpenChange={(open) => { if (!open) setDeletingAssessment(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("deleteAssessment")}</DialogTitle>
            <DialogDescription>{tr("deleteAssessmentBody")}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingAssessment(null)}>{tr("cancel")}</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteAssessment}
              disabled={deletingId === deletingAssessment?.id}
            >
              {tr("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
