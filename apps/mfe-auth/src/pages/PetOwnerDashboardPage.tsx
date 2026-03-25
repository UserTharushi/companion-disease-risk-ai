import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfileNameForRole, logout, saveProfileName } from "../lib/session";
import petBuddyImage from "../assets/images/pet-buddy.jpg";
import petLunaImage from "../assets/images/pet-luna.jpg";

const CLINIC_DIRECTORY_KEY = "companion_ai_clinic_directory";
const PET_OWNER_PETS_KEY = "companion_ai_pet_owner_pets";
const PET_OWNER_PROFILE_KEY = "companion_ai_pet_owner_profile";
const PET_OWNER_APPOINTMENTS_KEY = "companion_ai_pet_owner_appointments";
const PET_OWNER_SURGEON_INQUIRIES_KEY = "companion_ai_pet_owner_surgeon_inquiries";

interface ClinicDirectoryRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  specialization: string;
  status: "active" | "inactive";
  latitude?: number;
  longitude?: number;
  surgeons: Array<{
    id: string;
    name: string;
    specialization: string;
    availableSlots: string[];
  }>;
}

interface PetRecord {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: string;
  weightKg: string;
  emoji: string;
  photoDataUrl?: string;
}

interface OwnerProfile {
  displayName: string;
  email: string;
  phone: string;
  address: string;
  photoDataUrl?: string;
}

interface AppointmentRecord {
  id: string;
  clinicId: string;
  clinicName: string;
  surgeonId: string;
  surgeonName: string;
  slot: string;
  petId: string;
  petName: string;
  ownerName: string;
  ownerPhone?: string;
  status: "pending" | "confirmed" | "cancelled";
  bookedAt: string;
}

interface SurgeonInquiryRecord {
  id: string;
  clinicId: string;
  clinicName: string;
  surgeonId: string;
  surgeonName: string;
  petId: string;
  petName: string;
  message: string;
  status: "open" | "replied";
  createdAt: string;
}

interface ChatMessage {
  id: string;
  sender: "owner" | "assistant";
  text: string;
}

type DashboardTab = "home" | "pets" | "ai" | "clinics" | "profile";

const defaultPets: PetRecord[] = [
  {
    id: "pet-1",
    name: "Buddy",
    species: "Dog",
    breed: "Golden Retriever",
    age: "2",
    weightKg: "30",
    emoji: "🐕",
    photoDataUrl: petBuddyImage,
  },
  {
    id: "pet-2",
    name: "Luna",
    species: "Cat",
    breed: "Siamese",
    age: "4",
    weightKg: "5",
    emoji: "🐈",
    photoDataUrl: petLunaImage,
  },
];

const defaultMessages: ChatMessage[] = [
  { id: "msg-1", sender: "assistant", text: "Hi! I am your PetCare AI Assistant. Tell me your pet's symptoms for quick guidance." },
];

