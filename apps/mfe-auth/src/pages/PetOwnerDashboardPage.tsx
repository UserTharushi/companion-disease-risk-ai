import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getProfileNameForRole, logout, saveProfileName } from "../lib/session";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { toast } from "../lib/use-toast";
import { ClinicDetailsPage, PetProfilePage } from "./PetOwnerFlowPages";
import {
  Home, PawPrint, Brain, MapPin, User, LogOut, Plus, Trash2, Save,
  Send, AlertTriangle, Calendar, Clock, ChevronRight, X, Menu,
  Activity, Syringe, TrendingUp, ArrowRight, Sparkles, Info,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Dropzone } from "../components/ui/dropzone";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { cn } from "../lib/utils";
import petBuddyImage from "../assets/images/pet-buddy.jpg";
import petLunaImage from "../assets/images/pet-luna.jpg";

// ── Storage keys ──
const CLINIC_DIRECTORY_KEY = "companion_ai_clinic_directory";
const PET_OWNER_PETS_KEY = "companion_ai_pet_owner_pets";
const PET_OWNER_PROFILE_KEY = "companion_ai_pet_owner_profile";
const PET_OWNER_APPOINTMENTS_KEY = "companion_ai_pet_owner_appointments";
const PET_OWNER_SURGEON_INQUIRIES_KEY = "companion_ai_pet_owner_surgeon_inquiries";

// ── Types ──
interface ClinicDirectoryRecord {
  id: string; name: string; address: string; phone: string; specialization: string;
  status: "active" | "inactive"; latitude?: number; longitude?: number;
  surgeons: Array<{ id: string; name: string; specialization: string; availableSlots: string[] }>;
}
interface PetRecord { id: string; name: string; species: string; breed: string; age: string; weightKg: string; emoji: string; photoDataUrl?: string; vaccinationName?: string; vaccinationDate?: string; vaccinationFrequency?: string; nextVaccinationDate?: string; }
interface OwnerProfile { displayName: string; email: string; phone: string; address: string; photoDataUrl?: string; }
interface AppointmentRecord { id: string; clinicId: string; clinicName: string; surgeonId: string; surgeonName: string; slot: string; petId: string; petName: string; ownerName: string; ownerPhone?: string; status: "pending" | "confirmed" | "cancelled"; bookedAt: string; }
interface SurgeonInquiryRecord { id: string; clinicId: string; clinicName: string; surgeonId: string; surgeonName: string; petId: string; petName: string; message: string; status: "open" | "replied"; createdAt: string; }
interface ChatMessage { id: string; sender: "owner" | "assistant"; text: string; }
type Tab = "home" | "pets" | "ai" | "clinics" | "profile";

const defaultPets: PetRecord[] = [
  { id: "pet-1", name: "Buddy", species: "Dog", breed: "Golden Retriever", age: "2", weightKg: "30", emoji: "🐕", photoDataUrl: petBuddyImage },
  { id: "pet-2", name: "Luna", species: "Cat", breed: "Siamese", age: "4", weightKg: "5", emoji: "🐈", photoDataUrl: petLunaImage },
];

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

const navItems: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: "home", label: "Overview", icon: Home },
  { id: "pets", label: "Pets", icon: PawPrint },
  { id: "ai", label: "AI Chat", icon: Brain },
  { id: "clinics", label: "Clinics", icon: MapPin },
  { id: "profile", label: "Account", icon: User },
];

const predictions = [
  { id: "1", title: "Hip Dysplasia Risk", pet: "Buddy", age: "2h ago", risk: "low" as const, confidence: 87, recommendation: "No immediate action. Continue regular exercise and weight management.", variant: "success" as const },
  { id: "2", title: "Glaucoma Check", pet: "Luna", age: "1d ago", risk: "moderate" as const, confidence: 63, recommendation: "Schedule an ophthalmologic exam within the next 2 weeks.", variant: "warning" as const },
  { id: "3", title: "Dietary Sensitivity", pet: "Buddy", age: "3d ago", risk: "high" as const, confidence: 91, recommendation: "Switch to hypoallergenic diet. Book a veterinary nutritionist consult.", variant: "danger" as const },
];

