import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getProfileNameForRole,
  getManagedVeterinarians,
  ManagedVeterinarian,
  getVerifiedRole,
  logout,
  saveManagedVeterinarians,
  saveProfileName,
} from "../lib/session";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { registerUser } from "../lib/auth-api";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";
import { t, useLanguageStore } from "../lib/language";
import adminOpsHeroImage from "../assets/images/admin-ops-hero.jpg";
import {
  Activity,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from "lucide-react";

const CLINIC_DIRECTORY_KEY = "companion_ai_clinic_directory";
const ADMIN_PROFILE_KEY = "companion_ai_admin_profile";

type AdminSection = "overview" | "approvals" | "operations" | "clinics" | "veterinarians" | "add-veterinarian" | "governance" | "profile";

interface ApprovalItem {
  id: string;
  type: "clinic" | "veterinarian";
  name: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
}

interface Ticket {
  id: string;
  category: "booking" | "clinic" | "billing" | "abuse";
  subject: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in-progress" | "resolved";
  raisedBy: string;
}

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
}

interface ClinicUtilization {
  clinicName: string;
  bookedSlots: number;
  totalSlots: number;
  noShowRate: number;
}

interface SurgeonRecord {
  id: string;
  name: string;
  specialization: string;
  availableSlots: string[];
}

interface ClinicRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  specialization: string;
  status: "active" | "inactive";
  latitude: number;
  longitude: number;
  surgeons: SurgeonRecord[];
}

interface AdminProfile {
  name: string;
  email: string;
  phone: string;
  designation: string;
  bio: string;
  photoDataUrl: string;
}

const DEFAULT_CLINICS: ClinicRecord[] = [
  {
    id: "cl-001",
    name: "Happy Paws",
    address: "12 Lake Road, Colombo 03",
    phone: "+94 11 234 5678",
    email: "contact@happypaws.lk",
    specialization: "General Care",
    status: "active",
    latitude: 6.9157,
    longitude: 79.8636,
    surgeons: [
      {
        id: "sg-001",
        name: "Dr. Hasitha Silva",
        specialization: "General Care",
        availableSlots: ["Mon 09:00", "Mon 11:30", "Tue 14:00"],
      },
    ],
  },
  {
    id: "cl-002",
    name: "PetaMed",
    address: "88 Kandy Road, Kegalle",
    phone: "+94 35 987 6543",
    email: "support@petamed.lk",
    specialization: "Surgery",
    status: "active",
    latitude: 7.2513,
    longitude: 80.3464,
    surgeons: [
      {
        id: "sg-002",
        name: "Dr. Nethmi Fernando",
        specialization: "Surgery",
        availableSlots: ["Wed 10:00", "Thu 13:30", "Fri 09:30"],
      },
    ],
  },
  {
    id: "cl-003",
    name: "Animal Care Hub",
    address: "55 Galle Road, Matara",
    phone: "+94 41 998 1122",
    email: "hello@animalcarehub.lk",
    specialization: "Dermatology",
    status: "inactive",
    latitude: 5.9549,
    longitude: 80.554,
    surgeons: [],
  },
];