export function PetOwnerDashboardPage() {
  const navigate = useNavigate();
  const storedName = getProfileNameForRole("pet-owner", "Pet Owner");
  const firstName = storedName.trim().split(/\s+/)[0] || "Pet Owner";

  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const [pets, setPets] = useState<PetRecord[]>(() => {
    const raw = localStorage.getItem(PET_OWNER_PETS_KEY);
    if (!raw) return defaultPets;
    try {
      const parsed = JSON.parse(raw) as PetRecord[];
      return Array.isArray(parsed) && parsed.length ? parsed : defaultPets;
    } catch {
      return defaultPets;
    }
  });

  const [newPet, setNewPet] = useState({
    name: "",
    species: "Dog",
    breed: "",
    age: "",
    weightKg: "",
    photoDataUrl: "",
  });

  const [profile, setProfile] = useState<OwnerProfile>(() => {
    const raw = localStorage.getItem(PET_OWNER_PROFILE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as OwnerProfile;
      } catch {
        // ignore parse error and use fallback
      }
    }
    return {
      displayName: storedName,
      email: "",
      phone: "",
      address: "",
    };
  });

  const [messages, setMessages] = useState<ChatMessage[]>(defaultMessages);
  const [chatInput, setChatInput] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRecord[]>(() => {
    const raw = localStorage.getItem(PET_OWNER_APPOINTMENTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as AppointmentRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [bookingPetByClinic, setBookingPetByClinic] = useState<Record<string, string>>({});
  const [rescheduleSlotByAppointment, setRescheduleSlotByAppointment] = useState<Record<string, string>>({});
  const [inquiryBySurgeon, setInquiryBySurgeon] = useState<Record<string, string>>({});
  const [surgeonInquiries, setSurgeonInquiries] = useState<SurgeonInquiryRecord[]>(() => {
    const raw = localStorage.getItem(PET_OWNER_SURGEON_INQUIRIES_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as SurgeonInquiryRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string>("");

  const clinics = useMemo(() => {
    const raw = localStorage.getItem(CLINIC_DIRECTORY_KEY);
    if (!raw) return [] as ClinicDirectoryRecord[];

    try {
      const parsed = JSON.parse(raw) as ClinicDirectoryRecord[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((clinic) => clinic.status === "active");
    } catch {
      return [];
    }
  }, [activeTab, appointments.length]);

  useEffect(() => {
    localStorage.setItem(PET_OWNER_APPOINTMENTS_KEY, JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem(PET_OWNER_SURGEON_INQUIRIES_KEY, JSON.stringify(surgeonInquiries));
  }, [surgeonInquiries]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationError("");
      },
      () => {
        setLocationError("Location permission denied. Showing clinics without distance ranking.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  function toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
    const earthKm = 6371;
    const dLat = toRadians(bLat - aLat);
    const dLon = toRadians(bLon - aLon);
    const lat1 = toRadians(aLat);
    const lat2 = toRadians(bLat);

    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return earthKm * c;
  }

  const nearbyClinics = useMemo(() => {
    if (!userLocation) return clinics;

    return [...clinics]
      .map((clinic) => {
        if (typeof clinic.latitude !== "number" || typeof clinic.longitude !== "number") {
          return { clinic, distance: Number.POSITIVE_INFINITY };
        }

        return {
          clinic,
          distance: distanceKm(userLocation.latitude, userLocation.longitude, clinic.latitude, clinic.longitude),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.clinic);
  }, [clinics, userLocation]);

  const predictions = [
    { id: "1", title: "Hip Dysplasia Risk", pet: "Buddy", age: "2 hours ago", risk: "low risk", riskClass: "bg-emerald-100 text-emerald-700" },
    { id: "2", title: "Glaucoma Check", pet: "Luna", age: "yesterday", risk: "moderate", riskClass: "bg-amber-100 text-amber-700" },
    { id: "3", title: "Dietary Sensitivity", pet: "Buddy", age: "3 days ago", risk: "high risk", riskClass: "bg-rose-100 text-rose-700" },
  ];

  function persistPets(nextPets: PetRecord[]) {
    setPets(nextPets);
    localStorage.setItem(PET_OWNER_PETS_KEY, JSON.stringify(nextPets));
  }

  function handleAddPet() {
    if (!newPet.name.trim() || !newPet.breed.trim() || !newPet.age.trim() || !newPet.weightKg.trim()) {
      alert("Please fill pet name, breed, age, and weight.");
      return;
    }

    const emoji = newPet.species.toLowerCase() === "cat" ? "🐈" : "🐕";
    const pet: PetRecord = {
      id: `pet-${Date.now()}`,
      name: newPet.name.trim(),
      species: newPet.species,
      breed: newPet.breed.trim(),
      age: newPet.age.trim(),
      weightKg: newPet.weightKg.trim(),
      emoji,
      photoDataUrl: newPet.photoDataUrl || undefined,
    };

    persistPets([pet, ...pets]);
    setNewPet({ name: "", species: "Dog", breed: "", age: "", weightKg: "", photoDataUrl: "" });
  }

  function handleNewPetPhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const photoDataUrl = typeof reader.result === "string" ? reader.result : "";
      setNewPet((prev) => ({ ...prev, photoDataUrl }));
    };
    reader.readAsDataURL(file);
  }

  function handleDeletePet(id: string) {
    const confirmed = window.confirm("Delete this pet profile?");
    if (!confirmed) return;
    persistPets(pets.filter((pet) => pet.id !== id));
  }

  function handleSaveProfile() {
    if (!profile.displayName.trim()) {
      alert("Name cannot be empty.");
      return;
    }

    const updated = {
      ...profile,
      displayName: profile.displayName.trim(),
    };

    setProfile(updated);
    saveProfileName(updated.displayName, "pet-owner");
    localStorage.setItem(PET_OWNER_PROFILE_KEY, JSON.stringify(updated));
    alert("Profile updated successfully.");
  }

  function handleProfilePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const photoDataUrl = typeof reader.result === "string" ? reader.result : "";
      setProfile((prev) => {
        const nextProfile = { ...prev, photoDataUrl };
        localStorage.setItem(PET_OWNER_PROFILE_KEY, JSON.stringify(nextProfile));
        return nextProfile;
      });
    };
    reader.readAsDataURL(file);
  }

  function handleDeleteProfile() {
    const confirmed = window.confirm("Delete your profile data and logout?");
    if (!confirmed) return;

    localStorage.removeItem(PET_OWNER_PROFILE_KEY);
    localStorage.removeItem(PET_OWNER_PETS_KEY);
    logout();
    navigate("/auth/login", { replace: true });
  }

  function isSlotBooked(clinicId: string, surgeonId: string, slot: string): boolean {
    return appointments.some(
      (appt) =>
        appt.status !== "cancelled"
        && appt.clinicId === clinicId
        && appt.surgeonId === surgeonId
        && appt.slot === slot,
    );
  }

  function handleBookAppointment(
    clinic: ClinicDirectoryRecord,
    surgeon: ClinicDirectoryRecord["surgeons"][number],
    slot: string,
  ) {
    const selectedPetId = bookingPetByClinic[clinic.id] || pets[0]?.id;
    const selectedPet = pets.find((pet) => pet.id === selectedPetId);

    if (!selectedPet) {
      alert("Please add a pet profile first to book an appointment.");
      return;
    }

    if (isSlotBooked(clinic.id, surgeon.id, slot)) {
      alert("This slot is already booked.");
      return;
    }

    const appointment: AppointmentRecord = {
      id: `appt-${Date.now()}`,
      clinicId: clinic.id,
      clinicName: clinic.name,
      surgeonId: surgeon.id,
      surgeonName: surgeon.name,
      slot,
      petId: selectedPet.id,
      petName: selectedPet.name,
      ownerName: profile.displayName.trim() || "Pet Owner",
      ownerPhone: profile.phone.trim() || undefined,
      status: "pending",
      bookedAt: new Date().toISOString(),
    };

    setAppointments((prev) => [appointment, ...prev]);
    alert(`Appointment booked with ${surgeon.name} at ${slot}.`);
  }

  function handleCancelAppointment(appointmentId: string) {
    const confirmed = window.confirm("Cancel this appointment?");
    if (!confirmed) return;

    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, status: "cancelled" } : appointment,
      ),
    );
  }

  function handleRescheduleAppointment(appointment: AppointmentRecord) {
    const selectedSlot = rescheduleSlotByAppointment[appointment.id];
    if (!selectedSlot) {
      alert("Please select a new time slot.");
      return;
    }

    const alreadyBooked = appointments.some(
      (appt) =>
        appt.id !== appointment.id
        && appt.status !== "cancelled"
        && appt.clinicId === appointment.clinicId
        && appt.surgeonId === appointment.surgeonId
        && appt.slot === selectedSlot,
    );

    if (alreadyBooked) {
      alert("Selected slot is already booked.");
      return;
    }

    setAppointments((prev) =>
      prev.map((appt) =>
        appt.id === appointment.id
          ? { ...appt, slot: selectedSlot, status: "pending", bookedAt: new Date().toISOString() }
          : appt,
      ),
    );
    alert("Appointment rescheduled. Waiting for surgeon confirmation.");
  }

  function getSlotsForAppointment(appointment: AppointmentRecord): string[] {
    const clinic = clinics.find((entry) => entry.id === appointment.clinicId);
    const surgeon = clinic?.surgeons.find((entry) => entry.id === appointment.surgeonId);
    return surgeon?.availableSlots ?? [];
  }

  function appointmentStatusClass(status: AppointmentRecord["status"]): string {
    if (status === "confirmed") return "bg-emerald-100 text-emerald-700";
    if (status === "cancelled") return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700";
  }

  function handleSendSurgeonInquiry(
    clinic: ClinicDirectoryRecord,
    surgeon: ClinicDirectoryRecord["surgeons"][number],
  ) {
    const key = `${clinic.id}_${surgeon.id}`;
    const message = inquiryBySurgeon[key]?.trim();
    if (!message) {
      alert("Please write your inquiry before sending.");
      return;
    }

    const selectedPetId = bookingPetByClinic[clinic.id] || pets[0]?.id;
    const selectedPet = pets.find((pet) => pet.id === selectedPetId);
    if (!selectedPet) {
      alert("Please add a pet first.");
      return;
    }

    const inquiry: SurgeonInquiryRecord = {
      id: `inq-${Date.now()}`,
      clinicId: clinic.id,
      clinicName: clinic.name,
      surgeonId: surgeon.id,
      surgeonName: surgeon.name,
      petId: selectedPet.id,
      petName: selectedPet.name,
      message,
      status: "open",
      createdAt: new Date().toISOString(),
    };

    setSurgeonInquiries((prev) => [inquiry, ...prev]);
    setInquiryBySurgeon((prev) => ({ ...prev, [key]: "" }));
    alert(`Inquiry sent to ${surgeon.name}.`);
  }

  function buildAssistantReply(prompt: string): string {
    const text = prompt.toLowerCase();
    if (text.includes("vomit") || text.includes("vomiting")) {
      return "If vomiting happens more than once in 24 hours, keep your pet hydrated and book a vet visit soon. If there is blood, seek urgent care.";
    }
    if (text.includes("not eating") || text.includes("appetite")) {
      return "Loss of appetite can be early warning. Track duration, water intake, and activity. If it persists more than a day, consult a vet.";
    }
    if (text.includes("vaccine") || text.includes("vaccination")) {
      return "Check upcoming vaccine reminders and follow clinic schedules. I can help you prepare a vaccination checklist.";
    }
    return "Thanks. Based on your note, monitor symptoms for 12-24 hours and consult an available clinic if symptoms worsen or continue.";
  }

  function handleSendMessage() {
    const text = chatInput.trim();
    if (!text) return;

    const ownerMessage: ChatMessage = { id: `msg-${Date.now()}`, sender: "owner", text };
    const reply: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      sender: "assistant",
      text: buildAssistantReply(text),
    };

    setMessages((prev) => [...prev, ownerMessage, reply]);
    setChatInput("");
  }

  const navItems: Array<{ id: DashboardTab; label: string; icon: string }> = [
    { id: "home", label: "Home", icon: "🏠" },
    { id: "pets", label: "My Pets", icon: "🐾" },
    { id: "ai", label: "AI Assist", icon: "🧠" },
    { id: "clinics", label: "Clinics", icon: "📍" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  return (
    <div className="min-h-dvh bg-slate-100">
      {activeTab === "home" && (
        <section className="border-b border-slate-200 bg-white px-5 pb-5 pt-6">
          <div className="flex items-start justify-between text-slate-900">
            <div>
              <p className="text-base leading-6 text-slate-500">Welcome back,</p>
              <h1 className="mt-1 text-3xl font-semibold leading-tight">{firstName}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="h-12 w-12 rounded-full border border-slate-200 bg-white text-xl shadow-sm" aria-label="Notifications">🔔</button>
              {profile.photoDataUrl ? (
                <img src={profile.photoDataUrl} alt="Profile" className="h-12 w-12 rounded-full border-2 border-blue-200 object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-lg">
                  👤
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="px-5 pb-28 pt-4">
        {activeTab === "home" && (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setActiveTab("pets")}
              className="w-full rounded-[2rem] bg-blue-600 px-6 py-5 text-center text-3xl font-semibold text-white shadow-[0_16px_36px_rgba(37,99,235,0.35)] transition hover:bg-blue-700"
            >
              + Add New Pet
            </button>

            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-2xl text-white">💉</div>
                <div>
                  <h2 className="text-3xl font-semibold">Vaccinations Due</h2>
                  <p className="mt-2 text-lg leading-8 text-amber-800">Buddy&apos;s Rabies booster is due in 3 days. Schedule a visit soon.</p>
                  <button className="mt-3 text-lg font-semibold underline underline-offset-4" type="button" onClick={() => setActiveTab("clinics")}>Book Appointment</button>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-3xl font-semibold text-slate-900">Your Pets</h2>
                <button type="button" onClick={() => setActiveTab("pets")} className="text-xl font-semibold text-blue-600">View All</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {pets.slice(0, 2).map((pet) => (
                  <article key={pet.id} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="overflow-hidden rounded-2xl bg-slate-100">
                      {pet.photoDataUrl ? (
                        <img src={pet.photoDataUrl} alt={pet.name} className="h-56 w-full object-cover" />
                      ) : (
                        <div className="flex h-56 items-center justify-center text-7xl">{pet.emoji}</div>
                      )}
                    </div>
                    <h3 className="mt-3 text-4xl font-semibold text-slate-900">{pet.name}</h3>
                    <p className="text-xl text-slate-500">{pet.breed} • {pet.age} years</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-3xl font-semibold text-slate-900">Recent Predictions</h2>
                <button type="button" className="text-xl font-semibold text-blue-600">History</button>
              </div>
              <div className="space-y-3">
                {predictions.map((item) => (
                  <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-2xl">🧬</div>
                        <div>
                          <h3 className="text-2xl font-semibold text-slate-900">{item.title}</h3>
                          <p className="text-lg text-slate-500">{item.pet} • {item.age}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm font-semibold uppercase ${item.riskClass}`}>{item.risk}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "pets" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">My Pets</h2>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Add New Pet</h3>
              <div className="mt-3 flex items-center gap-3">
                {newPet.photoDataUrl ? (
                  <img src={newPet.photoDataUrl} alt="Pet preview" className="h-14 w-14 rounded-full border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xl">
                    {newPet.species === "Cat" ? "🐈" : "🐕"}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700">Pet Photo</label>
                  <input type="file" accept="image/*" onChange={handleNewPetPhotoUpload} className="mt-1 block text-xs text-slate-600" />
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  value={newPet.name}
                  onChange={(e) => setNewPet((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Pet Name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
                <select
                  value={newPet.species}
                  onChange={(e) => setNewPet((prev) => ({ ...prev, species: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                >
                  <option>Dog</option>
                  <option>Cat</option>
                </select>
                <input
                  value={newPet.breed}
                  onChange={(e) => setNewPet((prev) => ({ ...prev, breed: e.target.value }))}
                  placeholder="Breed"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
                <input
                  value={newPet.age}
                  onChange={(e) => setNewPet((prev) => ({ ...prev, age: e.target.value }))}
                  placeholder="Age (years)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
                <input
                  value={newPet.weightKg}
                  onChange={(e) => setNewPet((prev) => ({ ...prev, weightKg: e.target.value }))}
                  placeholder="Weight (kg)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
              <button type="button" onClick={handleAddPet} className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500">
                Add Pet
              </button>
            </article>

            <div className="space-y-3">
              {pets.map((pet) => (
                <article key={pet.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    {pet.photoDataUrl ? (
                      <img src={pet.photoDataUrl} alt={pet.name} className="h-14 w-14 rounded-full border border-slate-200 object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">{pet.emoji}</div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{pet.name}</h3>
                      <p className="text-sm text-slate-600">{pet.species} • {pet.breed} • {pet.age} years • {pet.weightKg} kg</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleDeletePet(pet.id)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500">
                    Delete
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">AI Assistance Chatbot</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div key={message.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.sender === "owner" ? "ml-auto bg-green-100 text-green-900" : "bg-slate-100 text-slate-800"}`}>
                    {message.text}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                  placeholder="Type pet symptoms or question..."
                />
                <button type="button" onClick={handleSendMessage} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500">
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "clinics" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            {/* LEFT BAR: MY APPOINTMENTS */}
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:row-span-2">
              <h3 className="text-lg font-semibold text-slate-900">My Appointments</h3>
              {appointments.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No appointments booked yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {appointments.map((appointment) => {
                    const slots = getSlotsForAppointment(appointment);
                    const canModify = appointment.status !== "cancelled";
                    return (
                      <div key={appointment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{appointment.clinicName}</p>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${appointmentStatusClass(appointment.status)}`}>
                            {appointment.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-700">
                          {appointment.surgeonName} • {appointment.slot}
                        </p>
                        <p className="text-[11px] text-slate-600">Pet: {appointment.petName}</p>

                        {canModify && slots.length > 0 && (
                          <div className="mt-2 space-y-2">
                            <select
                              value={rescheduleSlotByAppointment[appointment.id] || ""}
                              onChange={(event) =>
                                setRescheduleSlotByAppointment((prev) => ({
                                  ...prev,
                                  [appointment.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-green-500"
                            >
                              <option value="">Select new slot</option>
                              {slots.map((slot) => (
                                <option key={slot} value={slot}>{slot}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleRescheduleAppointment(appointment)}
                                className="flex-1 rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
                              >
                                Reschedule
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelAppointment(appointment.id)}
                                className="flex-1 rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            {/* RIGHT BAR: AVAILABLE CLINICS */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Available Clinics & Surgeons</h2>
                <span className="text-xs font-semibold text-green-600">{nearbyClinics.length} active</span>
              </div>

              {locationError && (
                <article className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  {locationError}
                </article>
              )}

              {nearbyClinics.length === 0 ? (
                <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 shadow-sm">
                  No clinic availability published yet. Please check back later.
                </article>
              ) : (
                <div className="space-y-3">
                  {nearbyClinics.map((clinic) => (
                  <article key={clinic.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{clinic.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{clinic.address}</p>
                        <p className="mt-1 text-sm text-slate-700">📞 {clinic.phone}</p>
                        <p className="mt-1 text-xs font-medium text-emerald-700">{clinic.specialization}</p>
                        {userLocation && typeof clinic.latitude === "number" && typeof clinic.longitude === "number" && (
                          <p className="mt-1 text-xs font-medium text-blue-700">
                            Approx. {distanceKm(userLocation.latitude, userLocation.longitude, clinic.latitude, clinic.longitude).toFixed(1)} km away
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Active</span>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <div className="mb-2">
                        <label className="text-xs font-semibold text-slate-700">Book for pet</label>
                        <select
                          value={bookingPetByClinic[clinic.id] || pets[0]?.id || ""}
                          onChange={(event) =>
                            setBookingPetByClinic((prev) => ({
                              ...prev,
                              [clinic.id]: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs outline-none focus:border-green-500"
                        >
                          {pets.map((pet) => (
                            <option key={pet.id} value={pet.id}>{pet.name}</option>
                          ))}
                        </select>
                      </div>

                      <p className="text-sm font-semibold text-slate-900">Available Surgeons and Time Slots</p>
                      {clinic.surgeons.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">No surgeons added yet for this clinic.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {clinic.surgeons.map((surgeon) => (
                            <div key={surgeon.id} className="rounded-lg border border-slate-200 bg-white p-2">
                              <p className="text-sm font-semibold text-slate-900">{surgeon.name}</p>
                              <p className="text-xs text-slate-600">{surgeon.specialization}</p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {surgeon.availableSlots.length === 0 ? (
                                  <span className="text-xs text-slate-500">No slots published</span>
                                ) : (
                                  surgeon.availableSlots.map((slot) => (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => handleBookAppointment(clinic, surgeon, slot)}
                                      disabled={isSlotBooked(clinic.id, surgeon.id, slot)}
                                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                                        isSlotBooked(clinic.id, surgeon.id, slot)
                                          ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                      }`}
                                    >
                                      {slot}{isSlotBooked(clinic.id, surgeon.id, slot) ? " (Booked)" : ""}
                                    </button>
                                  ))
                                )}
                              </div>

                              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                                <p className="text-xs font-semibold text-slate-700">Send inquiry to surgeon</p>
                                <textarea
                                  value={inquiryBySurgeon[`${clinic.id}_${surgeon.id}`] || ""}
                                  onChange={(event) =>
                                    setInquiryBySurgeon((prev) => ({
                                      ...prev,
                                      [`${clinic.id}_${surgeon.id}`]: event.target.value,
                                    }))
                                  }
                                  placeholder="Type your question..."
                                  rows={2}
                                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-green-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendSurgeonInquiry(clinic, surgeon)}
                                  className="mt-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-500"
                                >
                                  Send Inquiry
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            </div>
          </div>
        )}

        {/* Surgeon Inquiries Section - Below Clinics Layout */}
        {activeTab === "clinics" && surgeonInquiries.length > 0 && (
          <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">My Surgeon Inquiries</h3>
            <div className="mt-2 space-y-2">
              {surgeonInquiries.slice(0, 8).map((inquiry) => (
                <div key={inquiry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">{inquiry.surgeonName} • {inquiry.clinicName}</p>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${inquiry.status === "replied" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {inquiry.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-700">{inquiry.message}</p>
                </div>
              ))}
            </div>
          </article>
        )}

        {activeTab === "profile" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">My Profile</h2>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                {profile.photoDataUrl ? (
                  <img src={profile.photoDataUrl} alt="Profile" className="h-16 w-16 rounded-full border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">👤</div>
                )}
                <div>
                  <label className="text-sm font-semibold text-slate-700">Profile Photo</label>
                  <input type="file" accept="image/*" onChange={handleProfilePhotoUpload} className="mt-1 block text-xs text-slate-600" />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={profile.displayName}
                  onChange={(e) => setProfile((prev) => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Full Name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
                <input
                  value={profile.email}
                  onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
                <input
                  value={profile.address}
                  onChange={(e) => setProfile((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Address"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={handleSaveProfile} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500">
                  Save Profile
                </button>
                <button type="button" onClick={handleDeleteProfile} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">
                  Delete Profile
                </button>
              </div>
            </article>
          </div>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-5 px-2 py-3">
          {navItems.map((item) => (
            <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className="flex flex-col items-center justify-center gap-1">
              <span className={`text-xl ${activeTab === item.id ? "text-green-500" : "text-slate-400"}`}>{item.icon}</span>
              <span className={`text-xs font-medium ${activeTab === item.id ? "text-green-500" : "text-slate-500"}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