const defaultClinics: ClinicDirectoryRecord[] = [
  {
    id: "clinic-1", name: "Colombo Veterinary Hospital", address: "No. 275, Bauddhaloka Mawatha, Colombo 07", phone: "+94 11 269 4105",
    specialization: "General Practice & Surgery", status: "active", latitude: 6.9022, longitude: 79.8614,
    surgeons: [
      { id: "s1", name: "Dr. Nimal Perera", specialization: "Orthopedics", availableSlots: ["Mon 9:00 AM", "Mon 2:00 PM", "Wed 10:00 AM", "Fri 11:00 AM"] },
      { id: "s2", name: "Dr. Samanthi De Silva", specialization: "Dermatology", availableSlots: ["Tue 9:30 AM", "Thu 1:00 PM", "Fri 3:00 PM"] },
    ],
  },
  {
    id: "clinic-2", name: "Kandy Pet Care Centre", address: "No. 48, Peradeniya Road, Kandy", phone: "+94 81 222 4567",
    specialization: "Emergency & Critical Care", status: "active", latitude: 7.2906, longitude: 80.6337,
    surgeons: [
      { id: "s3", name: "Dr. Ruwan Fernando", specialization: "Internal Medicine", availableSlots: ["Mon 8:00 AM", "Wed 11:00 AM", "Thu 2:30 PM"] },
      { id: "s4", name: "Dr. Kavinda Rajapaksha", specialization: "Emergency Medicine", availableSlots: ["Tue 10:00 AM", "Wed 3:00 PM", "Sat 9:00 AM"] },
    ],
  },
  {
    id: "clinic-3", name: "Nugegoda Animal Clinic", address: "No. 12, High Level Road, Nugegoda", phone: "+94 11 281 3490",
    specialization: "Ophthalmology & Dental", status: "active", latitude: 6.8728, longitude: 79.8894,
    surgeons: [
      { id: "s5", name: "Dr. Anusha Wickramasinghe", specialization: "Ophthalmology", availableSlots: ["Mon 10:00 AM", "Tue 2:00 PM", "Thu 9:00 AM", "Fri 1:00 PM"] },
    ],
  },
  {
    id: "clinic-4", name: "Dehiwala Pet Hospital", address: "No. 85, Galle Road, Dehiwala", phone: "+94 11 273 8821",
    specialization: "Nutrition & Preventive Care", status: "active", latitude: 6.8560, longitude: 79.8650,
    surgeons: [
      { id: "s6", name: "Dr. Tharanga Jayawardena", specialization: "Veterinary Nutrition", availableSlots: ["Wed 9:00 AM", "Thu 11:00 AM", "Fri 2:00 PM"] },
      { id: "s7", name: "Dr. Priyantha Kumara", specialization: "Preventive Medicine", availableSlots: ["Mon 11:00 AM", "Tue 3:00 PM", "Sat 10:00 AM"] },
    ],
  },
  {
    id: "clinic-5", name: "Rajagiriya Vet Clinic", address: "No. 134, Sri Jayawardenepura Mawatha, Rajagiriya", phone: "+94 11 288 6200",
    specialization: "General & Exotic Animals", status: "active", latitude: 6.9066, longitude: 79.8984,
    surgeons: [
      { id: "s8", name: "Dr. Hiruni Senanayake", specialization: "General Surgery", availableSlots: ["Mon 9:30 AM", "Wed 2:00 PM", "Fri 10:00 AM"] },
      { id: "s9", name: "Dr. Ashan Bandara", specialization: "Exotic Animal Care", availableSlots: ["Tue 11:00 AM", "Thu 3:00 PM", "Sat 9:30 AM"] },
    ],
  },
];

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
  const storedName = getProfileNameForRole("pet-owner", "Pet Owner");
  const firstName = storedName.trim().split(/\s+/)[0] || "Pet Owner";

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pets, setPets] = useState<PetRecord[]>(() => { const p = loadJson<PetRecord[]>(PET_OWNER_PETS_KEY, []); return p.length ? p : defaultPets; });
  const [newPet, setNewPet] = useState({ name: "", species: "Dog", breed: "", age: "", weightKg: "", photoDataUrl: "", vaccinationName: "", vaccinationDate: "", vaccinationFrequency: "Annual", nextVaccinationDate: "" });
  const [profile, setProfile] = useState<OwnerProfile>(() => loadJson(PET_OWNER_PROFILE_KEY, { displayName: storedName, email: "", phone: "", address: "" }));
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "msg-1", sender: "assistant", text: "Hi! I'm your PetCare AI assistant. Describe your pet's symptoms for guidance." }]);
  const [chatInput, setChatInput] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(() => loadJson(PET_OWNER_APPOINTMENTS_KEY, []));
  const [bookingPetByClinic, setBookingPetByClinic] = useState<Record<string, string>>({});
  const [rescheduleSlotByAppointment, setRescheduleSlotByAppointment] = useState<Record<string, string>>({});
  const [inquiryBySurgeon, setInquiryBySurgeon] = useState<Record<string, string>>({});
  const [surgeonInquiries, setSurgeonInquiries] = useState<SurgeonInquiryRecord[]>(() => loadJson(PET_OWNER_SURGEON_INQUIRIES_KEY, []));
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [ownerCalendarMonth, setOwnerCalendarMonth] = useState(new Date().getMonth());
  const [ownerCalendarYear, setOwnerCalendarYear] = useState(new Date().getFullYear());

  const clinics = useMemo(() => {
    const stored = loadJson<ClinicDirectoryRecord[]>(CLINIC_DIRECTORY_KEY, []);
    const all = stored.length > 0 ? stored : defaultClinics;
    return all.filter((c) => c.status === "active");
  }, [activeTab, appointments.length]);
  useEffect(() => { localStorage.setItem(PET_OWNER_APPOINTMENTS_KEY, JSON.stringify(appointments)); }, [appointments]);
  useEffect(() => { localStorage.setItem(PET_OWNER_SURGEON_INQUIRIES_KEY, JSON.stringify(surgeonInquiries)); }, [surgeonInquiries]);
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError("Geolocation not supported."); return; }
    navigator.geolocation.getCurrentPosition((pos) => { setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocationError(""); }, () => setLocationError("Location permission denied."), { enableHighAccuracy: true, timeout: 10000 });
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

  function persistPets(next: PetRecord[]) { setPets(next); localStorage.setItem(PET_OWNER_PETS_KEY, JSON.stringify(next)); }
  function handleAddPet(): boolean {
    if (!newPet.name.trim() || !newPet.breed.trim() || !newPet.age.trim() || !newPet.weightKg.trim() || !newPet.vaccinationName.trim() || !newPet.vaccinationDate) { toast({ title: "Missing fields", description: "Fill pet info and vaccination details.", variant: "error" }); return false; }
    const pet: PetRecord = { id: `pet-${Date.now()}`, ...newPet, name: newPet.name.trim(), breed: newPet.breed.trim(), age: newPet.age.trim(), weightKg: newPet.weightKg.trim(), emoji: newPet.species === "Cat" ? "🐈" : "🐕", photoDataUrl: newPet.photoDataUrl || undefined };
    persistPets([pet, ...pets]); setNewPet({ name: "", species: "Dog", breed: "", age: "", weightKg: "", photoDataUrl: "", vaccinationName: "", vaccinationDate: "", vaccinationFrequency: "Annual", nextVaccinationDate: "" }); toast({ title: "Pet added", variant: "success" });
    return true;
  }
  function handleDeletePet(id: string) { persistPets(pets.filter((p) => p.id !== id)); toast({ title: "Pet removed" }); }
  function handleSaveProfile() {
    if (!profile.displayName.trim()) { toast({ title: "Name required", variant: "error" }); return; }
    const updated = { ...profile, displayName: profile.displayName.trim() }; setProfile(updated); saveProfileName(updated.displayName, "pet-owner");
    localStorage.setItem(PET_OWNER_PROFILE_KEY, JSON.stringify(updated)); toast({ title: "Profile saved", variant: "success" });
  }
  function handleLogout() { logout(); navigate("/auth/login", { replace: true }); }
  function isSlotBooked(clinicId: string, surgeonId: string, slot: string) { return appointments.some((a) => a.status !== "cancelled" && a.clinicId === clinicId && a.surgeonId === surgeonId && a.slot === slot); }
  function handleBookAppointment(clinic: ClinicDirectoryRecord, surgeon: ClinicDirectoryRecord["surgeons"][number], slot: string) {
    const petId = bookingPetByClinic[clinic.id] || pets[0]?.id; const pet = pets.find((p) => p.id === petId);
    if (!pet) { toast({ title: "Add a pet first", variant: "error" }); return; } if (isSlotBooked(clinic.id, surgeon.id, slot)) { toast({ title: "Slot taken", variant: "error" }); return; }
    setAppointments((prev) => [{ id: `appt-${Date.now()}`, clinicId: clinic.id, clinicName: clinic.name, surgeonId: surgeon.id, surgeonName: surgeon.name, slot, petId: pet.id, petName: pet.name, ownerName: profile.displayName.trim() || "Pet Owner", ownerPhone: profile.phone.trim() || undefined, status: "confirmed", bookedAt: new Date().toISOString() }, ...prev]);
    localStorage.setItem("companion_ai_last_booking", JSON.stringify({ petId: pet.id, petName: pet.name, clinicId: clinic.id, clinicName: clinic.name, surgeonName: surgeon.name, slot }));
    toast({ title: "Appointment booked", description: `${surgeon.name} at ${slot}`, variant: "success" });
    navigate("/pets/booking-confirmed");
  }
  function handleCancelAppointment(id: string) { setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: "cancelled" } : a)); toast({ title: "Appointment cancelled" }); }
  function handleRescheduleAppointment(appt: AppointmentRecord) {
    const slot = rescheduleSlotByAppointment[appt.id]; if (!slot) return;
    if (appointments.some((a) => a.id !== appt.id && a.status !== "cancelled" && a.clinicId === appt.clinicId && a.surgeonId === appt.surgeonId && a.slot === slot)) { toast({ title: "Slot taken", variant: "error" }); return; }
    setAppointments((prev) => prev.map((a) => a.id === appt.id ? { ...a, slot, status: "pending", bookedAt: new Date().toISOString() } : a)); toast({ title: "Rescheduled", variant: "success" });
  }
  function handleSendInquiry(clinic: ClinicDirectoryRecord, surgeon: ClinicDirectoryRecord["surgeons"][number]) {
    const key = `${clinic.id}_${surgeon.id}`, msg = inquiryBySurgeon[key]?.trim(); if (!msg) return;
    const pet = pets.find((p) => p.id === (bookingPetByClinic[clinic.id] || pets[0]?.id));
    if (!pet) { toast({ title: "Add a pet first", variant: "error" }); return; }
    setSurgeonInquiries((prev) => [{ id: `inq-${Date.now()}`, clinicId: clinic.id, clinicName: clinic.name, surgeonId: surgeon.id, surgeonName: surgeon.name, petId: pet.id, petName: pet.name, message: msg, status: "open", createdAt: new Date().toISOString() }, ...prev]);
    setInquiryBySurgeon((prev) => ({ ...prev, [key]: "" })); toast({ title: "Inquiry sent", variant: "success" });
  }
  function buildReply(prompt: string): string {
    const t = prompt.toLowerCase();
    if (t.includes("vomit")) return "If vomiting persists >24h, keep hydrated and book a vet visit. Seek urgent care if blood is present.";
    if (t.includes("not eating") || t.includes("appetite")) return "Track duration, water intake, and activity. Consult a vet if it persists more than a day.";
    if (t.includes("vaccine")) return "Check your vaccination timeline. I can help prepare a checklist for upcoming boosters.";
    return "Monitor symptoms for 12-24 hours. Consult an available clinic if they worsen or persist.";
  }
  function handleSendMessage() {
    const text = chatInput.trim(); if (!text) return;
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, sender: "owner", text }, { id: `msg-${Date.now() + 1}`, sender: "assistant", text: buildReply(text) }]); setChatInput("");
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
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const petProfileRoutePetId = location.pathname.match(/^\/pets\/profile\/([^/]+)$/)?.[1];
  const clinicRouteClinicId = location.pathname.match(/^\/pets\/clinic\/([^/]+)$/)?.[1];
  const isCreatePetRoute = location.pathname === "/pets/create";
  const isFlowRoute = Boolean(petProfileRoutePetId || clinicRouteClinicId || isCreatePetRoute);
  const headerTitle = petProfileRoutePetId
    ? "Pet Details"
    : clinicRouteClinicId
      ? "Clinic Details"
      : isCreatePetRoute
        ? "Create Pet Profile"
      : navItems.find((n) => n.id === activeTab)?.label;

  useEffect(() => {
    if (!requestedTab) return;
    const validTabs: Tab[] = ["home", "pets", "ai", "clinics", "profile"];
    if (validTabs.includes(requestedTab as Tab)) {
      setActiveTab(requestedTab as Tab);
    }
  }, [requestedTab]);

  function handleSelectTab(tab: Tab) {
    setActiveTab(tab);
    if (isFlowRoute) navigate("/pets");
  }

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
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle">Menu</p>
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => handleSelectTab(item.id)}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-100",
                  activeTab === item.id
                    ? "bg-primary text-primary-fg shadow-sm"
                    : "text-accent-subtle hover:bg-surface-tertiary hover:text-accent-muted dark:text-accent-faint dark:hover:bg-primary dark:hover:text-neutral-200")}>
                <item.icon className="h-[15px] w-[15px]" />
                {item.label}
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
              <p className="text-[12px] font-medium text-accent truncate dark:text-white">{storedName}</p>
              <p className="text-[10px] text-accent-faint dark:text-accent-subtle">Pet Owner</p>
            </div>
          </div>
          <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12px] font-medium text-accent-faint transition hover:bg-surface-tertiary hover:text-accent-muted dark:hover:bg-primary dark:hover:text-neutral-300">
            <LogOut className="h-3.5 w-3.5" />Sign out
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-surface px-4 lg:px-8 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="rounded-md p-1.5 text-accent-subtle hover:bg-surface-tertiary lg:hidden dark:hover:bg-primary"><Menu className="h-5 w-5" /></button>
            <div className="hidden h-5 w-px bg-neutral-200 lg:block dark:bg-neutral-700" />
            <h1 className="text-[13px] font-semibold text-accent dark:text-white">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <ThemeSwitcher compact />
            <Badge variant="outline" className="hidden sm:inline-flex gap-1"><Sparkles className="h-3 w-3" />AI Active</Badge>
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
                <item.icon className="h-4 w-4" />{item.label}
              </button>
            ))}
            <Separator className="my-1 dark:bg-neutral-800" />
            <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-accent-faint"><LogOut className="h-4 w-4" />Sign out</button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">
            {petProfileRoutePetId && (
              <PetProfilePage embedded petIdOverride={petProfileRoutePetId} onBack={() => navigate("/pets")} />
            )}

            {clinicRouteClinicId && (
              <ClinicDetailsPage embedded clinicIdOverride={clinicRouteClinicId} onBack={() => navigate("/pets")} />
            )}

            {isCreatePetRoute && (
              <div className="max-w-2xl space-y-6 animate-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-accent">Create Pet Profile</h2>
                    <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">Add your pet information and photo</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigate("/pets?tab=pets")}>Back</Button>
                </div>

                <div className="rounded-xl border border-border/80 bg-surface p-5 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5"><Label className="text-[12px]">Name</Label><Input value={newPet.name} onChange={(e) => setNewPet((p) => ({ ...p, name: e.target.value }))} placeholder="Pet name" /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">Species</Label>
                      <select value={newPet.species} onChange={(e) => setNewPet((p) => ({ ...p, species: e.target.value, breed: "" }))} className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"><option>Dog</option><option>Cat</option></select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Breed</Label>
                      <select
                        value={newPet.breed}
                        onChange={(e) => setNewPet((p) => ({ ...p, breed: e.target.value }))}
                        className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                      >
                        <option value="">Select breed</option>
                        {(breedsBySpecies[newPet.species] ?? []).map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-[12px]">Age (years)</Label><Input value={newPet.age} onChange={(e) => setNewPet((p) => ({ ...p, age: e.target.value }))} placeholder="e.g. 3" /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">Weight (kg)</Label><Input value={newPet.weightKg} onChange={(e) => setNewPet((p) => ({ ...p, weightKg: e.target.value }))} placeholder="e.g. 12" /></div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border/80 bg-surface-secondary p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <h3 className="text-[13px] font-semibold text-accent">Vaccination Details</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label className="text-[12px]">Vaccine name</Label><Input value={newPet.vaccinationName} onChange={(e) => setNewPet((p) => ({ ...p, vaccinationName: e.target.value }))} placeholder="e.g. Rabies" /></div>
                      <div className="space-y-1.5"><Label className="text-[12px]">Last vaccination date</Label><Input type="date" value={newPet.vaccinationDate} onChange={(e) => setNewPet((p) => ({ ...p, vaccinationDate: e.target.value }))} /></div>
                      <div className="space-y-1.5"><Label className="text-[12px]">Frequency</Label>
                        <select value={newPet.vaccinationFrequency} onChange={(e) => setNewPet((p) => ({ ...p, vaccinationFrequency: e.target.value }))} className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"><option>Annual</option><option>Every 6 months</option><option>Custom</option></select>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[12px]">Next due date (optional)</Label><Input type="date" value={newPet.nextVaccinationDate} onChange={(e) => setNewPet((p) => ({ ...p, nextVaccinationDate: e.target.value }))} /></div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label className="text-[12px] font-medium text-accent-muted">Pet photo</Label>
                    <Dropzone
                      value={newPet.photoDataUrl || undefined}
                      onChange={(url) => setNewPet((p) => ({ ...p, photoDataUrl: url }))}
                      onClear={() => setNewPet((p) => ({ ...p, photoDataUrl: "" }))}
                      label="Drag and drop an image here, or browse"
                      hint="PNG, JPG, or WEBP — maximum 5 MB"
                    />
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Button size="sm" onClick={() => { if (handleAddPet()) navigate("/pets?tab=pets"); }}><Plus className="h-3.5 w-3.5" />Create Pet Profile</Button>
                    <Button size="sm" variant="secondary" onClick={() => navigate("/pets?tab=pets")}>Cancel</Button>
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
                    <h2 className="text-2xl font-semibold tracking-tight text-accent dark:text-white">Welcome back, {firstName}</h2>
                    <p className="mt-1 text-sm text-accent-subtle dark:text-accent-faint">Here's what's happening with your pets today.</p>

                    {/* Stats row */}
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "Pets", value: pets.length, icon: PawPrint, onClick: () => setActiveTab("pets") },
                        { label: "Appointments", value: activeAppts, icon: Calendar, onClick: () => setActiveTab("clinics") },
                        { label: "Assessments", value: predictions.length, icon: Brain, onClick: () => setActiveTab("ai") },
                        { label: "Health Score", value: "92%", icon: Activity, onClick: () => {} },
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

                    {/* Vaccination banner below stats */}
                    <div className="mt-4 w-full max-w-[560px] rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                            <Syringe className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-amber-900">Vaccination due in 3 days</p>
                            <p className="text-[12px] text-amber-700/70">Buddy's Rabies booster needs to be scheduled.</p>
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setActiveTab("clinics")}>
                          Schedule <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Your pets moved up to reduce whitespace */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[15px] font-semibold text-accent">Your Pets</h3>
                        <button onClick={() => navigate(`/pets/profile/${pets[0]?.id || "pet-1"}`)} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-subtle hover:text-accent transition-colors">
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
                            <p className="text-[13px] font-semibold text-red-900">Attention Required</p>
                            <p className="mt-0.5 text-[12px] leading-relaxed text-red-700/80">
                              {highRisk.pet}'s {highRisk.title.toLowerCase()} assessment shows <span className="font-medium text-red-800">high risk</span> with {highRisk.confidence}% confidence.
                            </p>
                            <Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700" onClick={() => setActiveTab("clinics")}>
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
                        <h3 className="text-[15px] font-semibold text-accent">Risk Assessments</h3>
                        <Badge variant="info" className="gap-1"><Sparkles className="h-2.5 w-2.5" />AI</Badge>
                      </div>
                      <button onClick={() => setActiveTab("ai")} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-subtle hover:text-accent transition-colors">
                        History <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="space-y-2">
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
                            <Badge variant={item.variant} className="shrink-0">{item.risk}</Badge>
                          </div>
                          {/* Confidence bar */}
                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex-1">
                              <div className="h-1.5 w-full rounded-full bg-surface-tertiary dark:bg-neutral-800">
                                <div className={cn("h-1.5 rounded-full transition-all duration-700", riskBg[item.risk])} style={{ width: `${item.confidence}%` }} />
                              </div>
                            </div>
                            <span className="text-[11px] font-medium text-accent-subtle">{item.confidence}%</span>
                          </div>
                          {/* Recommendation */}
                          <p className="mt-2.5 text-[12px] leading-relaxed text-accent-subtle">
                            <span className="font-medium text-accent-muted">Recommendation:</span> {item.recommendation}
                          </p>
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const matchedPet = pets.find((p) => p.name.toLowerCase() === item.pet.toLowerCase());
                                navigate(`/pets/prediction/${matchedPet?.id || pets[0]?.id || "pet-1"}`);
                              }}
                            >
                              View report <ChevronRight className="h-3 w-3" />
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
                    <h2 className="text-xl font-semibold text-accent">My Pets</h2>
                    <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">Manage your pet profiles</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{pets.length} registered</Badge>
                    <Button size="sm" onClick={() => navigate("/pets/create")}><Plus className="h-3.5 w-3.5" />Add</Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeletePet(pet.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5 text-accent-faint" /></Button>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg bg-surface-secondary dark:bg-neutral-800 px-3 py-2">
                          <p className="text-[15px] font-semibold text-accent dark:text-white">{pet.age}</p>
                          <p className="text-[10px] text-accent-faint">Years old</p>
                        </div>
                        <div className="rounded-lg bg-surface-secondary dark:bg-neutral-800 px-3 py-2">
                          <p className="text-[15px] font-semibold text-accent dark:text-white">{pet.weightKg}</p>
                          <p className="text-[10px] text-accent-faint">Kg weight</p>
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
                    <h2 className="text-xl font-semibold text-accent">AI Health Assistant</h2>
                    <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">Describe symptoms for AI-powered guidance</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="gap-1"><Sparkles className="h-3 w-3" />Powered by AI</Badge>
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/pets/symptoms/${pets[0]?.id || "pet-1"}`)}>Structured Form</Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900 p-5">
                  <div className="mx-auto max-w-2xl space-y-3">
                    {messages.map((m) => (
                      <div key={m.id} className={cn("max-w-[80%] rounded-xl px-4 py-2.5 text-[13px] leading-relaxed",
                        m.sender === "owner" ? "ml-auto bg-primary text-primary-fg" : "bg-surface-secondary text-neutral-800 border border-neutral-100 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700")}>
                        {m.sender === "assistant" && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent-faint">AI Assistant</p>}
                        {m.text}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }} placeholder="Describe symptoms or ask a question..." className="flex-1" />
                  <Button onClick={handleSendMessage}><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            )}

            {/* ═══ CLINICS ═══ */}
            {activeTab === "clinics" && !isFlowRoute && (
              <div className="space-y-6 animate-in">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-xl font-semibold text-accent">Clinics & Appointments</h2><p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">Find clinics and manage bookings</p></div>
                  {nearbyClinics.length > 0 && <Badge variant="success">{nearbyClinics.length} available</Badge>}
                </div>
                {locationError && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800"><Info className="h-4 w-4 shrink-0" />{locationError}</div>}

                {appointments.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-accent">My Appointments</h3>
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
                              <Badge variant={appt.status === "confirmed" ? "success" : appt.status === "cancelled" ? "danger" : "warning"}>{appt.status}</Badge>
                            </div>
                            {appt.status !== "cancelled" && slots.length > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <select value={rescheduleSlotByAppointment[appt.id] || ""} onChange={(e) => setRescheduleSlotByAppointment((p) => ({ ...p, [appt.id]: e.target.value }))} className="h-7 flex-1 rounded border border-border px-2 text-xs text-accent-muted focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                                  <option value="">Reschedule to...</option>{slots.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <Button size="sm" variant="secondary" onClick={() => handleRescheduleAppointment(appt)}>Reschedule</Button>
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
                  <div className="rounded-xl border border-dashed border-border-strong bg-surface px-4 py-10 text-center"><MapPin className="mx-auto mb-2 h-5 w-5 text-neutral-300" /><p className="text-sm text-accent-subtle">No clinics available yet.</p></div>
                ) : nearbyClinics.map((clinic) => (
                  <div key={clinic.id} className="rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-start justify-between p-5">
                      <div><button type="button" onClick={() => navigate(`/pets/clinic/${clinic.id}`)} className="text-left"><p className="text-[14px] font-semibold text-accent dark:text-white hover:underline">{clinic.name}</p></button><p className="mt-0.5 text-[12px] text-accent-subtle">{clinic.address} &middot; {clinic.phone}</p><Badge variant="info" className="mt-1.5">{clinic.specialization}</Badge>
                        {userLocation && typeof clinic.latitude === "number" && typeof clinic.longitude === "number" && <p className="mt-1 text-[11px] text-accent-faint">{distanceKm(userLocation.latitude, userLocation.longitude, clinic.latitude, clinic.longitude).toFixed(1)} km away</p>}
                      </div>
                      <div className="space-y-1.5"><Label className="text-[11px]">Pet</Label><select value={bookingPetByClinic[clinic.id] || pets[0]?.id || ""} onChange={(e) => setBookingPetByClinic((p) => ({ ...p, [clinic.id]: e.target.value }))} className="h-7 rounded border border-border px-2 text-xs focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                    </div>
                    {clinic.surgeons.length > 0 && (
                      <div className="border-t border-neutral-100 dark:border-neutral-800 p-5 pt-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-accent-faint">Surgeons & Availability</p>
                        <div className="space-y-4">
                          {clinic.surgeons.map((surgeon) => (
                            <div key={surgeon.id}>
                              <p className="text-[13px] font-medium text-accent dark:text-white">{surgeon.name}</p>
                              <p className="text-[11px] text-accent-subtle">{surgeon.specialization}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {surgeon.availableSlots.length === 0 ? <span className="text-[11px] text-accent-faint">No slots</span> : surgeon.availableSlots.map((slot) => {
                                  const booked = isSlotBooked(clinic.id, surgeon.id, slot);
                                  return <button key={slot} onClick={() => handleBookAppointment(clinic, surgeon, slot)} disabled={booked} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition", booked ? "bg-surface-tertiary text-accent-faint cursor-not-allowed dark:bg-neutral-800 dark:text-accent-muted" : "bg-primary text-primary-fg hover:bg-primary-hover")}><Clock className="h-3 w-3" />{slot}</button>;
                                })}
                              </div>
                              <div className="mt-2 flex gap-2"><Input value={inquiryBySurgeon[`${clinic.id}_${surgeon.id}`] || ""} onChange={(e) => setInquiryBySurgeon((p) => ({ ...p, [`${clinic.id}_${surgeon.id}`]: e.target.value }))} placeholder="Send inquiry..." className="h-7 flex-1 text-xs" /><Button size="sm" variant="secondary" onClick={() => handleSendInquiry(clinic, surgeon)}><Send className="h-3 w-3" /></Button></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {surgeonInquiries.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-[13px] font-semibold text-accent">Inquiries</h3>
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                      {surgeonInquiries.slice(0, 8).map((inq) => (
                        <div key={inq.id} className="flex items-center justify-between px-4 py-3"><div className="min-w-0"><p className="text-[13px] font-medium text-accent dark:text-white">{inq.surgeonName}</p><p className="text-[12px] text-accent-subtle truncate">{inq.message}</p></div><Badge variant={inq.status === "replied" ? "success" : "warning"}>{inq.status}</Badge></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ PROFILE ═══ */}
            {activeTab === "profile" && !isFlowRoute && (
              <div className="max-w-2xl space-y-6 animate-in">
                <div><h2 className="text-xl font-semibold text-accent">Account</h2><p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">Manage your profile information</p></div>
                <div className="rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900 p-5">
                  <div className="mb-5 space-y-2">
                    <Label className="text-[12px] font-medium text-accent-muted">Profile photo</Label>
                    <Dropzone
                      value={profile.photoDataUrl}
                      onChange={(url) => { setProfile((p) => { const next = { ...p, photoDataUrl: url }; localStorage.setItem(PET_OWNER_PROFILE_KEY, JSON.stringify(next)); return next; }); }}
                      onClear={() => { setProfile((p) => { const next = { ...p, photoDataUrl: undefined }; localStorage.setItem(PET_OWNER_PROFILE_KEY, JSON.stringify(next)); return next; }); }}
                      label="Drag and drop a profile photo here, or browse"
                      hint="Square images work best — PNG, JPG, or WEBP, max 5 MB"
                    />
                  </div>
                  <Separator className="mb-5" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-[12px]">Full name</Label><Input value={profile.displayName} onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">Email</Label><Input value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} placeholder="you@email.com" /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">Phone</Label><Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone number" /></div>
                    <div className="space-y-1.5"><Label className="text-[12px]">Address</Label><Input value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} placeholder="Address" /></div>
                  </div>
                  <Separator className="my-5" />
                  <div className="flex items-center justify-between">
                    <Button size="sm" onClick={handleSaveProfile}><Save className="h-3.5 w-3.5" />Save changes</Button>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { localStorage.removeItem(PET_OWNER_PROFILE_KEY); localStorage.removeItem(PET_OWNER_PETS_KEY); handleLogout(); }} className="text-red-500 hover:text-red-600 hover:bg-red-50">
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
    </div>
  );
}
