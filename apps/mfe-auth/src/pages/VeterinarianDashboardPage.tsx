import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken, getProfileNameForRole, getVerifiedRole, logout, saveProfileName } from "../lib/session";
import { t, useLanguageStore } from "../lib/language";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Dropzone } from "../components/ui/dropzone";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { cn } from "../lib/utils";
import { toast } from "../lib/use-toast";
import { listAllAppointments, listClinics, updateAppointment, listInquiries, sendInquiryMessage } from "../lib/clinic-api";
import { listAllPets, type BackendPet } from "../lib/pet-api";
import { listVaccinations } from "../lib/vaccination-api";
import { getPrediction, getPredictionHistory, recordVetDiagnosis, type StoredPrediction } from "../lib/prediction-api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { getMyProfile, updateMyProfile } from "../lib/auth-api";
import type { Appointment as BackendAppointment, SurgeonInquiry, VetClinic } from "@companion-ai/shared-types";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PawPrint,
  Search,
  Sparkles,
  Stethoscope,
  Syringe,
  User,
  X,
} from "lucide-react";

const VET_PROFILE_KEY = "companion_ai_vet_profile";

type VetSection = "overview" | "approvals" | "follow-up-reminders" | "patients" | "inquiries" | "profile";

interface AppointmentRow {
  id: string;
  petId: string;
  petName: string;
  species: string;
  clinicName: string;
  surgeonName: string;
  datetime: string | null;
  status: BackendAppointment["status"];
  notes?: string;
  // Attached by clinic-service for staff callers so the vet knows who is
  // bringing the animal; absent for owner callers.
  ownerName?: string;
  ownerPhone?: string;
}

interface PatientRow {
  id: string;
  petName: string;
  species: string;
  breed: string;
  ageYears: number;
  ownerId: string;
  vaccineStatus: "up-to-date" | "due-soon" | "overdue" | "none";
  nextVaccine?: { name: string; dueAt: string } | null;
  lastRisk?: {
    level: string;
    disease: string;
    at: string;
    predictionId?: string;
    predictedDisease?: string; // raw (unlocalized) top-1 disease, for the AI-vs-actual record
    vetDiagnosis?: string; // confirmed diagnosis once recorded
  } | null;
}

interface FollowUpRow {
  id: string;
  petName: string;
  type: string;
  detail: string;
  priority: "medium" | "high";
}

interface VetProfile {
  name: string;
  email: string;
  phone: string;
  specialization: string;
  bio: string;
  photoDataUrl: string;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const DUE_SOON_MS = 14 * 24 * 60 * 60 * 1000;
const RISK_RECENT_MS = 14 * 24 * 60 * 60 * 1000;
const ENRICH_LIMIT = 30;

export function VeterinarianDashboardPage() {
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);
  const role = getVerifiedRole();
  const defaultVetName = getProfileNameForRole("veterinarian", tr("unnamedVet"));

  const [activeSection, setActiveSection] = useState<VetSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // ── Live data ──
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [inquiries, setInquiries] = useState<SurgeonInquiry[]>([]);
  const [viewingAssessmentFor, setViewingAssessmentFor] = useState<PatientRow | null>(null);
  const [viewedAssessment, setViewedAssessment] = useState<StoredPrediction | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [replyByInquiry, setReplyByInquiry] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  // Record-diagnosis state (vet confirms the actual diagnosis for a patient's
  // latest AI assessment — feeds the AI-vs-actual continuous-learning loop)
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [diagnosisSaving, setDiagnosisSaving] = useState(false);