function loadClinicDirectory(): ClinicRecord[] {
  const raw = localStorage.getItem(CLINIC_DIRECTORY_KEY);
  if (!raw) return DEFAULT_CLINICS;

  try {
    const parsed = JSON.parse(raw) as ClinicRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CLINICS;

    return parsed.map((clinic) => ({
      ...clinic,
      surgeons: Array.isArray(clinic.surgeons) ? clinic.surgeons : [],
      latitude: typeof clinic.latitude === "number" ? clinic.latitude : 6.9271,
      longitude: typeof clinic.longitude === "number" ? clinic.longitude : 79.8612,
    }));
  } catch {
    return DEFAULT_CLINICS;
  }
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const role = getVerifiedRole();
  const defaultAdminName = getProfileNameForRole("admin", "Admin");
  const language = useLanguageStore((state) => state.language);

  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [editingClinicDraft, setEditingClinicDraft] = useState<ClinicRecord | null>(null);
  const [surgeonDraftByClinic, setSurgeonDraftByClinic] = useState<
    Record<string, { name: string; specialization: string; slots: string }>
  >({});
  const [veterinarians, setVeterinarians] = useState<ManagedVeterinarian[]>(() => getManagedVeterinarians());
  const [editingVetId, setEditingVetId] = useState<string | null>(null);
  const [editingVetDraft, setEditingVetDraft] = useState<ManagedVeterinarian | null>(null);
  const [vetDraft, setVetDraft] = useState({
    doctorRegistrationNumber: "",
    name: "",
    age: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    specialization: "",
    address: "",
    photoDataUrl: "",
    initialPassword: "",
  });

  const [adminProfile, setAdminProfile] = useState<AdminProfile>(() => {
    const raw = localStorage.getItem(ADMIN_PROFILE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AdminProfile>;
        return {
          name: parsed.name ?? defaultAdminName,
          email: parsed.email ?? "",
          phone: parsed.phone ?? "",
          designation: parsed.designation ?? "Platform Administrator",
          bio: parsed.bio ?? "",
          photoDataUrl: parsed.photoDataUrl ?? "",
        };
      } catch {
        // Ignore parse errors and use defaults.
      }
    }

    return {
      name: defaultAdminName,
      email: "",
      phone: "",
      designation: "Platform Administrator",
      bio: "",
      photoDataUrl: "",
    };
  });

  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    { id: "ap-101", type: "clinic", name: "Green Valley Pet Clinic", submittedAt: "2026-03-22", status: "pending" },
    { id: "ap-102", type: "veterinarian", name: "Dr. Niroshan Perera", submittedAt: "2026-03-23", status: "pending" },
    { id: "ap-103", type: "clinic", name: "Animal Care Hub", submittedAt: "2026-03-24", status: "pending" },
  ]);

  const [clinics, setClinics] = useState<ClinicRecord[]>(() => loadClinicDirectory());

  const tickets: Ticket[] = [
    { id: "tk-11", category: "booking", subject: "Double-booking conflict", priority: "high", status: "open", raisedBy: "Pet Owner - Kasun" },
    { id: "tk-12", category: "clinic", subject: "Clinic profile incorrect address", priority: "medium", status: "in-progress", raisedBy: "Clinic Manager" },
    { id: "tk-13", category: "abuse", subject: "Spam account reports", priority: "high", status: "open", raisedBy: "Automated moderation" },
  ];

  const auditLogs: AuditLog[] = [
    { id: "log-1", action: "Updated slot policy", actor: "Admin - Mahela", target: "Global Config", timestamp: "09:21 AM" },
    { id: "log-2", action: "Approved clinic", actor: "Admin - Mahela", target: "City PetCare", timestamp: "08:45 AM" },
    { id: "log-3", action: "Suspended user", actor: "Admin - Kavindu", target: "owner_223", timestamp: "Yesterday" },
  ];

  const clinicUtilization: ClinicUtilization[] = [
    { clinicName: "Happy Paws", bookedSlots: 44, totalSlots: 50, noShowRate: 6 },
    { clinicName: "PetaMed", bookedSlots: 28, totalSlots: 60, noShowRate: 18 },
    { clinicName: "Animal Care Hub", bookedSlots: 52, totalSlots: 55, noShowRate: 4 },
  ];

  const platformHealth = {
    activeClinics: 27,
    activeVeterinarians: veterinarians.filter((vet) => vet.status === "active").length,
    todaysBookings: 148,
    cancellationRate: 9.2,
    avgConfirmTimeMins: 12,
    servicesOnline: 6,
    servicesTotal: 6,
  };

  const openApprovals = approvals.filter((item) => item.status === "pending").length;
  const openHighPriorityTickets = tickets.filter((ticket) => ticket.priority === "high" && ticket.status !== "resolved").length;

  const utilizationSummary = useMemo(() => {
    const totalBooked = clinicUtilization.reduce((sum, clinic) => sum + clinic.bookedSlots, 0);
    const totalSlots = clinicUtilization.reduce((sum, clinic) => sum + clinic.totalSlots, 0);
    const avgNoShow = clinicUtilization.reduce((sum, clinic) => sum + clinic.noShowRate, 0) / clinicUtilization.length;
    return {
      utilizationPct: totalSlots ? Math.round((totalBooked / totalSlots) * 100) : 0,
      avgNoShow: Number(avgNoShow.toFixed(1)),
    };
  }, [clinicUtilization]);

  useEffect(() => {
    localStorage.setItem(CLINIC_DIRECTORY_KEY, JSON.stringify(clinics));
  }, [clinics]);

  useEffect(() => {
    saveManagedVeterinarians(veterinarians);
  }, [veterinarians]);

  if (role !== "admin") {
    navigate("/pets");
    return null;
  }

  const displayName = adminProfile.name.trim() || defaultAdminName;
  const firstName = displayName.trim().split(/\s+/)[0] || "Admin";
  const adminInitial = displayName.trim().charAt(0).toUpperCase() || "A";

  const sidebarItems: Array<{ id: AdminSection; label: string; icon: typeof User; badge?: number }> = [
    { id: "overview", label: t(language, "overview"), icon: LayoutDashboard },
    { id: "approvals", label: t(language, "approvals"), icon: ClipboardCheck },
    { id: "operations", label: t(language, "operations"), icon: Activity },
    { id: "clinics", label: t(language, "clinics"), icon: Building2 },
    { id: "veterinarians", label: t(language, "veterinarians"), icon: UserPlus },
    { id: "governance", label: language === "si" ? "පාලනය" : language === "ta" ? "ஆளுகை" : "Governance", icon: ShieldCheck },
    { id: "profile", label: t(language, "profile"), icon: User },
  ];

  const headerTitle =
    activeSection === "add-veterinarian"
      ? "Add Veterinarian"
      : sidebarItems.find((item) => item.id === activeSection)?.label ?? t(language, "overview");

  function handleSelectSection(section: AdminSection) {
    setActiveSection(section);
    setMobileNavOpen(false);
  }

  function handleLogout() {
    logout();
    navigate("/auth/login", { replace: true });
  }

  function handleApprovalDecision(id: string, decision: "approved" | "rejected") {
    setApprovals((prev) => prev.map((item) => (item.id === id ? { ...item, status: decision } : item)));
  }

  function handleBroadcastSend() {
    if (!broadcastMessage.trim()) return;
    setBroadcastMessage("");
    alert("Broadcast sent to clinics and veterinarians.");
  }

  function startClinicEdit(clinic: ClinicRecord) {
    setEditingClinicId(clinic.id);
    setEditingClinicDraft({ ...clinic });
  }

  function cancelClinicEdit() {
    setEditingClinicId(null);
    setEditingClinicDraft(null);
  }

  function saveClinicEdit() {
    if (!editingClinicId || !editingClinicDraft) return;
    setClinics((prev) => prev.map((clinic) => (clinic.id === editingClinicId ? { ...editingClinicDraft } : clinic)));
    setEditingClinicId(null);
    setEditingClinicDraft(null);
  }

  function deleteClinic(clinicId: string, clinicName: string) {
    const confirmed = window.confirm(`Delete clinic "${clinicName}"? This action cannot be undone.`);
    if (!confirmed) return;

    setClinics((prev) => prev.filter((clinic) => clinic.id !== clinicId));
    if (editingClinicId === clinicId) {
      setEditingClinicId(null);
      setEditingClinicDraft(null);
    }
  }

  function updateSurgeonDraft(clinicId: string, field: "name" | "specialization" | "slots", value: string) {
    setSurgeonDraftByClinic((prev) => ({
      ...prev,
      [clinicId]: {
        name: prev[clinicId]?.name || "",
        specialization: prev[clinicId]?.specialization || "",
        slots: prev[clinicId]?.slots || "",
        [field]: value,
      },
    }));
  }

  function addSurgeonToClinic(clinicId: string) {
    const draft = surgeonDraftByClinic[clinicId];
    if (!draft?.name.trim()) {
      alert("Enter surgeon name.");
      return;
    }

    const slots = draft.slots
      .split(",")
      .map((slot) => slot.trim())
      .filter(Boolean);

    setClinics((prev) =>
      prev.map((clinic) => {
        if (clinic.id !== clinicId) return clinic;

        const surgeon: SurgeonRecord = {
          id: `sg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: draft.name.trim(),
          specialization: draft.specialization.trim() || clinic.specialization,
          availableSlots: slots,
        };

        return {
          ...clinic,
          surgeons: [...clinic.surgeons, surgeon],
        };
      }),
    );

    setSurgeonDraftByClinic((prev) => ({
      ...prev,
      [clinicId]: { name: "", specialization: "", slots: "" },
    }));
  }

  function removeSurgeonFromClinic(clinicId: string, surgeonId: string) {
    setClinics((prev) =>
      prev.map((clinic) =>
        clinic.id === clinicId
          ? { ...clinic, surgeons: clinic.surgeons.filter((surgeon) => surgeon.id !== surgeonId) }
          : clinic,
      ),
    );
  }

  async function handleAddVeterinarian() {
    const requiredFields = [
      vetDraft.doctorRegistrationNumber,
      vetDraft.name,
      vetDraft.age,
      vetDraft.email,
      vetDraft.phone,
      vetDraft.gender,
      vetDraft.dateOfBirth,
      vetDraft.specialization,
      vetDraft.initialPassword,
    ];

    if (requiredFields.some((field) => !field.trim())) {
      alert("Fill all required veterinarian details.");
      return;
    }

    const normalizedEmail = vetDraft.email.trim().toLowerCase();
    const normalizedRegNo = vetDraft.doctorRegistrationNumber.trim().toUpperCase();

    const duplicate = veterinarians.some(
      (vet) =>
        vet.email.trim().toLowerCase() === normalizedEmail
        || vet.doctorRegistrationNumber.trim().toUpperCase() === normalizedRegNo,
    );

    if (duplicate) {
      alert("A veterinarian with this email or doctor registration number already exists.");
      return;
    }

    try {
      await registerUser({
        email: normalizedEmail,
        password: vetDraft.initialPassword,
        displayName: vetDraft.name.trim(),
        phoneNumber: vetDraft.phone.trim(),
        role: "veterinarian",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create veterinarian account.";
      alert(message);
      return;
    }

    const newVet: ManagedVeterinarian = {
      id: `vet-${Date.now()}`,
      doctorRegistrationNumber: normalizedRegNo,
      name: vetDraft.name.trim(),
      age: vetDraft.age.trim(),
      email: normalizedEmail,
      phone: vetDraft.phone.trim(),
      gender: vetDraft.gender.trim(),
      dateOfBirth: vetDraft.dateOfBirth,
      specialization: vetDraft.specialization.trim(),
      address: vetDraft.address.trim(),
      photoDataUrl: vetDraft.photoDataUrl || "",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    setVeterinarians((prev) => [newVet, ...prev]);
    setVetDraft({
      doctorRegistrationNumber: "",
      name: "",
      age: "",
      email: "",
      phone: "",
      gender: "",
      dateOfBirth: "",
      specialization: "",
      address: "",
      photoDataUrl: "",
      initialPassword: "",
    });
    alert("Veterinarian added and account created. Share the temporary password securely.");
  }

  function startVetEdit(vet: ManagedVeterinarian) {
    setEditingVetId(vet.id);
    setEditingVetDraft({ ...vet });
  }

  function cancelVetEdit() {
    setEditingVetId(null);
    setEditingVetDraft(null);
  }

  function saveVetEdit() {
    if (!editingVetId || !editingVetDraft) return;

    if (!editingVetDraft.name.trim() || !editingVetDraft.phone.trim() || !editingVetDraft.specialization.trim()) {
      alert("Name, phone, and specialization are required.");
      return;
    }

    setVeterinarians((prev) =>
      prev.map((vet) => (vet.id === editingVetId ? { ...editingVetDraft } : vet)),
    );
    setEditingVetId(null);
    setEditingVetDraft(null);
  }

  function handleDeleteVeterinarian(id: string, name: string) {
    const confirmed = window.confirm(`Delete veterinarian "${name}"?`);
    if (!confirmed) return;
    setVeterinarians((prev) => prev.filter((vet) => vet.id !== id));
  }

  function toggleVeterinarianStatus(id: string) {
    setVeterinarians((prev) =>
      prev.map((vet) =>
        vet.id === id
          ? { ...vet, status: vet.status === "active" ? "inactive" : "active" }
          : vet,
      ),
    );
  }

  function handleVetDraftPhotoChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setVetDraft((prev) => ({ ...prev, photoDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  function handleEditingVetPhotoChange(file: File | null) {
    if (!file || !editingVetDraft) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setEditingVetDraft((prev) => (prev ? { ...prev, photoDataUrl: dataUrl } : prev));
    };
    reader.readAsDataURL(file);
  }

  function handleProfilePhotoChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setAdminProfile((prev) => ({ ...prev, photoDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  function handleSaveProfile() {
    const normalizedName = adminProfile.name.trim() || defaultAdminName;
    const nextProfile = { ...adminProfile, name: normalizedName };
    setAdminProfile(nextProfile);
    localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(nextProfile));
    saveProfileName(normalizedName, "admin");
    alert("Profile saved");
  }

  function handleDeleteProfile() {
    const confirmed = window.confirm("Delete admin profile details?");
    if (!confirmed) return;

    const resetProfile: AdminProfile = {
      name: defaultAdminName,
      email: "",
      phone: "",
      designation: "Platform Administrator",
      bio: "",
      photoDataUrl: "",
    };

    localStorage.removeItem(ADMIN_PROFILE_KEY);
    setAdminProfile(resetProfile);
    saveProfileName(defaultAdminName, "admin");
  }

  return (
    <div className="flex min-h-dvh w-full overflow-hidden bg-surface-secondary dark:bg-neutral-950">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border/80 bg-surface lg:flex dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-fg dark:bg-surface">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white dark:fill-neutral-900">
              <ellipse cx="12" cy="17.5" rx="3.5" ry="3" />
              <circle cx="8.2" cy="11.2" r="1.8" />
              <circle cx="15.8" cy="11.2" r="1.8" />
              <circle cx="6.5" cy="14.8" r="1.6" />
              <circle cx="17.5" cy="14.8" r="1.6" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-accent dark:text-white">PetCare AI</span>
        </div>

        <Separator className="dark:bg-neutral-800" />

        <nav className="flex-1 px-3 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle">Menu</p>
          <div className="space-y-0.5">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-100",
                  activeSection === item.id
                    ? "bg-primary text-primary-fg shadow-sm"
                    : "text-accent-subtle hover:bg-surface-tertiary hover:text-accent-muted dark:text-accent-faint dark:hover:bg-primary dark:hover:text-neutral-200",
                )}
              >
                <item.icon className="h-[15px] w-[15px]" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-current">{item.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
        </nav>

        <div className="px-3 pb-2">
          <LanguageSwitcher />
          <ThemeSwitcher compact />
        </div>

        <div className="border-t border-border/80 p-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => handleSelectSection("profile")}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-surface-tertiary dark:hover:bg-primary"
          >
            <Avatar className="h-7 w-7">
              {adminProfile.photoDataUrl ? <AvatarImage src={adminProfile.photoDataUrl} alt="Admin profile" /> : null}
              <AvatarFallback className="text-[11px]">{adminInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-accent dark:text-white">{displayName}</p>
              <p className="text-[10px] text-accent-faint dark:text-accent-subtle">Administrator</p>
            </div>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12px] font-medium text-accent-faint transition hover:bg-surface-tertiary hover:text-accent-muted dark:hover:bg-primary dark:hover:text-neutral-300"
          >
            <LogOut className="h-3.5 w-3.5" />Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-surface px-4 lg:px-8 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="rounded-md p-1.5 text-accent-subtle hover:bg-surface-tertiary lg:hidden dark:hover:bg-primary"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden h-5 w-px bg-neutral-200 lg:block dark:bg-neutral-700" />
            <h1 className="text-[13px] font-semibold text-accent dark:text-white">{headerTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <ThemeSwitcher compact />
            <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
              <Sparkles className="h-3 w-3" />AI Active
            </Badge>
            <Avatar className="h-7 w-7 cursor-pointer" onClick={() => handleSelectSection("profile")}>
              {adminProfile.photoDataUrl ? <AvatarImage src={adminProfile.photoDataUrl} alt="Admin profile" /> : null}
              <AvatarFallback className="text-[11px]">{adminInitial}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="animate-slide-down border-b border-border bg-surface p-2 lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                  activeSection === item.id
                    ? "bg-surface-tertiary text-accent dark:bg-neutral-800 dark:text-white"
                    : "text-accent-subtle dark:text-accent-faint",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
            <Separator className="my-1 dark:bg-neutral-800" />
            <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-accent-faint">
              <LogOut className="h-4 w-4" />Sign out
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">
            {activeSection === "overview" ? (
              <section className="mb-6">
                <p className="text-base leading-6 text-slate-500 dark:text-accent-subtle">Welcome back,</p>
                <h2 className="mt-1 text-3xl font-semibold leading-tight text-slate-900 dark:text-white">{firstName}</h2>
                <p className="mt-1 text-base text-accent-subtle dark:text-accent-faint">Platform administration at a glance.</p>
              </section>
            ) : null}

            <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
              <div className="flex gap-6 overflow-x-auto">
                {sidebarItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSection(item.id)}
                    className={cn(
                      "flex-shrink-0 border-b-2 px-1 py-3 text-sm font-medium transition",
                      activeSection === item.id
                        ? "border-primary text-primary"
                        : "border-transparent text-accent-subtle hover:text-slate-900 dark:hover:text-white",
                    )}
                  >
                    {item.label}
                    {item.badge && item.badge > 0 ? ` (${item.badge})` : ""}
                  </button>
                ))}
              </div>
            </section>

            {activeSection === "overview" ? (
              <section className="mt-4 space-y-4">
                <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <img src={adminOpsHeroImage} alt="Veterinary operations workspace" className="h-36 w-full object-cover" />
                  <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Active Clinics</p>
                      <p className="mt-1 text-3xl font-bold text-emerald-800 dark:text-emerald-200">{platformHealth.activeClinics}</p>
                    </div>
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
                      <p className="text-sm font-medium text-sky-700 dark:text-sky-300">Active Veterinarians</p>
                      <p className="mt-1 text-3xl font-bold text-sky-800 dark:text-sky-200">{platformHealth.activeVeterinarians}</p>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
                      <p className="text-sm font-medium text-violet-700 dark:text-violet-300">Today&apos;s Bookings</p>
                      <p className="mt-1 text-3xl font-bold text-violet-800 dark:text-violet-200">{platformHealth.todaysBookings}</p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                      <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Cancellation Rate</p>
                      <p className="mt-1 text-3xl font-bold text-rose-800 dark:text-rose-200">{platformHealth.cancellationRate}%</p>
                    </div>
                  </div>
                </article>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Operational Snapshot</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Pending Approvals</p>
                        <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-200">{openApprovals}</p>
                      </div>
                      <div className="rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
                        <p className="text-xs font-medium text-red-700 dark:text-red-300">High Priority Tickets</p>
                        <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-200">{openHighPriorityTickets}</p>
                      </div>
                      <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Avg Confirm Time</p>
                        <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-200">{platformHealth.avgConfirmTimeMins}m</p>
                      </div>
                    </div>

                    <h4 className="mt-5 text-sm font-semibold text-accent-muted dark:text-accent-subtle">Audit Trail</h4>
                    <ul className="mt-2 space-y-2">
                      {auditLogs.map((log, idx) => (
                        <li
                          key={log.id}
                          className={cn(
                            "rounded-xl border p-3 text-sm",
                            idx % 2 === 0
                              ? "border-sky-100 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20"
                              : "border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20",
                          )}
                        >
                          <p className="font-medium text-slate-800 dark:text-slate-100">{log.action}</p>
                          <p className="mt-1 text-accent-subtle dark:text-accent-faint">
                            {log.actor} • {log.target} • {log.timestamp}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Broadcast Notice</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-accent-subtle">Send updates to all clinics and vets.</p>
                    <textarea
                      value={broadcastMessage}
                      onChange={(event) => setBroadcastMessage(event.target.value)}
                      className="mt-3 h-28 w-full rounded-xl border border-border-strong bg-surface p-3 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                      placeholder="Example: System maintenance at 10:00 PM tonight."
                    />
                    <Button type="button" onClick={handleBroadcastSend} className="mt-3 w-full">Send Broadcast</Button>
                  </article>
                </div>
              </section>
            ) : null}

            {activeSection === "approvals" ? (
              <section className="mt-4 space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Approval and Verification Queue</h2>
                {approvals.map((item) => (
                  <article
                    key={item.id}
                    className={cn(
                      "rounded-2xl border p-4 shadow-sm",
                      item.type === "clinic"
                        ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                        : "border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-accent-subtle dark:text-accent-faint">{item.type === "clinic" ? "Clinic" : "Veterinarian"} Verification</p>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{item.name}</h3>
                        <p className="text-sm text-accent-subtle dark:text-accent-faint">Submitted on {item.submittedAt}</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          item.status === "pending"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                            : item.status === "approved"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300",
                        )}
                      >
                        {item.status}
                      </span>
                    </div>

                    {item.status === "pending" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" onClick={() => handleApprovalDecision(item.id, "approved")}>Approve</Button>
                        <Button type="button" variant="danger" onClick={() => handleApprovalDecision(item.id, "rejected")}>Reject</Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </section>
            ) : null}

            {activeSection === "operations" ? (
              <section className="mt-4 space-y-5">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Booking Operations and Capacity</h2>

                <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Clinic Slot Utilization</h3>
                  <p className="text-sm text-slate-500 dark:text-accent-subtle">
                    Utilization {utilizationSummary.utilizationPct}% • Avg no-show {utilizationSummary.avgNoShow}%
                  </p>
                  <div className="mt-3 space-y-3">
                    {clinicUtilization.map((clinic) => {
                      const pct = Math.round((clinic.bookedSlots / clinic.totalSlots) * 100);
                      return (
                        <div key={clinic.clinicName} className="rounded-xl border border-border bg-surface-tertiary p-3 dark:border-neutral-800 dark:bg-neutral-800/60">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <p className="font-semibold text-slate-800 dark:text-white">{clinic.clinicName}</p>
                            <p className="text-accent-subtle dark:text-accent-faint">{clinic.bookedSlots}/{clinic.totalSlots} slots</p>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-neutral-700">
                            <div
                              className={cn("h-2 rounded-full", pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-accent-subtle">
                            No-show rate:{" "}
                            <span className={clinic.noShowRate >= 15 ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>
                              {clinic.noShowRate}%
                            </span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Dispute and Support Tickets</h3>
                  <div className="mt-3 space-y-2">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-xl border border-border p-3 dark:border-neutral-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-800 dark:text-white">{ticket.subject}</p>
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-xs font-semibold",
                              ticket.priority === "high"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                                : ticket.priority === "medium"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                                  : "bg-slate-100 text-accent-muted dark:bg-neutral-700 dark:text-accent-faint",
                            )}
                          >
                            {ticket.priority}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-accent-subtle dark:text-accent-faint">
                          {ticket.category} • {ticket.raisedBy} • {ticket.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            ) : null}

            {activeSection === "governance" ? (
              <section className="mt-4 grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-fuchsia-200 bg-gradient-to-b from-fuchsia-50 to-white p-4 shadow-sm dark:border-fuchsia-900/40 dark:from-fuchsia-950/20 dark:to-neutral-900">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Access Governance</h3>
                  <ul className="mt-3 space-y-2 text-sm text-accent-muted dark:text-accent-faint">
                    <li className="rounded-lg bg-fuchsia-100/60 p-3 dark:bg-fuchsia-950/30">Role reviews due this week: 8 users</li>
                    <li className="rounded-lg bg-fuchsia-100/60 p-3 dark:bg-fuchsia-950/30">Suspended clinics pending reactivation: 2</li>
                    <li className="rounded-lg bg-fuchsia-100/60 p-3 dark:bg-fuchsia-950/30">Unverified vet licenses: 5</li>
                  </ul>
                </article>

                <article className="rounded-2xl border border-cyan-200 bg-gradient-to-b from-cyan-50 to-white p-4 shadow-sm dark:border-cyan-900/40 dark:from-cyan-950/20 dark:to-neutral-900">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Global Configuration</h3>
                  <div className="mt-3 space-y-2 text-sm text-accent-muted dark:text-accent-faint">
                    <label className="flex items-center justify-between rounded-lg bg-cyan-100/70 p-3 dark:bg-cyan-950/30">
                      <span>Enable automatic slot conflict checks</span>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label className="flex items-center justify-between rounded-lg bg-cyan-100/70 p-3 dark:bg-cyan-950/30">
                      <span>Require vet re-verification every 6 months</span>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label className="flex items-center justify-between rounded-lg bg-cyan-100/70 p-3 dark:bg-cyan-950/30">
                      <span>Allow emergency booking overrides</span>
                      <input type="checkbox" />
                    </label>
                  </div>
                </article>
              </section>
            ) : null}

            {activeSection === "clinics" ? (
              <section className="mt-4 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Manage Existing Clinics</h2>
                  <p className="mt-1 text-sm text-accent-subtle dark:text-accent-faint">
                    Update clinic profile details, contact information, specialization, and active status.
                  </p>
                </div>

                <div className="space-y-3">
                  {clinics.map((clinic) => {
                    const isEditing = editingClinicId === clinic.id;
                    const draft = isEditing ? editingClinicDraft : null;

                    return (
                      <article key={clinic.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{clinic.name}</h3>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              clinic.status === "active"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "bg-slate-200 text-accent-muted dark:bg-neutral-700 dark:text-accent-faint",
                            )}
                          >
                            {clinic.status}
                          </span>
                        </div>

                        {isEditing && draft ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <Input value={draft.name} onChange={(event) => setEditingClinicDraft({ ...draft, name: event.target.value })} placeholder="Clinic Name" />
                            <Input value={draft.specialization} onChange={(event) => setEditingClinicDraft({ ...draft, specialization: event.target.value })} placeholder="Specialization" />
                            <Input value={draft.phone} onChange={(event) => setEditingClinicDraft({ ...draft, phone: event.target.value })} placeholder="Phone" />
                            <Input value={draft.email} onChange={(event) => setEditingClinicDraft({ ...draft, email: event.target.value })} placeholder="Email" />
                            <Input value={draft.address} onChange={(event) => setEditingClinicDraft({ ...draft, address: event.target.value })} className="md:col-span-2" placeholder="Address" />
                            <Input
                              type="number"
                              step="0.0001"
                              value={draft.latitude}
                              onChange={(event) => setEditingClinicDraft({ ...draft, latitude: Number(event.target.value) })}
                              placeholder="Latitude"
                            />
                            <Input
                              type="number"
                              step="0.0001"
                              value={draft.longitude}
                              onChange={(event) => setEditingClinicDraft({ ...draft, longitude: Number(event.target.value) })}
                              placeholder="Longitude"
                            />
                            <select
                              value={draft.status}
                              onChange={(event) => setEditingClinicDraft({ ...draft, status: event.target.value as "active" | "inactive" })}
                              className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>

                            <div className="flex flex-wrap gap-2 md:col-span-2">
                              <Button type="button" onClick={saveClinicEdit}>Save Changes</Button>
                              <Button type="button" variant="secondary" onClick={cancelClinicEdit}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-1 text-sm text-accent-muted dark:text-accent-faint">
                            <p><span className="font-medium">Address:</span> {clinic.address}</p>
                            <p><span className="font-medium">Phone:</span> {clinic.phone}</p>
                            <p><span className="font-medium">Email:</span> {clinic.email}</p>
                            <p><span className="font-medium">Specialization:</span> {clinic.specialization}</p>
                            <p><span className="font-medium">Coordinates:</span> {clinic.latitude.toFixed(4)}, {clinic.longitude.toFixed(4)}</p>

                            <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-neutral-800/60">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">Surgeons and Available Time Slots</p>
                              {clinic.surgeons.length === 0 ? (
                                <p className="mt-2 text-xs text-slate-500 dark:text-accent-subtle">No surgeons assigned yet.</p>
                              ) : (
                                <div className="mt-2 space-y-2">
                                  {clinic.surgeons.map((surgeon) => (
                                    <div key={surgeon.id} className="rounded-lg border border-border bg-surface p-2 dark:border-neutral-700 dark:bg-neutral-900">
                                      <div className="flex items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{surgeon.name}</p>
                                          <p className="text-xs text-accent-subtle dark:text-accent-faint">{surgeon.specialization}</p>
                                        </div>
                                        <Button type="button" size="sm" variant="secondary" onClick={() => removeSurgeonFromClinic(clinic.id, surgeon.id)}>
                                          Remove
                                        </Button>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {surgeon.availableSlots.length === 0 ? (
                                          <span className="text-xs text-slate-500 dark:text-accent-subtle">No slots specified</span>
                                        ) : (
                                          surgeon.availableSlots.map((slot) => (
                                            <span key={slot} className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                              {slot}
                                            </span>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="mt-3 grid gap-2 md:grid-cols-3">
                                <Input
                                  value={surgeonDraftByClinic[clinic.id]?.name || ""}
                                  onChange={(event) => updateSurgeonDraft(clinic.id, "name", event.target.value)}
                                  placeholder="Surgeon name"
                                />
                                <Input
                                  value={surgeonDraftByClinic[clinic.id]?.specialization || ""}
                                  onChange={(event) => updateSurgeonDraft(clinic.id, "specialization", event.target.value)}
                                  placeholder="Specialization"
                                />
                                <Input
                                  value={surgeonDraftByClinic[clinic.id]?.slots || ""}
                                  onChange={(event) => updateSurgeonDraft(clinic.id, "slots", event.target.value)}
                                  placeholder="Slots e.g. Mon 09:00, Tue 14:30"
                                />
                              </div>

                              <Button type="button" onClick={() => addSurgeonToClinic(clinic.id)} className="mt-2">
                                Add Surgeon and Slots
                              </Button>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button type="button" onClick={() => startClinicEdit(clinic)}>Edit Clinic</Button>
                              <Button type="button" variant="danger" onClick={() => deleteClinic(clinic.id, clinic.name)}>Delete Clinic</Button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {clinics.length === 0 ? (
                    <article className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center text-accent-subtle dark:border-neutral-700 dark:bg-neutral-900 dark:text-accent-faint">
                      No clinics available. Add or approve clinics to manage them here.
                    </article>
                  ) : null}
                </div>
              </section>
            ) : null}

            {activeSection === "veterinarians" ? (
              <section className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={() => handleSelectSection("add-veterinarian")}>{t(language, "addVet")}</Button>
                    <Badge variant="outline">Available vets: {veterinarians.length}</Badge>
                  </div>
                  <p className="text-sm text-accent-subtle dark:text-accent-faint">
                    {language === "si" ? "ඇඩ්මින් විසින් එකතු කළ වෙට්වරුන්ට පමණක් වෙට් ලෙස පිවිසිය හැක." : language === "ta" ? "நிர்வாகியால் சேர்க்கப்பட்ட வெட்டுகள் மட்டுமே வெட் ஆக உள்நுழைய முடியும்." : "Only admin-admitted vets can sign in as veterinarians."}
                  </p>
                </div>

                <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">{language === "si" ? "වෙට්වරුන්ගේ වගුව" : language === "ta" ? "வெட் அட்டவணை" : "Veterinarian Table"}</h3>
                  {veterinarians.length === 0 ? (
                    <p className="mt-2 text-sm text-accent-subtle dark:text-accent-faint">{language === "si" ? "තවම වෙට් එකතු කර නැත." : language === "ta" ? "இதுவரை வெட் சேர்க்கப்படவில்லை." : "No veterinarians added yet."}</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border dark:border-neutral-800">
                            <th className="px-3 py-2 font-semibold text-accent-muted dark:text-accent-faint">{t(language, "id")}</th>
                            <th className="px-3 py-2 font-semibold text-accent-muted dark:text-accent-faint">{t(language, "name")}</th>
                            <th className="px-3 py-2 font-semibold text-accent-muted dark:text-accent-faint">{t(language, "registrationNumber")}</th>
                            <th className="px-3 py-2 font-semibold text-accent-muted dark:text-accent-faint">{t(language, "specialization")}</th>
                            <th className="px-3 py-2 font-semibold text-accent-muted dark:text-accent-faint">{t(language, "status")}</th>
                            <th className="px-3 py-2 font-semibold text-accent-muted dark:text-accent-faint">{t(language, "email")}</th>
                            <th className="px-3 py-2 font-semibold text-accent-muted dark:text-accent-faint">{t(language, "phone")}</th>
                            <th className="px-3 py-2 font-semibold text-accent-muted dark:text-accent-faint">{t(language, "actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {veterinarians.map((vet) => (
                            <tr key={vet.id} className="border-b border-border/70 dark:border-neutral-800/70">
                              <td className="px-3 py-2 text-accent-subtle dark:text-accent-faint">{vet.id}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    {vet.photoDataUrl ? <AvatarImage src={vet.photoDataUrl} alt={vet.name} /> : null}
                                    <AvatarFallback>{vet.name.charAt(0).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-slate-900 dark:text-white">{vet.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-accent-subtle dark:text-accent-faint">{vet.doctorRegistrationNumber}</td>
                              <td className="px-3 py-2 text-accent-subtle dark:text-accent-faint">{vet.specialization}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-1 text-[10px] font-semibold",
                                    vet.status === "active"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                      : "bg-slate-200 text-slate-700 dark:bg-neutral-700 dark:text-neutral-200",
                                  )}
                                >
                                  {vet.status === "active" ? t(language, "available") : t(language, "notAvailable")}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-accent-subtle dark:text-accent-faint">{vet.email}</td>
                              <td className="px-3 py-2 text-accent-subtle dark:text-accent-faint">{vet.phone}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  <Button type="button" size="sm" variant="secondary" onClick={() => startVetEdit(vet)}>{t(language, "edit")}</Button>
                                  <Button type="button" size="sm" variant="secondary" onClick={() => toggleVeterinarianStatus(vet.id)}>
                                    {vet.status === "active" ? t(language, "notAvailable") : t(language, "available")}
                                  </Button>
                                  <Button type="button" size="sm" variant="danger" onClick={() => handleDeleteVeterinarian(vet.id, vet.name)}>{t(language, "delete")}</Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {editingVetId && editingVetDraft ? (
                    <div className="mt-4 rounded-xl border border-border p-3 dark:border-neutral-800">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{language === "si" ? "වෙට් සංස්කරණය" : language === "ta" ? "வெட் திருத்தம்" : "Edit Veterinarian"}</h4>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "registrationNumber")}</Label>
                          <Input value={editingVetDraft.doctorRegistrationNumber} disabled />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "email")}</Label>
                          <Input value={editingVetDraft.email} disabled />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "name")}</Label>
                          <Input value={editingVetDraft.name} onChange={(e) => setEditingVetDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "age")}</Label>
                          <Input value={editingVetDraft.age} onChange={(e) => setEditingVetDraft((prev) => (prev ? { ...prev, age: e.target.value } : prev))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "phone")}</Label>
                          <Input value={editingVetDraft.phone} onChange={(e) => setEditingVetDraft((prev) => (prev ? { ...prev, phone: e.target.value } : prev))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "gender")}</Label>
                          <select
                            value={editingVetDraft.gender}
                            onChange={(e) => setEditingVetDraft((prev) => (prev ? { ...prev, gender: e.target.value } : prev))}
                            className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "dateOfBirth")}</Label>
                          <Input type="date" value={editingVetDraft.dateOfBirth} onChange={(e) => setEditingVetDraft((prev) => (prev ? { ...prev, dateOfBirth: e.target.value } : prev))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "specialization")}</Label>
                          <Input value={editingVetDraft.specialization} onChange={(e) => setEditingVetDraft((prev) => (prev ? { ...prev, specialization: e.target.value } : prev))} />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs">{t(language, "address")}</Label>
                          <Input value={editingVetDraft.address} onChange={(e) => setEditingVetDraft((prev) => (prev ? { ...prev, address: e.target.value } : prev))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "status")}</Label>
                          <select
                            value={editingVetDraft.status}
                            onChange={(e) => setEditingVetDraft((prev) => (prev ? { ...prev, status: e.target.value as "active" | "inactive" } : prev))}
                            className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          >
                            <option value="active">{t(language, "available")}</option>
                            <option value="inactive">{t(language, "notAvailable")}</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t(language, "profilePhoto")}</Label>
                          <Input type="file" accept="image/*" onChange={(e) => handleEditingVetPhotoChange(e.target.files?.[0] ?? null)} />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" onClick={saveVetEdit}>{t(language, "save")}</Button>
                        <Button type="button" variant="secondary" onClick={cancelVetEdit}>{t(language, "cancel")}</Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              </section>
            ) : null}

            {activeSection === "add-veterinarian" ? (
              <section className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Button type="button" variant="secondary" onClick={() => handleSelectSection("veterinarians")}>{t(language, "back")}</Button>
                </div>

                <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t(language, "addVet")}</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "registrationNumber")}</Label>
                      <Input value={vetDraft.doctorRegistrationNumber} onChange={(e) => setVetDraft((prev) => ({ ...prev, doctorRegistrationNumber: e.target.value }))} placeholder="VET-REG-001" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "name")}</Label>
                      <Input value={vetDraft.name} onChange={(e) => setVetDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Dr. Jane Perera" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "age")}</Label>
                      <Input value={vetDraft.age} onChange={(e) => setVetDraft((prev) => ({ ...prev, age: e.target.value }))} placeholder="34" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "email")}</Label>
                      <Input type="email" value={vetDraft.email} onChange={(e) => setVetDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="vet@example.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "phone")}</Label>
                      <Input value={vetDraft.phone} onChange={(e) => setVetDraft((prev) => ({ ...prev, phone: e.target.value }))} placeholder="0712345678" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "gender")}</Label>
                      <select
                        value={vetDraft.gender}
                        onChange={(e) => setVetDraft((prev) => ({ ...prev, gender: e.target.value }))}
                        className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/5 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                      >
                        <option value="">{language === "si" ? "තෝරන්න" : language === "ta" ? "தேர்ந்தெடுக்கவும்" : "Select"}</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "dateOfBirth")}</Label>
                      <Input type="date" value={vetDraft.dateOfBirth} onChange={(e) => setVetDraft((prev) => ({ ...prev, dateOfBirth: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "specialization")}</Label>
                      <Input value={vetDraft.specialization} onChange={(e) => setVetDraft((prev) => ({ ...prev, specialization: e.target.value }))} placeholder="Orthopedics" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t(language, "password")}</Label>
                      <Input type="password" value={vetDraft.initialPassword} onChange={(e) => setVetDraft((prev) => ({ ...prev, initialPassword: e.target.value }))} placeholder="Set initial password" />
                    </div>
                    <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                      <Label className="text-xs">{t(language, "address")}</Label>
                      <Input value={vetDraft.address} onChange={(e) => setVetDraft((prev) => ({ ...prev, address: e.target.value }))} placeholder="No. 10, Main Street" />
                    </div>
                    <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                      <Label className="text-xs">{t(language, "profilePhoto")}</Label>
                      <Input type="file" accept="image/*" onChange={(e) => handleVetDraftPhotoChange(e.target.files?.[0] ?? null)} />
                    </div>
                    <div className="md:col-span-2 lg:col-span-1">
                      <p className="text-xs text-accent-subtle dark:text-accent-faint">{language === "si" ? "පෙරදසුන" : language === "ta" ? "முன்னோட்டம்" : "Preview"}</p>
                      <div className="mt-2">
                        <Avatar className="h-16 w-16">
                          {vetDraft.photoDataUrl ? <AvatarImage src={vetDraft.photoDataUrl} alt="Vet preview" /> : null}
                          <AvatarFallback>{vetDraft.name.trim().charAt(0).toUpperCase() || "V"}</AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" onClick={handleAddVeterinarian}>{language === "si" ? "වෙට් ගිණුම සාදන්න" : language === "ta" ? "வெட் கணக்கு உருவாக்கவும்" : "Create Vet Account"}</Button>
                    <Button type="button" variant="secondary" onClick={() => handleSelectSection("veterinarians")}>{t(language, "cancel")}</Button>
                  </div>
                </article>
              </section>
            ) : null}

            {activeSection === "profile" ? (
              <section className="mt-4 space-y-4">
                <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="h-16 w-16">
                      {adminProfile.photoDataUrl ? <AvatarImage src={adminProfile.photoDataUrl} alt="Admin profile" /> : null}
                      <AvatarFallback className="text-lg font-semibold">{adminInitial}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle">Profile</p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Administrator Details</h2>
                      <p className="mt-1 text-sm text-accent-subtle dark:text-accent-faint">Manage your account, contact details, and profile photo.</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-accent-subtle">Full Name</Label>
                      <Input value={adminProfile.name} onChange={(e) => setAdminProfile((prev) => ({ ...prev, name: e.target.value }))} placeholder="Admin Name" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-accent-subtle">Designation</Label>
                      <Input value={adminProfile.designation} onChange={(e) => setAdminProfile((prev) => ({ ...prev, designation: e.target.value }))} placeholder="Platform Administrator" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-accent-subtle">Email</Label>
                      <Input type="email" value={adminProfile.email} onChange={(e) => setAdminProfile((prev) => ({ ...prev, email: e.target.value }))} placeholder="admin@petcare.ai" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-accent-subtle">Phone</Label>
                      <Input value={adminProfile.phone} onChange={(e) => setAdminProfile((prev) => ({ ...prev, phone: e.target.value }))} placeholder="+94 77 123 4567" />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs font-medium text-accent-subtle">Bio</Label>
                      <textarea
                        value={adminProfile.bio}
                        onChange={(e) => setAdminProfile((prev) => ({ ...prev, bio: e.target.value }))}
                        rows={3}
                        className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                        placeholder="Brief profile summary"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs font-medium text-accent-subtle">Profile Photo</Label>
                      <Input type="file" accept="image/*" onChange={(e) => handleProfilePhotoChange(e.target.files?.[0] ?? null)} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" onClick={handleSaveProfile}>Save profile</Button>
                    <Button type="button" variant="danger" onClick={handleDeleteProfile}>Delete profile</Button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
