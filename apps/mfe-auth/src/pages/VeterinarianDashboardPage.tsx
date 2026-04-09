import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProfileNameForRole, getVerifiedRole, logout } from "../lib/session";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { cn } from "../lib/utils";
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
} from "lucide-react";

const PET_OWNER_APPOINTMENTS_KEY = "companion_ai_pet_owner_appointments";
const PET_OWNER_SURGEON_INQUIRIES_KEY = "companion_ai_pet_owner_surgeon_inquiries";
const VET_PROFILE_KEY = "companion_ai_vet_profile";

const SAMPLE_APPOINTMENTS: Appointment[] = [
  {
    id: "sample-appt-1",
    clinicId: "clinic-1",
    clinicName: "PetCare Main Clinic",
    surgeonId: "surgeon-1",
    surgeonName: "Dr. Asela",
    time: "09:30 AM",
    petName: "Buddy",
    petType: "Dog",
    petId: "1",
    ownerName: "John Smith",
    ownerPhone: "+94 77 123 4567",
    status: "pending",
    consultationType: "General Consultation",
    notes: "Initial check",
    bookedAt: new Date().toISOString(),
  },
  {
    id: "sample-appt-2",
    clinicId: "clinic-1",
    clinicName: "PetCare Main Clinic",
    surgeonId: "surgeon-1",
    surgeonName: "Dr. Asela",
    time: "11:00 AM",
    petName: "Max",
    petType: "Dog",
    petId: "2",
    ownerName: "Sarah Johnson",
    ownerPhone: "+94 76 987 6543",
    status: "confirmed",
    consultationType: "Follow-up",
    notes: "Skin review",
    bookedAt: new Date().toISOString(),
  },
];