  const [vetProfile, setVetProfile] = useState<VetProfile>(() => {
    const stored = loadJson<Partial<VetProfile> | null>(VET_PROFILE_KEY, null);
    return {
      name: stored?.name ?? defaultVetName,
      email: stored?.email ?? "",
      phone: stored?.phone ?? "",
      specialization: stored?.specialization ?? "",
      bio: stored?.bio ?? "",
      photoDataUrl: stored?.photoDataUrl ?? "",
    };
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // The server (auth-service User record) is the source of truth for the vet's
  // profile — admin provisions the account with real details. localStorage is
  // only a render cache so the header/avatar paint instantly on reload.
  useEffect(() => {
    let active = true;
    const token = getAccessToken();
    if (!token) return;

    setProfileLoading(true);
    getMyProfile(token)
      .then((remote) => {
        if (!active) return;
        const normalized: VetProfile = {
          name: remote.displayName || defaultVetName,
          email: remote.email || "",
          phone: remote.phoneNumber || "",
          specialization: remote.specialization || "",
          bio: remote.bio || "",
          photoDataUrl: remote.photoURL || "",
        };
        setVetProfile(normalized);
        localStorage.setItem(VET_PROFILE_KEY, JSON.stringify(normalized));
        saveProfileName(normalized.name, "veterinarian");
      })
      .catch((err: Error) => {
        if (!active) return;
        toast({ title: tr("failedLoadProfile"), description: err.message, variant: "error" });
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLiveData() {
    setLoading(true);
    try {
      const [appts, clinics, pets, inqs] = await Promise.all([
        listAllAppointments().catch(() => [] as BackendAppointment[]),
        listClinics().catch(() => [] as VetClinic[]),
        listAllPets().catch(() => [] as BackendPet[]),
        listInquiries().catch(() => [] as SurgeonInquiry[]),
      ]);
      setInquiries(inqs);

      const clinicById = new Map(clinics.map((clinic) => [clinic.id, clinic]));
      const surgeonById = new Map(clinics.flatMap((clinic) => clinic.surgeons.map((surgeon) => [surgeon.id, surgeon] as const)));
      const slotById = new Map(
        clinics.flatMap((clinic) => clinic.surgeons.flatMap((surgeon) => (surgeon.availableSlots ?? []).map((slot) => [slot.id, slot] as const))),
      );
      const petById = new Map(pets.map((pet) => [pet.id, pet]));

      setAppointments(
        appts.map((appt) => ({
          id: appt.id,
          petId: appt.petId,
          petName: petById.get(appt.petId)?.name ?? appt.petId,
          species: petById.get(appt.petId)?.species ?? "",
          clinicName: clinicById.get(appt.clinicId)?.name ?? appt.clinicId,
          surgeonName: surgeonById.get(appt.surgeonId)?.name ?? "—",
          datetime: slotById.get(appt.slotId)?.datetime ?? null,
          status: appt.status,
          notes: appt.notes,
          ownerName: (appt as { ownerName?: string }).ownerName,
          ownerPhone: (appt as { ownerPhone?: string }).ownerPhone,
        })),
      );

      // Patient enrichment: vaccination status + last AI assessment (capped)
      const targets = pets.slice(0, ENRICH_LIMIT);
      const enriched = await Promise.all(
        targets.map(async (pet) => {
          const [vaccinations, history] = await Promise.all([
            listVaccinations(pet.id).catch(() => []),
            getPredictionHistory(pet.id, 1).catch(() => []),
          ]);
          const now = Date.now();
          let vaccineStatus: PatientRow["vaccineStatus"] = vaccinations.length ? "up-to-date" : "none";
          let nextVaccine: PatientRow["nextVaccine"] = null;
          for (const record of vaccinations) {
            const due = new Date(record.nextDueAt).getTime();
            if (Number.isNaN(due)) continue;
            if (!nextVaccine || due < new Date(nextVaccine.dueAt).getTime()) {
              nextVaccine = { name: record.vaccineName, dueAt: record.nextDueAt };
            }
            if (due < now) vaccineStatus = "overdue";
            else if (due < now + DUE_SOON_MS && vaccineStatus !== "overdue") vaccineStatus = "due-soon";
          }
          const latest = history[0];
          const lastRisk = latest
            ? {
                level: latest.risk_level,
                disease: latest.predicted_diseases?.[0]?.disease_localized || latest.predicted_diseases?.[0]?.disease || "—",
                at: latest.created_at,
                predictionId: latest.id,
                predictedDisease: latest.predicted_diseases?.[0]?.disease || "",
                vetDiagnosis: (latest as { vet_diagnosis?: string }).vet_diagnosis || "",
              }
            : null;
          return {
            id: pet.id,
            petName: pet.name,
            species: pet.species,
            breed: pet.breed,
            ageYears: pet.ageYears,
            ownerId: pet.ownerId,
            vaccineStatus,
            nextVaccine,
            lastRisk,
          } satisfies PatientRow;
        }),
      );
      setPatients(enriched);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (role === "veterinarian") void loadLiveData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (role !== "veterinarian") {
    navigate("/pets");
    return null;
  }

  const displayName = vetProfile.name.trim() || defaultVetName;
  // Apply the "Dr." honorific only in English; other languages show the
  // admin-entered name as-is (avoids awkward mixed-script prefixing).
  const welcomeName = language === "en" && !/^dr\.?\s/i.test(displayName) ? `Dr. ${displayName}` : displayName;
  const vetInitial = displayName.trim().charAt(0).toUpperCase() || "V";

  // ── Derived views ──
  const todayKey = new Date().toDateString();
  const todaysAppointments = appointments.filter((appt) => appt.datetime && new Date(appt.datetime).toDateString() === todayKey);
  const pendingAppointments = appointments.filter((appt) => appt.status === "pending");
  const overdueVaccineCount = patients.filter((patient) => patient.vaccineStatus === "overdue").length;
  const highRiskPatients = patients.filter(
    (patient) => patient.lastRisk && patient.lastRisk.level === "high" && Date.now() - new Date(patient.lastRisk.at).getTime() < RISK_RECENT_MS,
  );
  // "Needs me" rather than "never answered": an owner follow-up puts an already
  // answered thread back in the queue, which is the point of the thread.
  const openInquiries = inquiries.filter((inq) => inq.status === "awaiting_vet");

  const followUps: FollowUpRow[] = useMemo(() => {
    const rows: FollowUpRow[] = [];
    for (const patient of patients) {
      if (patient.vaccineStatus === "overdue" && patient.nextVaccine) {
        rows.push({
          id: `vacc-${patient.id}`,
          petName: patient.petName,
          type: tr("vaccineFollowUp"),
          detail: `${patient.nextVaccine.name} · ${tr("overdueStatus")} (${patient.nextVaccine.dueAt.slice(0, 10)})`,
          priority: "high",
        });
      } else if (patient.vaccineStatus === "due-soon" && patient.nextVaccine) {
        rows.push({
          id: `vacc-${patient.id}`,
          petName: patient.petName,
          type: tr("vaccineFollowUp"),
          detail: `${patient.nextVaccine.name} · ${tr("dueSoonStatus")} (${patient.nextVaccine.dueAt.slice(0, 10)})`,
          priority: "medium",
        });
      }
      if (patient.lastRisk && (patient.lastRisk.level === "high" || patient.lastRisk.level === "medium")
        && Date.now() - new Date(patient.lastRisk.at).getTime() < RISK_RECENT_MS) {
        rows.push({
          id: `risk-${patient.id}`,
          petName: patient.petName,
          type: tr("riskFollowUp"),
          detail: `${patient.lastRisk.disease} · ${patient.lastRisk.at.slice(0, 10)}`,
          priority: patient.lastRisk.level === "high" ? "high" : "medium",
        });
      }
    }
    return rows.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, language]);

  const filteredPatients = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return patients.filter(
      (patient) =>
        patient.petName.toLowerCase().includes(query) ||
        patient.breed.toLowerCase().includes(query) ||
        patient.species.toLowerCase().includes(query),
    );
  }, [patients, searchQuery]);

  async function setAppointmentStatus(id: string, status: BackendAppointment["status"]) {
    try {
      await updateAppointment(id, { status });
      setAppointments((prev) => prev.map((appt) => (appt.id === id ? { ...appt, status } : appt)));
      toast({ title: tr("appointmentUpdated"), variant: "success" });
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    }
  }

  async function handleReplyInquiry(id: string) {
    const reply = (replyByInquiry[id] || "").trim();
    if (!reply) return;
    setReplyingId(id);
    try {
      const updated = await sendInquiryMessage(id, reply);
      setInquiries((prev) => prev.map((inq) => (inq.id === id ? updated : inq)));
      setReplyByInquiry((prev) => ({ ...prev, [id]: "" }));
      toast({ title: tr("replySent"), variant: "success" });
    } catch (err) {
      toast({ title: (err as Error).message || tr("actionFailed"), variant: "error" });
    } finally {
      setReplyingId(null);
    }
  }

  async function handleSaveProfile() {
    const normalizedName = vetProfile.name.trim() || defaultVetName;
    const nextProfile: VetProfile = { ...vetProfile, name: normalizedName };

    const token = getAccessToken();
    if (!token) {
      setVetProfile(nextProfile);
      localStorage.setItem(VET_PROFILE_KEY, JSON.stringify(nextProfile));
      saveProfileName(normalizedName, "veterinarian");
      toast({ title: tr("profileSaved"), variant: "success" });
      return;
    }

    try {
      setProfileSaving(true);
      const updated = await updateMyProfile(token, {
        displayName: normalizedName,
        phoneNumber: nextProfile.phone.trim() || undefined,
        specialization: nextProfile.specialization.trim() || undefined,
        bio: nextProfile.bio.trim() || undefined,
        photoURL: nextProfile.photoDataUrl || undefined,
      });
      const normalizedRemote: VetProfile = {
        name: updated.displayName || normalizedName,
        email: updated.email || nextProfile.email,
        phone: updated.phoneNumber || "",
        specialization: updated.specialization || "",
        bio: updated.bio || "",
        photoDataUrl: updated.photoURL || "",
      };
      setVetProfile(normalizedRemote);
      localStorage.setItem(VET_PROFILE_KEY, JSON.stringify(normalizedRemote));
      saveProfileName(normalizedRemote.name, "veterinarian");
      toast({ title: tr("profileSaved"), variant: "success" });
    } catch (err) {
      toast({ title: tr("actionFailed"), description: (err as Error).message, variant: "error" });
    } finally {
      setProfileSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/auth/login", { replace: true });
  }

  const sidebarItems: Array<{ id: VetSection; label: string; icon: typeof User; badge?: number }> = [
    { id: "overview", label: tr("navOverview"), icon: LayoutDashboard },
    { id: "approvals", label: tr("approvals"), icon: ClipboardCheck, badge: pendingAppointments.length },
    { id: "follow-up-reminders", label: tr("followUpReminders"), icon: Activity, badge: followUps.filter((f) => f.priority === "high").length },
    { id: "patients", label: tr("patients"), icon: PawPrint },
    { id: "inquiries", label: tr("inquiries"), icon: MessageSquare, badge: openInquiries.length },
    { id: "profile", label: tr("profile"), icon: User },
  ];

  const headerTitle = sidebarItems.find((item) => item.id === activeSection)?.label ?? tr("navOverview");

  const card = "rounded-xl border border-border/80 bg-surface p-4 dark:border-neutral-800 dark:bg-neutral-900";

  const statusVariant = (status: BackendAppointment["status"]) =>
    status === "confirmed" ? "success" : status === "cancelled" ? "danger" : status === "completed" ? "info" : "warning";

  const inquiryStatusLabel = (status: SurgeonInquiry["status"]) =>
    status === "awaiting_vet" ? tr("statusAwaitingVet") : status === "answered" ? tr("statusAnswered") : tr("statusClosed");

  const vaccineBadge = (status: PatientRow["vaccineStatus"]) =>
    status === "overdue"
      ? { variant: "danger" as const, label: tr("overdueStatus") }
      : status === "due-soon"
        ? { variant: "warning" as const, label: tr("dueSoonStatus") }
        : status === "up-to-date"
          ? { variant: "success" as const, label: tr("upToDate") }
          : { variant: "outline" as const, label: tr("noVaccineRecords") };

  const riskBadge = (level: string) => (level === "high" ? "danger" : level === "medium" ? "warning" : "success");

  // Localize backend enum values so nothing renders as raw English in si/ta.
  const statusLabel = (status: BackendAppointment["status"]) =>
    tr(`status${status.charAt(0).toUpperCase()}${status.slice(1)}`);
  const levelLabel = (level: string) =>
    level === "high" ? tr("levelHigh") : level === "medium" ? tr("levelMedium") : tr("levelLow");

  function formatSlot(datetime: string | null) {
    if (!datetime) return "—";
    return new Date(datetime).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }

  /**
   * Open the full assessment behind a patient's summary line.
   *
   * The patient card previously showed only a risk badge and the top condition
   * name, yet the vet is asked to confirm or contradict that prediction - and
   * their diagnosis feeds the AI-vs-vet agreement metric. Confirming a
   * prediction whose reasoning you cannot see is not a meaningful check, so the
   * conditions, reported symptoms, contributing factors and ontology links are
   * all surfaced here.
   */
  async function viewAssessment(patient: PatientRow) {
    const predictionId = patient.lastRisk?.predictionId;
    if (!predictionId) return;
    setViewingAssessmentFor(patient);
    setViewedAssessment(null);
    setAssessmentLoading(true);
    try {
      setViewedAssessment(await getPrediction(predictionId));
    } catch (err) {
      toast({ title: (err as Error).message || tr("actionFailed"), variant: "error" });
      setViewingAssessmentFor(null);
    } finally {
      setAssessmentLoading(false);
    }
  }

  function openDiagnosis(patient: PatientRow) {
    setDiagnosingId(patient.id);
    setDiagnosisText(patient.lastRisk?.vetDiagnosis || "");
    setDiagnosisNotes("");
  }

  async function saveDiagnosis(patient: PatientRow) {
    const predictionId = patient.lastRisk?.predictionId;
    if (!predictionId || !diagnosisText.trim()) return;
    setDiagnosisSaving(true);
    try {
      await recordVetDiagnosis(predictionId, { diagnosis: diagnosisText.trim(), notes: diagnosisNotes.trim() });
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patient.id && p.lastRisk
            ? { ...p, lastRisk: { ...p.lastRisk, vetDiagnosis: diagnosisText.trim() } }
            : p,
        ),
      );
      setDiagnosingId(null);
      toast({ title: tr("diagnosisSaved"), variant: "success" });
    } catch {
      toast({ title: tr("diagnosisError"), variant: "error" });
    } finally {
      setDiagnosisSaving(false);
    }
  }

  function StatTile({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof User; tone?: "danger" | "success" }) {
    return (
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-accent-subtle">{label}</p>
          <span className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            tone === "danger" ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
              : tone === "success" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-surface-tertiary text-accent-subtle dark:bg-neutral-800",
          )}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-accent dark:text-white">{value}</p>
      </div>
    );
  }

  function AppointmentActions({ appt }: { appt: AppointmentRow }) {
    if (appt.status === "pending") {
      return (
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => setAppointmentStatus(appt.id, "confirmed")}><Check className="h-3.5 w-3.5" />{tr("confirmAction")}</Button>
          <Button size="sm" variant="secondary" onClick={() => setAppointmentStatus(appt.id, "cancelled")}><X className="h-3.5 w-3.5" />{tr("cancel")}</Button>
        </div>
      );
    }
    if (appt.status === "confirmed") {
      return <Button size="sm" variant="secondary" onClick={() => setAppointmentStatus(appt.id, "completed")}><Check className="h-3.5 w-3.5" />{tr("completeAction")}</Button>;
    }
    return null;
  }

  function AppointmentList({ items, showActions }: { items: AppointmentRow[]; showActions?: boolean }) {
    if (items.length === 0) {
      return <p className="p-4 text-center text-[13px] text-accent-subtle">{loading ? tr("loadingData") : tr("noAppointmentsYet")}</p>;
    }
    return (
      <div className="divide-y divide-border/60 dark:divide-neutral-800">
        {items.map((appt) => (
          <div key={appt.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-accent-subtle dark:bg-neutral-800">
                <PawPrint className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-accent dark:text-white">{appt.petName}</p>
                  {appt.species ? <Badge variant="outline">{appt.species}</Badge> : null}
                </div>
                <p className="truncate text-[11px] text-accent-subtle">
                  <Clock className="mr-1 inline h-3 w-3" />{formatSlot(appt.datetime)} · {appt.clinicName} · {appt.surgeonName}
                </p>
                {/* Who is bringing the animal, and how to reach them. */}
                {appt.ownerName ? (
                  <p className="truncate text-[11px] text-accent-subtle">
                    <User className="mr-1 inline h-3 w-3" />{tr("owner")}: {appt.ownerName}
                    {appt.ownerPhone ? ` · ${appt.ownerPhone}` : ""}
                  </p>
                ) : null}
                {appt.notes ? <p className="truncate text-[11px] text-accent-faint">{appt.notes}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(appt.status)}>{statusLabel(appt.status)}</Badge>
              {showActions ? <AppointmentActions appt={appt} /> : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full overflow-hidden bg-surface-secondary dark:bg-neutral-950">
      {/* ─── Sidebar ─── */}
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
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-accent-faint dark:text-accent-subtle">{tr("menu")}</p>
          <div className="space-y-0.5">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setActiveSection(item.id); setMobileNavOpen(false); }}
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
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    activeSection === item.id ? "bg-white/20 text-current" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
                  )}>{item.badge}</span>
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
            onClick={() => setActiveSection("profile")}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-surface-tertiary dark:hover:bg-primary"
          >
            <Avatar className="h-7 w-7">
              {vetProfile.photoDataUrl ? <AvatarImage src={vetProfile.photoDataUrl} alt="Vet profile" /> : null}
              <AvatarFallback className="text-[11px]">{vetInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-accent dark:text-white">{welcomeName}</p>
              <p className="text-[10px] text-accent-faint dark:text-accent-subtle">{tr("veterinarians")}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12px] font-medium text-accent-faint transition hover:bg-surface-tertiary hover:text-accent-muted dark:hover:bg-primary dark:hover:text-neutral-300"
          >
            <LogOut className="h-3.5 w-3.5" />{tr("signOut")}
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
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
            <Badge variant="outline" className="hidden gap-1 sm:inline-flex"><Sparkles className="h-3 w-3" />{tr("aiActive")}</Badge>
            <Avatar className="h-7 w-7 cursor-pointer" onClick={() => setActiveSection("profile")}>
              {vetProfile.photoDataUrl ? <AvatarImage src={vetProfile.photoDataUrl} alt="Vet profile" /> : null}
              <AvatarFallback className="text-[11px]">{vetInitial}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="animate-slide-down border-b border-border bg-surface p-2 lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setMobileNavOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                  activeSection === item.id
                    ? "bg-surface-tertiary text-accent dark:bg-neutral-800 dark:text-white"
                    : "text-accent-subtle dark:text-accent-faint",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.badge ? <Badge variant="warning" className="ml-auto">{item.badge}</Badge> : null}
              </button>
            ))}
            <Separator className="my-1 dark:bg-neutral-800" />
            <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-accent-faint">
              <LogOut className="h-4 w-4" />{tr("signOut")}
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">

            {/* ─── Overview ─── */}
            {activeSection === "overview" && (
              <div className="space-y-6 animate-in">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-accent dark:text-white">{tr("welcomeBack")} {welcomeName}</h2>
                  <p className="mt-1 text-sm text-accent-subtle dark:text-accent-faint">{tr("clinicOpsGlance")}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label={tr("todaysSchedule")} value={loading ? "…" : todaysAppointments.length} icon={Calendar} />
                  <StatTile label={tr("pendingApprovals")} value={pendingAppointments.length} icon={ClipboardCheck} tone={pendingAppointments.length > 0 ? "danger" : "success"} />
                  <StatTile label={tr("patients")} value={patients.length} icon={PawPrint} />
                  <StatTile label={tr("overdueVaccines")} value={overdueVaccineCount} icon={Syringe} tone={overdueVaccineCount > 0 ? "danger" : "success"} />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 dark:border-neutral-800">
                      <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("todaysSchedule")}</h3>
                      <Badge variant="outline">{todaysAppointments.length}</Badge>
                    </div>
                    {todaysAppointments.length === 0 ? (
                      <p className="p-4 text-center text-[13px] text-accent-subtle">{loading ? tr("loadingData") : tr("noAppointmentsToday")}</p>
                    ) : (
                      <AppointmentList items={todaysAppointments} showActions />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className={card}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("criticalAlerts")}</h3>
                      </div>
                      <div className="mt-3 space-y-2">
                        {highRiskPatients.length === 0 && <p className="text-[13px] text-accent-subtle">{loading ? tr("loadingData") : tr("noHighRiskPatients")}</p>}
                        {highRiskPatients.slice(0, 5).map((patient) => (
                          <button key={patient.id} onClick={() => { setActiveSection("patients"); setSearchQuery(patient.petName); }} className="flex w-full items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-left transition hover:border-red-300 dark:border-red-950/50 dark:bg-red-950/20">
                            <span>
                              <span className="block text-[13px] font-medium text-accent dark:text-white">{patient.petName}</span>
                              <span className="block text-[11px] text-accent-subtle">{patient.lastRisk?.disease} · {tr("highRiskRecent")}</span>
                            </span>
                            <Badge variant="danger">{levelLabel(patient.lastRisk?.level ?? "")}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={card}>
                      <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("followUpReminders")}</h3>
                      <div className="mt-3 space-y-2">
                        {followUps.length === 0 && <p className="text-[13px] text-accent-subtle">{loading ? tr("loadingData") : tr("noFollowUps")}</p>}
                        {followUps.slice(0, 4).map((followUp) => (
                          <div key={followUp.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 dark:border-neutral-800">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-accent dark:text-white">{followUp.petName} — {followUp.type}</p>
                              <p className="truncate text-[11px] text-accent-subtle">{followUp.detail}</p>
                            </div>
                            <Badge variant={followUp.priority === "high" ? "danger" : "warning"}>{levelLabel(followUp.priority)}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Approvals (pending appointments) ─── */}
            {activeSection === "approvals" && (
              <div className="animate-in">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-accent dark:text-white">{tr("approvals")}</h2>
                  <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{pendingAppointments.length} {tr("pendingApprovals").toLowerCase()}</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                  <AppointmentList items={pendingAppointments} showActions />
                </div>

                <h3 className="mb-3 mt-6 text-[15px] font-semibold text-accent dark:text-white">{tr("allAppointments")}</h3>
                <div className="overflow-hidden rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                  <AppointmentList items={appointments} showActions />
                </div>
              </div>
            )}

            {/* ─── Follow-up reminders ─── */}
            {activeSection === "follow-up-reminders" && (
              <div className="animate-in">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-accent dark:text-white">{tr("followUpReminders")}</h2>
                  <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{tr("highPriorityFollowUps")}: {followUps.filter((f) => f.priority === "high").length}</p>
                </div>
                <div className="space-y-2">
                  {followUps.length === 0 && (
                    <div className={cn(card, "text-center text-[13px] text-accent-subtle")}>{loading ? tr("loadingData") : tr("noFollowUps")}</div>
                  )}
                  {followUps.map((followUp) => (
                    <div key={followUp.id} className={cn(card, "flex items-center justify-between gap-3")}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          followUp.type === tr("vaccineFollowUp") ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
                        )}>
                          {followUp.type === tr("vaccineFollowUp") ? <Syringe className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-accent dark:text-white">{followUp.petName} — {followUp.type}</p>
                          <p className="truncate text-[11px] text-accent-subtle">{followUp.detail}</p>
                        </div>
                      </div>
                      <Badge variant={followUp.priority === "high" ? "danger" : "warning"}>{levelLabel(followUp.priority)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Patients ─── */}
            {activeSection === "patients" && (
              <div className="animate-in">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-accent dark:text-white">{tr("patients")}</h2>
                    <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{patients.length}</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accent-faint" />
                    <Input className="h-9 w-64 pl-8 text-[13px]" placeholder={tr("searchPatientsPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>

                {loading && <p className="text-[13px] text-accent-subtle">{tr("loadingData")}</p>}
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredPatients.map((patient) => {
                    const vaccine = vaccineBadge(patient.vaccineStatus);
                    return (
                      <div key={patient.id} className={card}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-tertiary text-accent-subtle dark:bg-neutral-800">
                              <PawPrint className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-accent dark:text-white">{patient.petName}</p>
                              <p className="truncate text-[12px] text-accent-subtle">{patient.breed} · {patient.species} · {patient.ageYears} {language === "si" ? "අවුරුදු" : language === "ta" ? "வயது" : "yrs"}</p>
                            </div>
                          </div>
                          <Badge variant={vaccine.variant}>{vaccine.label}</Badge>
                        </div>

                        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-[12px] dark:border-neutral-800">
                          <div className="flex items-center justify-between">
                            <span className="text-accent-subtle">{tr("vaccinationStatus")}</span>
                            <span className="font-medium text-accent dark:text-white">
                              {patient.nextVaccine ? `${patient.nextVaccine.name} · ${patient.nextVaccine.dueAt.slice(0, 10)}` : tr("noVaccineRecords")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-accent-subtle">{tr("lastAiAssessment")}</span>
                            {patient.lastRisk ? (
                              <button
                                onClick={() => viewAssessment(patient)}
                                className="flex items-center gap-1.5 font-medium text-accent underline-offset-2 hover:underline dark:text-white"
                                title={tr("viewAssessment")}
                              >
                                <Badge variant={riskBadge(patient.lastRisk.level)}>{levelLabel(patient.lastRisk.level)}</Badge>
                                {patient.lastRisk.disease}
                                <ChevronRight className="h-3 w-3 text-accent-faint" />
                              </button>
                            ) : (
                              <span className="text-accent-faint">—</span>
                            )}
                          </div>
                          {patient.lastRisk?.vetDiagnosis ? (
                            <div className="flex items-center justify-between">
                              <span className="text-accent-subtle">{tr("actualDiagnosis")}</span>
                              <span className="font-medium text-accent dark:text-white">{patient.lastRisk.vetDiagnosis}</span>
                            </div>
                          ) : null}
                        </div>

                        {patient.lastRisk?.predictionId ? (
                          diagnosingId === patient.id ? (
                            <div className="mt-3 space-y-2 border-t border-border/60 pt-3 dark:border-neutral-800">
                              <p className="text-[11px] text-accent-subtle">
                                {tr("aiPredicted")}: <span className="font-medium text-accent dark:text-white">{patient.lastRisk.disease}</span>
                              </p>
                              <div>
                                <Label className="text-[11px]">{tr("actualDiagnosis")}</Label>
                                <Input className="mt-1 h-9 text-[13px]" value={diagnosisText} onChange={(e) => setDiagnosisText(e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-[11px]">{tr("diagnosisNotes")}</Label>
                                <Input className="mt-1 h-9 text-[13px]" value={diagnosisNotes} onChange={(e) => setDiagnosisNotes(e.target.value)} />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" disabled={diagnosisSaving || !diagnosisText.trim()} onClick={() => saveDiagnosis(patient)}>
                                  {diagnosisSaving ? "…" : tr("saveDiagnosis")}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => setDiagnosingId(null)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openDiagnosis(patient)}
                              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 py-1.5 text-[12px] font-medium text-accent-subtle transition hover:border-primary hover:text-primary dark:border-neutral-800"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              {patient.lastRisk.vetDiagnosis ? tr("actualDiagnosis") : tr("recordDiagnosis")}
                            </button>
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {!loading && filteredPatients.length === 0 && (
                  <div className={cn(card, "text-center text-[13px] text-accent-subtle")}>—</div>
                )}
              </div>
            )}

            {/* ─── Inquiries (owner → vet messaging) ─── */}
            {activeSection === "inquiries" && (
              <div className="animate-in">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-accent dark:text-white">{tr("inquiries")}</h2>
                  <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{tr("openInquiries")}: {openInquiries.length}</p>
                </div>
                <div className="space-y-2">
                  {inquiries.length === 0 && (
                    <div className={cn(card, "text-center text-[13px] text-accent-subtle")}>{loading ? tr("loadingData") : tr("noInquiriesYet")}</div>
                  )}
                  {inquiries.map((inq) => (
                    <div key={inq.id} className={card}>
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-accent-subtle dark:bg-neutral-800">
                          <MessageSquare className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-accent dark:text-white">
                            {inq.petName || "—"}{inq.clinicName ? ` · ${inq.clinicName}` : ""}
                          </p>
                          <p className="mt-0.5 text-[11px] text-accent-faint">{new Date(inq.createdAt).toLocaleString()}</p>
                        </div>
                        <Badge variant={inq.status === "awaiting_vet" ? "warning" : inq.status === "answered" ? "success" : "info"}>
                          {inquiryStatusLabel(inq.status)}
                        </Badge>
                      </div>

                      {/* The whole exchange, so a follow-up question is read in
                          the context of what was already asked and answered. */}
                      <div className="mt-3 space-y-2">
                        {(inq.messages ?? []).map((msg, index) => (
                          <div
                            key={index}
                            className={cn(
                              "rounded-lg px-3 py-2 text-[12px]",
                              msg.senderRole === "vet"
                                ? "ml-6 border-l-2 border-primary/50 bg-primary/5 dark:bg-primary/10"
                                : "mr-6 bg-surface-tertiary/50 dark:bg-neutral-800/50"
                            )}
                          >
                            <p className="text-[11px] font-medium text-accent-subtle">
                              {msg.senderRole === "vet" ? tr("threadYouLabel") : tr("threadOwnerLabel")}
                              {" · "}
                              {new Date(msg.createdAt).toLocaleString()}
                            </p>
                            <p className="mt-0.5 text-accent dark:text-white">{msg.body}</p>
                          </div>
                        ))}
                      </div>

                      {inq.status === "closed" ? (
                        <p className="mt-3 text-[12px] text-accent-subtle">{tr("threadClosedVet")}</p>
                      ) : (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            className="h-9 min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3 text-[13px] text-accent outline-none transition focus:border-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                            placeholder={tr("replyPlaceholder")}
                            value={replyByInquiry[inq.id] || ""}
                            onChange={(e) => setReplyByInquiry((prev) => ({ ...prev, [inq.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleReplyInquiry(inq.id); }}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleReplyInquiry(inq.id)}
                            disabled={!(replyByInquiry[inq.id] || "").trim() || replyingId === inq.id}
                          >
                            {replyingId === inq.id ? tr("loadingData") : tr("replyAction")}
                          </Button>
                          <span className="text-[11px] text-accent-faint">
                            {inq.remainingMessages} {tr("messagesRemaining")}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Profile ─── */}
            {activeSection === "profile" && (
              <div className="animate-in">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-accent dark:text-white">{tr("doctorDetails")}</h2>
                  <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{tr("updateProfessionalDetails")}</p>
                </div>
                <div className={cn(card, "max-w-2xl")}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      {vetProfile.photoDataUrl ? <AvatarImage src={vetProfile.photoDataUrl} alt="Vet profile" /> : null}
                      <AvatarFallback className="text-xl">{vetInitial}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[15px] font-semibold text-accent dark:text-white">{welcomeName}</p>
                      <p className="flex items-center gap-1 text-[12px] text-accent-subtle"><Stethoscope className="h-3.5 w-3.5" />{vetProfile.specialization || "—"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-[11px]">{tr("fullName")}</Label><Input className="mt-1 h-9 text-[13px]" value={vetProfile.name} onChange={(e) => setVetProfile((p) => ({ ...p, name: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("specialization")}</Label><Input className="mt-1 h-9 text-[13px]" value={vetProfile.specialization} onChange={(e) => setVetProfile((p) => ({ ...p, specialization: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("email")}</Label><Input className="mt-1 h-9 text-[13px]" type="email" value={vetProfile.email} readOnly disabled /></div>
                    <div><Label className="text-[11px]">{tr("phone")}</Label><Input className="mt-1 h-9 text-[13px]" value={vetProfile.phone} onChange={(e) => setVetProfile((p) => ({ ...p, phone: e.target.value }))} /></div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">{tr("bio")}</Label>
                      <textarea
                        value={vetProfile.bio}
                        onChange={(e) => setVetProfile((p) => ({ ...p, bio: e.target.value }))}
                        placeholder={tr("briefSummaryPlaceholder")}
                        className="mt-1 h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-accent outline-none transition focus:border-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">{tr("profilePhoto")}</Label>
                      <div className="mt-1">
                        <Dropzone label={tr("profilePhotoChoose")} value={vetProfile.photoDataUrl} onChange={(dataUrl) => setVetProfile((p) => ({ ...p, photoDataUrl: dataUrl }))} onClear={() => setVetProfile((p) => ({ ...p, photoDataUrl: "" }))} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button onClick={handleSaveProfile} disabled={profileSaving || profileLoading}>
                      <Check className="h-4 w-4" />{profileSaving ? tr("loadingData") : tr("saveProfile")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Full AI assessment behind a patient's summary line. */}
      <Dialog open={Boolean(viewingAssessmentFor)} onOpenChange={(open) => { if (!open) { setViewingAssessmentFor(null); setViewedAssessment(null); } }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("aiAssessment")} — {viewingAssessmentFor?.petName}</DialogTitle>
            <DialogDescription>
              {viewingAssessmentFor?.species}
              {viewingAssessmentFor?.breed ? ` · ${viewingAssessmentFor.breed}` : ""}
              {viewedAssessment?.created_at ? ` · ${new Date(viewedAssessment.created_at).toLocaleDateString()}` : ""}
            </DialogDescription>
          </DialogHeader>

          {assessmentLoading && <p className="mt-4 text-sm text-accent-subtle">{tr("loadingData")}</p>}

          {viewedAssessment && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Badge variant={riskBadge(viewedAssessment.risk_level)}>{levelLabel(viewedAssessment.risk_level)}</Badge>
                <span className="text-accent-subtle">
                  {tr("confidence")}: {Math.round((viewedAssessment.confidence_score ?? 0) * 100)}%
                </span>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-subtle">{tr("predictedConditions")}</p>
                <div className="mt-2 space-y-1">
                  {(viewedAssessment.predicted_diseases ?? []).map((d) => (
                    <div key={d.disease} className="flex items-center justify-between">
                      <span className="text-accent dark:text-white">{d.disease_localized || d.disease}</span>
                      <span className="text-accent-subtle">{Math.round((d.probability ?? 0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {viewedAssessment.payload && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-subtle">{tr("ownerReported")}</p>
                  <div className="mt-2 space-y-1 text-[13px] text-accent-subtle">
                    <div>{tr("appetite")}: {viewedAssessment.payload.appetite_level || "—"}</div>
                    <div>{tr("activity")}: {viewedAssessment.payload.activity_level || "—"}</div>
                    <div>{tr("vomiting")}: {viewedAssessment.payload.vomiting_frequency || "—"}</div>
                    <div>{tr("diarrhoea")}: {viewedAssessment.payload.diarrhea_level || "—"}</div>
                    <div>{tr("urination")}: {viewedAssessment.payload.urine_frequency || "—"}</div>
                    {(viewedAssessment.payload.symptoms ?? []).length > 0 && (
                      <div>{tr("symptoms")}: {(viewedAssessment.payload.symptoms ?? []).join(", ")}</div>
                    )}
                    {viewedAssessment.payload.notes && <div className="italic">“{viewedAssessment.payload.notes}”</div>}
                  </div>
                </div>
              )}

              {(viewedAssessment.top_features ?? []).length > 0 && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-subtle">{tr("influencingFactors")}</p>
                  <div className="mt-2 space-y-1 text-[13px] text-accent-subtle">
                    {(viewedAssessment.top_features ?? []).slice(0, 5).map((f, i) => (
                      <div key={`${f.field ?? ""}-${f.feature}-${i}`}>
                        {f.field ? `${f.field.replace(/_/g, " ")}: ${f.value ?? ""}` : f.feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(viewedAssessment.ontology_links ?? []).length > 0 && (
                <details className="rounded-lg border border-border/60 p-3 dark:border-neutral-800">
                  <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-wide text-accent-subtle">
                    {tr("knowledgeBaseLinks")}
                  </summary>
                  <div className="mt-2 space-y-1 text-[13px] text-accent-subtle">
                    {(viewedAssessment.ontology_links ?? []).slice(0, 6).map((l, i) => (
                      <div key={`${l.symptom}-${l.disease}-${i}`}>
                        {l.symptom_localized || l.symptom} → {l.disease_localized || l.disease}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <p className="border-t border-border/60 pt-3 text-[11px] text-accent-faint dark:border-neutral-800">
                {viewedAssessment.disclaimer}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