const SAMPLE_INQUIRIES: SurgeonInquiryRecord[] = [
  {
    id: "sample-inquiry-1",
    clinicId: "clinic-1",
    clinicName: "PetCare Main Clinic",
    surgeonId: "surgeon-1",
    surgeonName: "Dr. Asela",
    petId: "1",
    petName: "Buddy",
    message: "Can we move tomorrow appointment to afternoon?",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "sample-inquiry-2",
    clinicId: "clinic-1",
    clinicName: "PetCare Main Clinic",
    surgeonId: "surgeon-1",
    surgeonName: "Dr. Asela",
    petId: "2",
    petName: "Max",
    message: "Need clarification on diet for this week.",
    status: "open",
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
];

interface Appointment {
  id: string;
  clinicId: string;
  clinicName: string;
  surgeonId: string;
  surgeonName: string;
  time: string;
  slot?: string;
  petName: string;
  petType?: string;
  petId?: string;
  ownerName: string;
  ownerPhone?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  consultationType: string;
  notes?: string;
  bookedAt?: string;
}

interface PatientRecord {
  id: string;
  petName: string;
  petType: string;
  breed: string;
  ownerName: string;
  lastVisitDate: string;
  vaccineStatus: string;
  allergies: string[];
  conditions: string[];
}

interface FollowUp {
  id: string;
  petName: string;
  type: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
}

interface Message {
  id: string;
  fromName: string;
  subject: string;
  timestamp: string;
  isRead: boolean;
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

interface VetProfile {
  name: string;
  email: string;
  phone: string;
  specialization: string;
  bio: string;
  photoDataUrl: string;
}

type VetSection = "overview" | "approvals" | "follow-up-reminders" | "patients" | "inquiries" | "profile";

const CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function VeterinarianDashboardPage() {
  const navigate = useNavigate();
  const role = getVerifiedRole();
  const defaultVetName = getProfileNameForRole("veterinarian", "Dr. Veterinarian");

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const raw = localStorage.getItem(PET_OWNER_APPOINTMENTS_KEY);
    if (!raw) return SAMPLE_APPOINTMENTS;

    try {
      const parsed = JSON.parse(raw) as Appointment[];
      const normalized = Array.isArray(parsed)
        ? parsed.map((appointment) => ({
            ...appointment,
            time: appointment.time || appointment.slot || "TBD",
            consultationType: appointment.consultationType || "General Consultation",
          }))
        : [];
      return normalized.length > 0 ? normalized : SAMPLE_APPOINTMENTS;
    } catch {
      return SAMPLE_APPOINTMENTS;
    }
  });

  const [patients] = useState<PatientRecord[]>([
    {
      id: "1",
      petName: "Buddy",
      petType: "Dog",
      breed: "Golden Retriever",
      ownerName: "John Smith",
      lastVisitDate: "March 15, 2026",
      vaccineStatus: "Up to date",
      allergies: [],
      conditions: [],
    },
    {
      id: "2",
      petName: "Max",
      petType: "Dog",
      breed: "German Shepherd",
      ownerName: "Sarah Johnson",
      lastVisitDate: "March 10, 2026",
      vaccineStatus: "Overdue",
      allergies: ["Chicken"],
      conditions: ["Skin sensitivity"],
    },
  ]);

  const [followUps] = useState<FollowUp[]>([
    {
      id: "1",
      petName: "Max",
      type: "Blood test results review",
      dueDate: "March 26, 2026",
      priority: "high",
    },
    {
      id: "2",
      petName: "Luna",
      type: "Post-surgery wound check",
      dueDate: "March 28, 2026",
      priority: "high",
    },
    {
      id: "3",
      petName: "Buddy",
      type: "Chronic condition monitoring",
      dueDate: "April 5, 2026",
      priority: "medium",
    },
  ]);

  const [surgeonInquiries, setSurgeonInquiries] = useState<SurgeonInquiryRecord[]>(() => {
    const raw = localStorage.getItem(PET_OWNER_SURGEON_INQUIRIES_KEY);
    if (!raw) return SAMPLE_INQUIRIES;
    try {
      const parsed = JSON.parse(raw) as SurgeonInquiryRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) return SAMPLE_INQUIRIES;
      return parsed;
    } catch {
      return SAMPLE_INQUIRIES;
    }
  });

  const [vetProfile, setVetProfile] = useState<VetProfile>(() => {
    const raw = localStorage.getItem(VET_PROFILE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<VetProfile>;
        return {
          name: parsed.name ?? defaultVetName,
          email: parsed.email ?? "",
          phone: parsed.phone ?? "",
          specialization: parsed.specialization ?? "",
          bio: parsed.bio ?? "",
          photoDataUrl: parsed.photoDataUrl ?? "",
        };
      } catch {
        // ignore and use defaults
      }
    }
    return {
      name: defaultVetName,
      email: "",
      phone: "",
      specialization: "",
      bio: "",
      photoDataUrl: "",
    };
  });

  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<VetSection>("overview");
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  if (role !== "veterinarian") {
    navigate("/pets");
    return null;
  }

  useEffect(() => {
    localStorage.setItem(PET_OWNER_APPOINTMENTS_KEY, JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem(PET_OWNER_SURGEON_INQUIRIES_KEY, JSON.stringify(surgeonInquiries));
  }, [surgeonInquiries]);

  const messages: Message[] = surgeonInquiries.map((inquiry) => ({
    id: inquiry.id,
    fromName: `${inquiry.petName} Owner`,
    subject: `${inquiry.surgeonName}: ${inquiry.message}`,
    timestamp: new Date(inquiry.createdAt).toLocaleString(),
    isRead: inquiry.status === "replied",
  }));

  const filteredPatients = useMemo(() => {
    return patients.filter(
      (patient) =>
        patient.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.breed.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [patients, searchQuery]);

  const todayKey = new Date().toDateString();
  const todaysAppointments = appointments.filter((appointment) => {
    if (!appointment.bookedAt) return true;
    const parsedDate = new Date(appointment.bookedAt);
    if (Number.isNaN(parsedDate.getTime())) return true;
    return parsedDate.toDateString() === todayKey;
  });

  const todayPatientNames = new Set(todaysAppointments.map((appointment) => appointment.petName.toLowerCase()));
  const todaysPatients =
    todayPatientNames.size > 0
      ? filteredPatients.filter((patient) => todayPatientNames.has(patient.petName.toLowerCase()))
      : filteredPatients.slice(0, 2);

  const pendingAppointments = appointments.filter((appointment) => appointment.status === "pending").length;
  const highPriorityFollowUps = followUps.filter((followUp) => followUp.priority === "high").length;
  const unreadMessages = messages.filter((message) => !message.isRead).length;
  const overdueVaccines = patients.filter((patient) => patient.vaccineStatus.toLowerCase() !== "up to date").length;
  const unresolvedInquiries = surgeonInquiries.filter((inquiry) => inquiry.status === "open").length;
  const today = new Date();
  const isCurrentCalendarMonth = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth;

  const bookedDaysThisMonth = useMemo(() => {
    const days = new Set<number>();
    appointments.forEach((appointment) => {
      if (!appointment.bookedAt) return;
      const date = new Date(appointment.bookedAt);
      if (Number.isNaN(date.getTime())) return;
      if (date.getFullYear() === calendarYear && date.getMonth() === calendarMonth) {
        days.add(date.getDate());
      }
    });
    return days;
  }, [appointments, calendarMonth, calendarYear]);

  const calendarWeeks = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const cells: Array<number | null> = [
      ...Array.from({ length: firstDayOfMonth }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return Array.from({ length: cells.length / 7 }, (_, weekIndex) => cells.slice(weekIndex * 7, weekIndex * 7 + 7));
  }, [calendarMonth, calendarYear]);

  const isOverviewView = activeSection === "overview";
  const isApprovalsView = activeSection === "approvals";
  const isPatientsView = activeSection === "patients";
  const isFollowUpsView = activeSection === "follow-up-reminders";
  const isInquiriesView = activeSection === "inquiries";
  const isProfileView = activeSection === "profile";

  const visibleAppointments =
    activeSection === "approvals"
      ? appointments.filter((appointment) => appointment.status === "pending")
      : appointments;

  const sidebarItems: Array<{ id: VetSection; label: string; icon: typeof User; badge?: number }> = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "approvals", label: "Approvals", icon: ClipboardCheck },
    { id: "follow-up-reminders", label: "Follow-up Reminders", icon: Activity },
    { id: "patients", label: "Patients", icon: Building2 },
    { id: "inquiries", label: "Inquiries", icon: ShieldCheck },
    { id: "profile", label: "Profile", icon: User },
  ];

  const headerTitle = sidebarItems.find((item) => item.id === activeSection)?.label ?? "Overview";
  const displayName = vetProfile.name.trim() || defaultVetName;
  const welcomeName = /^dr\.?\s/i.test(displayName) ? displayName : `Dr. ${displayName}`;
  const vetInitial = displayName.trim().charAt(0).toUpperCase() || "D";

  function handleSelectSection(section: VetSection) {
    setActiveSection(section);
    setMobileNavOpen(false);
  }

  function handleLogout() {
    logout();
    navigate("/auth/login", { replace: true });
  }

  function handleConfirmAppointment(id: string) {
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === id ? { ...appointment, status: "confirmed" } : appointment,
      ),
    );
  }

  function handleRescheduleAppointment(id: string) {
    const nextSlot = window.prompt("Enter new slot for this appointment (example: 04:00 PM):");
    if (!nextSlot?.trim()) return;

    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === id
          ? { ...appointment, time: nextSlot.trim(), slot: nextSlot.trim(), status: "pending" }
          : appointment,
      ),
    );
  }

  function handleCancelAppointment(id: string) {
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === id ? { ...appointment, status: "cancelled" } : appointment,
      ),
    );
  }

  function handleCreateNote(appointmentId: string) {
    alert(`Create consultation note for appointment ${appointmentId}`);
  }

  function handlePrevCalendarMonth() {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((prev) => prev - 1);
      return;
    }
    setCalendarMonth((prev) => prev - 1);
  }

  function handleNextCalendarMonth() {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((prev) => prev + 1);
      return;
    }
    setCalendarMonth((prev) => prev + 1);
  }

  function handleMarkInquiryAsReplied(inquiryId: string) {
    setSurgeonInquiries((prev) =>
      prev.map((inquiry) => (inquiry.id === inquiryId ? { ...inquiry, status: "replied" } : inquiry)),
    );
  }

  function handleSaveProfile() {
    localStorage.setItem(VET_PROFILE_KEY, JSON.stringify(vetProfile));
    alert("Profile saved");
  }

  function handleDeleteProfile() {
    const confirmed = window.confirm("Delete veterinarian profile details?");
    if (!confirmed) return;
    localStorage.removeItem(VET_PROFILE_KEY);
    setVetProfile({
      name: defaultVetName,
      email: "",
      phone: "",
      specialization: "",
      bio: "",
      photoDataUrl: "",
    });
  }

  function handleProfilePhotoChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setVetProfile((prev) => ({ ...prev, photoDataUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
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
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle">
            Menu
          </p>
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
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-current">
                    {item.badge}
                  </span>
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
              {vetProfile.photoDataUrl ? <AvatarImage src={vetProfile.photoDataUrl} alt="Doctor profile" /> : null}
              <AvatarFallback className="text-[11px]">{vetInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-accent dark:text-white">{displayName}</p>
              <p className="text-[10px] text-accent-faint dark:text-accent-subtle">Veterinarian</p>
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
              {vetProfile.photoDataUrl ? <AvatarImage src={vetProfile.photoDataUrl} alt="Doctor profile" /> : null}
              <AvatarFallback className="text-[11px]">{vetInitial}</AvatarFallback>
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
            {isOverviewView && (
              <section className="mb-6">
                <p className="text-base leading-6 text-slate-500 dark:text-accent-subtle">Welcome back,</p>
                <h2 className="mt-1 text-3xl font-semibold leading-tight text-slate-900 dark:text-white">{welcomeName}</h2>
                <p className="mt-1 text-base text-accent-subtle dark:text-accent-faint">Clinic operations at a glance.</p>
              </section>
            )}

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

            {isOverviewView && (
              <section className="mt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                    <p className="text-sm font-medium text-accent-subtle dark:text-accent-faint">Daily Confirmations</p>
                    <p className="mt-1 text-3xl font-bold text-accent dark:text-white">{pendingAppointments}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                    <p className="text-sm font-medium text-accent-subtle dark:text-accent-faint">Follow-up Reminders</p>
                    <p className="mt-1 text-3xl font-bold text-accent dark:text-white">{highPriorityFollowUps}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                    <p className="text-sm font-medium text-accent-subtle dark:text-accent-faint">Patients</p>
                    <p className="mt-1 text-3xl font-bold text-accent dark:text-white">{todaysPatients.length}</p>
                  </div>
                </div>
              </section>
            )}

            {isOverviewView && (
              <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 xl:col-span-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Critical Alerts</h3>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">
                        <span className="text-sm font-medium">High-priority follow-ups</span>
                        <span className="text-sm font-bold">{highPriorityFollowUps}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-orange-50 px-3 py-2 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
                        <span className="text-sm font-medium">Overdue vaccines</span>
                        <span className="text-sm font-bold">{overdueVaccines}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                        <span className="text-sm font-medium">Open inquiries</span>
                        <span className="text-sm font-bold">{unresolvedInquiries}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Today&apos;s Schedule</h3>
                    <div className="mt-3 space-y-2">
                      {todaysAppointments.slice(0, 3).map((appointment) => (
                        <div key={appointment.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 dark:bg-neutral-800/70">
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{appointment.petName}</p>
                            <p className="text-xs text-slate-500">{appointment.ownerName}</p>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{appointment.time}</p>
                        </div>
                      ))}
                      {todaysAppointments.length === 0 ? <p className="text-sm text-accent-subtle">No appointments for today.</p> : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pending Messages</h3>
                    <div className="mt-3 space-y-2">
                      {messages
                        .filter((message) => !message.isRead)
                        .slice(0, 3)
                        .map((message) => (
                          <div key={message.id} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-neutral-800/70">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{message.fromName}</p>
                            <p className="line-clamp-1 text-xs text-slate-500">{message.subject}</p>
                          </div>
                        ))}
                      {unreadMessages === 0 ? <p className="text-sm text-accent-subtle">No unread inquiries.</p> : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handlePrevCalendarMonth}
                      className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-neutral-800 dark:text-slate-200"
                    >
                      Prev
                    </button>
                    <div className="flex items-center gap-2">
                      <select
                        value={calendarMonth}
                        onChange={(e) => setCalendarMonth(Number(e.target.value))}
                        className="rounded-md border border-border-strong bg-white px-2 py-1 text-sm font-semibold text-slate-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-slate-100"
                      >
                        {CALENDAR_MONTHS.map((month, index) => (
                          <option key={month} value={index}>
                            {month}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1900}
                        max={9999}
                        value={calendarYear}
                        onChange={(e) => {
                          const nextYear = Number(e.target.value);
                          if (!Number.isNaN(nextYear)) {
                            setCalendarYear(nextYear);
                          }
                        }}
                        className="w-[88px] rounded-md border border-border-strong bg-white px-2 py-1 text-sm font-semibold text-slate-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleNextCalendarMonth}
                      className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-neutral-800 dark:text-slate-200"
                    >
                      Next
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {CALENDAR_WEEKDAYS.map((weekday) => (
                      <div key={weekday}>{weekday}</div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {calendarWeeks.flat().map((day, index) => {
                      if (!day) {
                        return <div key={`empty-${index}`} className="h-9 rounded-md bg-transparent" />;
                      }
                      const isToday = isCurrentCalendarMonth && day === today.getDate();
                      const hasAppointment = bookedDaysThisMonth.has(day);
                      return (
                        <div
                          key={`day-${day}-${index}`}
                          className={cn(
                            "flex h-9 items-center justify-center rounded-md text-sm font-medium",
                            isToday
                              ? "bg-blue-600 text-white"
                              : hasAppointment
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-slate-50 text-slate-700 dark:bg-neutral-800/70 dark:text-slate-200",
                          )}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />Today
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />Appointment day
                    </span>
                  </div>
                </div>
              </section>
            )}

            <section className="px-0 pb-20 pt-6 space-y-6">
              {(isOverviewView || isApprovalsView) && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {isApprovalsView ? "Pending Approvals" : "Appointment Queue"}
                  </h2>
                  {visibleAppointments.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-border-strong p-8 text-center dark:border-neutral-700">
                      <p className="text-accent-subtle">
                        {isApprovalsView ? "No pending approvals right now" : "No appointments available"}
                      </p>
                    </div>
                  ) : (
                    visibleAppointments.map((appointment) => (
                      <div key={appointment.id} className="rounded-lg border border-border bg-surface p-4 transition dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white">{appointment.time}</p>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs font-medium",
                                  appointment.status === "pending"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                                    : appointment.status === "confirmed"
                                      ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                                      : appointment.status === "cancelled"
                                        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                        : "bg-slate-200 text-slate-700 dark:bg-neutral-700 dark:text-neutral-200",
                                )}
                              >
                                {appointment.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-accent-muted">
                              <span className="font-medium">{appointment.petName}</span>
                              {appointment.petType ? ` - ${appointment.petType}` : ""}
                            </p>
                            <p className="mt-1 text-sm text-accent-subtle">Owner: {appointment.ownerName}</p>
                            <p className="mt-1 text-sm text-accent-subtle">
                              Phone: {appointment.ownerPhone ? appointment.ownerPhone : "No phone provided"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="inline-block rounded bg-slate-200 px-2 py-1 text-xs font-medium text-accent-muted">
                                {appointment.consultationType}
                              </span>
                              {appointment.notes ? (
                                <span className="inline-block rounded bg-slate-100 px-2 py-1 text-xs text-accent-subtle">
                                  {appointment.notes}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {appointment.status === "pending" ? (
                            <>
                              <button
                                onClick={() => handleConfirmAppointment(appointment.id)}
                                className="rounded bg-green-600 px-3 py-1 font-medium text-white hover:bg-green-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => handleRescheduleAppointment(appointment.id)}
                                className="rounded bg-amber-500 px-3 py-1 font-medium text-white hover:bg-amber-600"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancelAppointment(appointment.id)}
                                className="rounded bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700"
                              >
                                Cancel
                              </button>
                            </>
                          ) : null}
                          {appointment.status === "confirmed" ? (
                            <button
                              onClick={() => handleCancelAppointment(appointment.id)}
                              className="rounded bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700"
                            >
                              Cancel
                            </button>
                          ) : null}
                          {appointment.status === "confirmed" || appointment.status === "pending" ? (
                            <button
                              onClick={() => handleCreateNote(appointment.id)}
                              className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
                            >
                              Consultation notes
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {isPatientsView ? (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Today's Patients</h2>
                  <input
                    type="text"
                    placeholder="Search by pet name, owner, or breed..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                  />

                  {todaysPatients.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-border-strong p-8 text-center dark:border-neutral-700">
                      <p className="text-accent-subtle">No patients scheduled for today</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todaysPatients.map((patient) => (
                        <button
                          key={patient.id}
                          onClick={() => setSelectedPatient(patient)}
                          className="w-full rounded-lg border border-border bg-surface p-4 text-left transition hover:border-border-strong dark:border-neutral-800 dark:bg-neutral-900"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">{patient.petName}</p>
                              <p className="text-sm text-accent-subtle">{patient.petType} - {patient.breed}</p>
                              <p className="mt-1 text-sm text-slate-500">Owner: {patient.ownerName}</p>
                            </div>
                            <span className="text-xs text-accent-subtle">Last visit: {patient.lastVisitDate}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {isFollowUpsView ? (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Follow-up Reminders</h2>
                  {followUps.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-border-strong p-8 text-center dark:border-neutral-700">
                      <p className="text-accent-subtle">No follow-ups scheduled</p>
                    </div>
                  ) : (
                    followUps.map((followUp) => (
                      <div key={followUp.id} className="rounded-lg border border-border bg-surface p-4 dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{followUp.petName}</p>
                            <p className="mt-1 text-sm text-accent-muted">{followUp.type}</p>
                            <p className="mt-2 text-sm text-accent-subtle">Due: {followUp.dueDate}</p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              followUp.priority === "high"
                                ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                : followUp.priority === "medium"
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                                  : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
                            )}
                          >
                            {followUp.priority.toUpperCase()}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="mt-3 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                          Mark as done
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {isInquiriesView ? (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Inquiries</h2>
                  {messages.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-border-strong p-8 text-center dark:border-neutral-700">
                      <p className="text-accent-subtle">No inquiries yet</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message.id} className="rounded-lg border border-border bg-surface p-4 transition dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={message.isRead ? "text-slate-900 dark:text-white" : "font-semibold text-slate-900 dark:text-white"}>
                              {message.fromName}
                            </p>
                            <p className="mt-1 text-sm text-accent-muted">{message.subject}</p>
                            <p className="mt-2 text-xs text-slate-500">{message.timestamp}</p>
                          </div>
                          {!message.isRead ? <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-slate-500"></span> : null}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button type="button" className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                            Reply
                          </button>
                          {!message.isRead ? (
                            <button
                              type="button"
                              onClick={() => handleMarkInquiryAsReplied(message.id)}
                              className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              Mark as replied
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {isProfileView ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <Avatar className="h-16 w-16">
                        {vetProfile.photoDataUrl ? <AvatarImage src={vetProfile.photoDataUrl} alt="Doctor profile" /> : null}
                        <AvatarFallback className="text-lg font-semibold">{vetInitial}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle">Profile</p>
                        <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Doctor Details</h2>
                        <p className="mt-1 text-sm text-accent-subtle dark:text-accent-faint">Update your professional details and profile photo.</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-accent-subtle">Full Name</p>
                        <input
                          value={vetProfile.name}
                          onChange={(e) => setVetProfile((prev) => ({ ...prev, name: e.target.value }))}
                          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                          placeholder="Dr. Name"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-accent-subtle">Specialization</p>
                        <input
                          value={vetProfile.specialization}
                          onChange={(e) => setVetProfile((prev) => ({ ...prev, specialization: e.target.value }))}
                          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                          placeholder="Small Animal Surgery"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-accent-subtle">Email</p>
                        <input
                          type="email"
                          value={vetProfile.email}
                          onChange={(e) => setVetProfile((prev) => ({ ...prev, email: e.target.value }))}
                          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                          placeholder="doctor@clinic.com"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-accent-subtle">Phone</p>
                        <input
                          value={vetProfile.phone}
                          onChange={(e) => setVetProfile((prev) => ({ ...prev, phone: e.target.value }))}
                          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                          placeholder="+94 77 123 4567"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <p className="text-xs font-medium text-accent-subtle">Bio</p>
                        <textarea
                          value={vetProfile.bio}
                          onChange={(e) => setVetProfile((prev) => ({ ...prev, bio: e.target.value }))}
                          rows={3}
                          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                          placeholder="Brief professional summary"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <p className="text-xs font-medium text-accent-subtle">Profile Photo</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleProfilePhotoChange(e.target.files?.[0] ?? null)}
                          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" onClick={handleSaveProfile} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg">
                        Save profile
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteProfile}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        Delete profile
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          {selectedPatient ? (
            <div className="fixed inset-0 z-40 bg-black/50 transition" onClick={() => setSelectedPatient(null)}>
              <div className="fixed bottom-0 right-0 top-0 w-full bg-surface shadow-lg sm:w-96" onClick={(e) => e.stopPropagation()}>
                <div className="flex h-full flex-col">
                  <div className="border-b border-border p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Patient Details</h3>
                      <button onClick={() => setSelectedPatient(null)} className="text-2xl text-slate-400 hover:text-accent-subtle">
                        x
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    <div>
                      <p className="text-sm font-medium text-accent-subtle">Pet Name</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{selectedPatient.petName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-accent-subtle">Type</p>
                        <p className="mt-1 text-slate-900 dark:text-white">{selectedPatient.petType}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-accent-subtle">Breed</p>
                        <p className="mt-1 text-slate-900 dark:text-white">{selectedPatient.breed}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-accent-subtle">Owner Name</p>
                      <p className="mt-1 text-slate-900 dark:text-white">{selectedPatient.ownerName}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-accent-subtle">Last Visit</p>
                      <p className="mt-1 text-slate-900 dark:text-white">{selectedPatient.lastVisitDate}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-accent-subtle">Vaccination Status</p>
                      <p
                        className={cn(
                          "mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium",
                          selectedPatient.vaccineStatus === "Up to date" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
                        )}
                      >
                        {selectedPatient.vaccineStatus}
                      </p>
                    </div>

                    {selectedPatient.allergies.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-accent-subtle">Allergies</p>
                        <div className="mt-2 space-y-1">
                          {selectedPatient.allergies.map((allergy) => (
                            <span key={allergy} className="block rounded bg-yellow-50 px-2 py-1 text-sm text-yellow-700">
                              {allergy}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedPatient.conditions.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-accent-subtle">Known Conditions</p>
                        <div className="mt-2 space-y-1">
                          {selectedPatient.conditions.map((condition) => (
                            <span key={condition} className="block rounded bg-orange-50 px-2 py-1 text-sm text-orange-700">
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-border p-5">
                    <button type="button" className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-fg">
                      Create consultation note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
