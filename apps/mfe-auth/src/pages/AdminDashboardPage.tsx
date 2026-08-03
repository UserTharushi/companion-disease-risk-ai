import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAccessToken,
  getProfileNameForRole,
  getVerifiedRole,
  logout,
  saveProfileName,
} from "../lib/session";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { deleteManagedUser, getMyProfile, listUsersByRole, registerUser, updateManagedUser, updateMyProfile, type ManagedUser } from "../lib/auth-api";
import {
  addSurgeon,
  addTimeSlot,
  createClinic,
  deleteClinic,
  deleteSurgeon,
  geocodeAddress,
  listAllAppointments,
  listClinics,
  updateClinic,
  updateSurgeon,
  type GeocodeMatch,
} from "../lib/clinic-api";
import { getFeedbackSummary, getModelInfo, type FeedbackSummary } from "../lib/prediction-api";
import { sendNotification } from "../lib/notification-api";
import {
  createAnnouncement,
  decideApproval,
  listAnnouncements,
  listApprovals,
  listAudit,
  listTickets,
  recordAudit,
  setAnnouncementActive,
  updateTicketStatus,
  type Announcement,
  type ApprovalItem,
  type AuditEntry,
  type Ticket,
} from "../lib/admin-api";
import { toast } from "../lib/use-toast";
import { useTabRoute } from "../lib/use-tab-route";
import { BackButton } from "../components/BackButton";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Dropzone } from "../components/ui/dropzone";
import { cn } from "../lib/utils";
import { t, useLanguageStore } from "../lib/language";
import type { Appointment, VetClinic } from "@companion-ai/shared-types";
import {
  Activity,
  Building2,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  MapPin,
  Sparkles,
  Stethoscope,
  Trash2,
  User,
  UserPlus,
  X,
} from "lucide-react";

const ADMIN_PROFILE_KEY = "companion_ai_admin_profile";

const ADMIN_SECTIONS = ["overview", "approvals", "operations", "clinics", "veterinarians", "add-veterinarian", "governance", "profile"] as const;
type AdminSection = (typeof ADMIN_SECTIONS)[number];

// ApprovalItem, Ticket and AuditEntry now come from ../lib/admin-api — the
// shapes are owned by admin-service rather than redeclared per page.

interface AdminProfile {
  name: string;
  email: string;
  phone: string;
  designation: string;
  bio: string;
  photoDataUrl: string;
}

interface ClinicDraft {
  name: string;
  address: string;
  phone: string;
  email: string;
  specializations: string;
  latitude: string;
  longitude: string;
}

const EMPTY_CLINIC_DRAFT: ClinicDraft = { name: "", address: "", phone: "", email: "", specializations: "", latitude: "", longitude: "" };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const role = getVerifiedRole();
  const defaultAdminName = getProfileNameForRole("admin", "Admin");
  const language = useLanguageStore((state) => state.language);
  const tr = (key: string) => t(language, key);

  // Localize backend enum values so nothing renders as raw English in si/ta.
  const STATUS_KEY: Record<string, string> = {
    pending: "statusPending", approved: "statusApproved", rejected: "statusRejected",
    open: "statusOpen", "in-progress": "statusInProgress", resolved: "statusResolved",
  };
  const statusLabel = (status: string) => (STATUS_KEY[status] ? tr(STATUS_KEY[status]) : status);
  const levelLabel = (level: string) =>
    level === "high" ? tr("levelHigh") : level === "medium" ? tr("levelMedium") : tr("levelLow");

  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ── Live platform data ──
  const [clinics, setClinics] = useState<VetClinic[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);
  const [modelInfo, setModelInfo] = useState<{
    condition_model_loaded: boolean;
    risk_model_loaded: boolean;
    condition_metrics?: { accuracy?: number; macro_f1?: number } | null;
    risk_metrics?: { roc_auc?: number; pr_auc?: number } | null;
  } | null>(null);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);

  const refreshClinics = useCallback(() => {
    setClinicsLoading(true);
    listClinics()
      .then(setClinics)
      .catch(() => toast({ title: tr("failedLoadClinics"), variant: "error" }))
      .finally(() => setClinicsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshClinics();
    listAllAppointments().then(setAppointments).catch(() => undefined);
  }, [refreshClinics]);

  // The AI model / ontology reference panels were removed. modelInfo is still
  // fetched because the operational snapshot's "AI Systems" tile reports
  // online/degraded from whether both models actually loaded.
  useEffect(() => {
    if (activeSection !== "governance" && activeSection !== "overview") return;
    getModelInfo()
      .then((data) => setModelInfo((data as typeof modelInfo) ?? null))
      .catch(() => undefined);
    getFeedbackSummary()
      .then(setFeedbackSummary)
      .catch(() => undefined);
  }, [activeSection, language]);

  // ── Server-backed queues + audit trail (admin-service on :4006) ──
  // Previously localStorage-only, so a second administrator — or the same one
  // on another machine — saw an empty queue and no audit history.
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const refreshAnnouncements = useCallback(async () => {
    const rows = await listAnnouncements(true).catch(() => [] as Announcement[]);
    setAnnouncements(rows);
  }, []);

  useEffect(() => { void refreshAnnouncements(); }, [refreshAnnouncements]);

  const refreshAdminQueues = useCallback(async () => {
    const [nextApprovals, nextTickets, nextAudit] = await Promise.all([
      listApprovals().catch(() => [] as ApprovalItem[]),
      listTickets().catch(() => [] as Ticket[]),
      listAudit(50).catch(() => [] as AuditEntry[]),
    ]);
    setApprovals(nextApprovals);
    setTickets(nextTickets);
    setAuditLog(nextAudit);
  }, []);

  useEffect(() => { void refreshAdminQueues(); }, [refreshAdminQueues]);

  // Fire-and-forget: an audit write must never block or fail the action it
  // records. Refresh afterwards so the trail reflects the server, not a guess.
  function audit(action: string, target: string) {
    recordAudit(action, target)
      .then((entry) => setAuditLog((prev) => [entry, ...prev].slice(0, 50)))
      .catch(() => undefined);
  }

  // ── Veterinarians (managed accounts, server-backed) ──
  // The roster is auth-service's list of role=vet accounts. It used to be a
  // localStorage mirror, so a second admin — or the same admin on another
  // machine — saw an empty list even though the accounts existed.
  const [veterinarians, setVeterinarians] = useState<ManagedUser[]>([]);
  const [editingVetId, setEditingVetId] = useState<string | null>(null);
  const [editingVetDraft, setEditingVetDraft] = useState<ManagedUser | null>(null);
  const [vetDraft, setVetDraft] = useState({
    doctorRegistrationNumber: "", name: "", age: "", email: "", phone: "",
    gender: "", dateOfBirth: "", specialization: "", address: "", photoDataUrl: "", initialPassword: "",
  });

  const refreshVeterinarians = useCallback(async () => {
    const rows = await listUsersByRole("veterinarian").catch(() => [] as ManagedUser[]);
    setVeterinarians(rows);
  }, []);

  useEffect(() => { void refreshVeterinarians(); }, [refreshVeterinarians]);

  // ── Clinic management drafts ──
  const [showAddClinic, setShowAddClinic] = useState(false);
  const [clinicDraft, setClinicDraft] = useState<ClinicDraft>(EMPTY_CLINIC_DRAFT);
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [editingClinicDraft, setEditingClinicDraft] = useState<ClinicDraft & { isOpen: boolean }>({ ...EMPTY_CLINIC_DRAFT, isOpen: true });
  const [surgeonDraftByClinic, setSurgeonDraftByClinic] = useState<Record<string, { name: string; specialization: string; userId: string }>>({});
  const [editingSurgeonId, setEditingSurgeonId] = useState<string | null>(null);
  const [editingSurgeonDraft, setEditingSurgeonDraft] = useState({ name: "", specialization: "" });
  const [slotDraftBySurgeon, setSlotDraftBySurgeon] = useState<Record<string, string>>({});
  const [savingClinic, setSavingClinic] = useState(false);
  const [locatingClinic, setLocatingClinic] = useState(false);
  const [geocodeTarget, setGeocodeTarget] = useState<"create" | "edit" | null>(null);
  const [geocodeMatches, setGeocodeMatches] = useState<GeocodeMatch[]>([]);

  // ── Admin profile ──
  const [adminProfile, setAdminProfile] = useState<AdminProfile>(() => {
    const stored = loadJson<Partial<AdminProfile> | null>(ADMIN_PROFILE_KEY, null);
    return {
      name: stored?.name ?? defaultAdminName,
      email: stored?.email ?? "",
      phone: stored?.phone ?? "",
      designation: stored?.designation ?? "",
      bio: stored?.bio ?? "",
      photoDataUrl: stored?.photoDataUrl ?? "",
    };
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // The server (auth-service User record) is the source of truth for the admin
  // profile. The "designation" maps to the generic `specialization` title field.
  // localStorage is only a render cache.
  useEffect(() => {
    let active = true;
    const token = getAccessToken();
    if (!token) return;

    setProfileLoading(true);
    getMyProfile(token)
      .then((remote) => {
        if (!active) return;
        const normalized: AdminProfile = {
          name: remote.displayName || defaultAdminName,
          email: remote.email || "",
          phone: remote.phoneNumber || "",
          designation: remote.specialization || "",
          bio: remote.bio || "",
          photoDataUrl: remote.photoURL || "",
        };
        setAdminProfile(normalized);
        localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(normalized));
        saveProfileName(normalized.name, "admin");
      })
      .catch((err: Error) => {
        if (active) toast({ title: tr("failedLoadProfile"), description: err.message, variant: "error" });
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [broadcastMessage, setBroadcastMessage] = useState("");

  // ── Derived, real stats ──
  const activeClinicCount = clinics.filter((clinic) => clinic.isOpen !== false).length;
  const activeVetCount = veterinarians.filter((vet) => vet.status === "active").length;
  // Clinic-facing doctor listings across every clinic (a different concept from
  // the login accounts counted above; a listing may or may not be linked to one).
  const clinicDoctorCount = clinics.reduce((total, clinic) => total + (clinic.surgeons?.length ?? 0), 0);
  const cancellationRate = useMemo(() => {
    if (!appointments.length) return 0;
    const cancelled = appointments.filter((a) => a.status === "cancelled").length;
    return Math.round((cancelled / appointments.length) * 1000) / 10;
  }, [appointments]);
  const openApprovals = approvals.filter((item) => item.status === "pending").length;
  const openHighPriorityTickets = tickets.filter((ticket) => ticket.priority === "high" && ticket.status !== "resolved").length;
  const aiOnline = Boolean(modelInfo?.condition_model_loaded && modelInfo?.risk_model_loaded);

  const clinicUtilization = useMemo(
    () =>
      clinics.map((clinic) => {
        const slots = clinic.surgeons.flatMap((surgeon) => surgeon.availableSlots ?? []);
        const booked = slots.filter((slot) => slot.isBooked).length;
        return { id: clinic.id, name: clinic.name, booked, total: slots.length };
      }),
    [clinics],
  );

  if (role !== "admin") {
    navigate("/pets");
    return null;
  }

  const displayName = adminProfile.name.trim() || defaultAdminName;
  const firstName = displayName.trim().split(/\s+/)[0] || "Admin";
  const adminInitial = displayName.trim().charAt(0).toUpperCase() || "A";

  const sidebarItems: Array<{ id: AdminSection; label: string; icon: typeof User; badge?: number }> = [
    { id: "overview", label: t(language, "overview"), icon: LayoutDashboard },
    { id: "approvals", label: t(language, "approvals"), icon: ClipboardCheck, badge: openApprovals },
    { id: "operations", label: t(language, "operations"), icon: Activity },
    { id: "clinics", label: t(language, "clinics"), icon: Building2 },
    { id: "veterinarians", label: t(language, "veterinarians"), icon: UserPlus },
    { id: "governance", label: language === "si" ? "පාලනය" : language === "ta" ? "ஆளுகை" : "Governance", icon: ShieldCheck },
    { id: "profile", label: t(language, "profile"), icon: User },
  ];

  const headerTitle =
    activeSection === "add-veterinarian"
      ? tr("addVet")
      : sidebarItems.find((item) => item.id === activeSection)?.label ?? t(language, "overview");

  // Section lives in the URL so the PWA's back gesture walks sections rather
  // than dropping the admin out of the dashboard entirely.
  const { selectTab, canGoBack, goBack } = useTabRoute<AdminSection>({
    basePath: "/admin-dashboard",
    tabs: ADMIN_SECTIONS,
    defaultTab: "overview",
    activeTab: activeSection,
    setActiveTab: setActiveSection,
  });

  function handleSelectSection(section: AdminSection) {
    selectTab(section);
    setMobileNavOpen(false);
  }

  function handleLogout() {
    logout();
    navigate("/auth/login", { replace: true });
  }

  // ── Approvals / tickets / broadcast ──
  async function handleApprovalDecision(id: string, decision: "approved" | "rejected") {
    const item = approvals.find((a) => a.id === id);
    try {
      const updated = await decideApproval(id, decision);
      setApprovals((prev) => prev.map((a) => (a.id === id ? updated : a)));
      if (item) audit(decision === "approved" ? tr("approve") : tr("reject"), item.name);
    } catch (err) {
      toast({ title: (err as Error).message || "Could not save decision", variant: "error" });
    }
  }

  async function advanceTicket(id: string) {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket || ticket.status === "resolved") return;
    const next = ticket.status === "open" ? "in-progress" : "resolved";
    try {
      const updated = await updateTicketStatus(id, next);
      setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
      audit(next === "resolved" ? tr("resolveTicket") : tr("markInProgress"), ticket.subject);
    } catch (err) {
      toast({ title: (err as Error).message || "Could not update ticket", variant: "error" });
    }
  }

  // Previously this only wrote an audit entry and showed a success toast - the
  // message was never transmitted to anyone. It now publishes a real
  // announcement that owners see on their dashboard.
  async function handleBroadcastSend() {
    const body = broadcastMessage.trim();
    if (!body) return;
    try {
      await createAnnouncement({ body, audience: "owner", severity: "info" });
      audit(tr("broadcastNotice"), body.slice(0, 60));
      setBroadcastMessage("");
      await refreshAnnouncements();
      toast({ title: tr("broadcastSent"), variant: "success" });
    } catch (err) {
      toast({ title: (err as Error).message || tr("actionFailed"), variant: "error" });
    }
  }

  async function handleWithdrawAnnouncement(id: string, title: string) {
    try {
      await setAnnouncementActive(id, false);
      audit(tr("withdrawAnnouncement"), title);
      await refreshAnnouncements();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    }
  }

  /**
   * Look the coordinates up from the address that was typed.
   *
   * This is the right default. "Use my location" only fits an administrator
   * standing inside the clinic they are registering; used from anywhere else it
   * silently files the clinic at the administrator's own position, which is how
   * a Colombo clinic came to sit in Warakapola.
   */
  async function findCoordsFromAddress(target: "create" | "edit") {
    const draft = target === "create" ? clinicDraft : editingClinicDraft;
    const query = [draft.name, draft.address].filter(Boolean).join(", ").trim();
    if (query.length < 3) {
      toast({ title: tr("enterAddressFirst"), variant: "error" });
      return;
    }
    setGeocodeTarget(target);
    setGeocodeMatches([]);
    try {
      const matches = await geocodeAddress(query);
      if (matches.length === 0) {
        // Business names are usually not in the map data; a town or street is.
        const fallback = await geocodeAddress(draft.address || draft.name);
        if (fallback.length === 0) {
          toast({ title: tr("addressNotFound"), description: tr("addressNotFoundHint"), variant: "error" });
          setGeocodeTarget(null);
          return;
        }
        setGeocodeMatches(fallback);
        return;
      }
      setGeocodeMatches(matches);
    } catch (err) {
      toast({ title: (err as Error).message || tr("actionFailed"), variant: "error" });
      setGeocodeTarget(null);
    }
  }

  function applyGeocodeMatch(match: { label: string; latitude: number; longitude: number }) {
    const lat = match.latitude.toFixed(6);
    const lng = match.longitude.toFixed(6);
    if (geocodeTarget === "edit") {
      setEditingClinicDraft((d) => ({ ...d, latitude: lat, longitude: lng }));
    } else {
      setClinicDraft((d) => ({ ...d, latitude: lat, longitude: lng }));
    }
    setGeocodeTarget(null);
    setGeocodeMatches([]);
    toast({ title: tr("locationCaptured"), description: `${lat}, ${lng}`, variant: "success" });
  }

  /**
   * Fill the latitude/longitude fields from the device's own position.
   *
   * Only correct when the administrator is physically at the clinic — the label
   * says so. Otherwise use the address lookup above.
   */
  function fillCoordsFromDevice(target: "create" | "edit") {
    if (!navigator.geolocation) {
      toast({ title: tr("locationUnavailable"), variant: "error" });
      return;
    }
    setLocatingClinic(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        if (target === "create") {
          setClinicDraft((d) => ({ ...d, latitude: lat, longitude: lng }));
        } else {
          setEditingClinicDraft((d) => ({ ...d, latitude: lat, longitude: lng }));
        }
        setLocatingClinic(false);
        toast({ title: tr("locationCaptured"), description: `${lat}, ${lng}`, variant: "success" });
      },
      () => {
        setLocatingClinic(false);
        toast({ title: tr("locationDenied"), variant: "error" });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // ── Clinic management (live API) ──
  async function handleCreateClinic() {
    if (!clinicDraft.name.trim() || !clinicDraft.address.trim()) {
      toast({ title: tr("missingFields"), variant: "error" });
      return;
    }
    setSavingClinic(true);
    try {
      await createClinic({
        name: clinicDraft.name.trim(),
        address: clinicDraft.address.trim(),
        phone: clinicDraft.phone.trim() || undefined,
        email: clinicDraft.email.trim() || undefined,
        specializations: clinicDraft.specializations.split(",").map((s) => s.trim()).filter(Boolean),
        latitude: Number.parseFloat(clinicDraft.latitude) || undefined,
        longitude: Number.parseFloat(clinicDraft.longitude) || undefined,
        isOpen: true,
      });
      audit(tr("addClinic"), clinicDraft.name.trim());
      toast({ title: tr("clinicCreated"), variant: "success" });
      setClinicDraft(EMPTY_CLINIC_DRAFT);
      setShowAddClinic(false);
      refreshClinics();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    } finally {
      setSavingClinic(false);
    }
  }

  function startClinicEdit(clinic: VetClinic) {
    setEditingClinicId(clinic.id);
    setEditingClinicDraft({
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone ?? "",
      email: clinic.email ?? "",
      specializations: (clinic.specializations ?? []).join(", "),
      latitude: String(clinic.latitude ?? ""),
      longitude: String(clinic.longitude ?? ""),
      isOpen: clinic.isOpen !== false,
    });
  }

  async function saveClinicEdit() {
    if (!editingClinicId) return;
    setSavingClinic(true);
    try {
      await updateClinic(editingClinicId, {
        name: editingClinicDraft.name.trim(),
        address: editingClinicDraft.address.trim(),
        phone: editingClinicDraft.phone.trim(),
        email: editingClinicDraft.email.trim(),
        specializations: editingClinicDraft.specializations.split(",").map((s) => s.trim()).filter(Boolean),
        latitude: Number.parseFloat(editingClinicDraft.latitude) || undefined,
        longitude: Number.parseFloat(editingClinicDraft.longitude) || undefined,
        isOpen: editingClinicDraft.isOpen,
      });
      audit(tr("editClinic"), editingClinicDraft.name);
      toast({ title: tr("clinicSaved"), variant: "success" });
      setEditingClinicId(null);
      refreshClinics();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    } finally {
      setSavingClinic(false);
    }
  }

  async function handleDeleteClinic(clinic: VetClinic) {
    if (!window.confirm(`${tr("deleteClinic")}: "${clinic.name}"?`)) return;
    try {
      await deleteClinic(clinic.id);
      audit(tr("deleteClinic"), clinic.name);
      toast({ title: tr("clinicDeleted"), variant: "success" });
      refreshClinics();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    }
  }

  async function handleAddSurgeon(clinic: VetClinic) {
    const draft = surgeonDraftByClinic[clinic.id];
    if (!draft?.name.trim()) {
      toast({ title: tr("missingFields"), variant: "error" });
      return;
    }
    try {
      await addSurgeon(clinic.id, {
        name: draft.name.trim(),
        specialization: draft.specialization.trim() || undefined,
        userId: draft.userId || undefined,
      });
      audit(tr("addSurgeonAction"), `${draft.name.trim()} → ${clinic.name}`);
      toast({ title: tr("surgeonAdded"), variant: "success" });
      setSurgeonDraftByClinic((prev) => ({ ...prev, [clinic.id]: { name: "", specialization: "", userId: "" } }));
      refreshClinics();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    }
  }

  async function handleSaveSurgeonEdit(surgeonId: string) {
    const name = editingSurgeonDraft.name.trim();
    if (!name) {
      toast({ title: tr("missingFields"), variant: "error" });
      return;
    }
    try {
      await updateSurgeon(surgeonId, {
        name,
        specialization: editingSurgeonDraft.specialization.trim() || undefined,
      });
      audit(tr("edit"), name);
      setEditingSurgeonId(null);
      refreshClinics();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    }
  }

  // Link an existing clinic listing to a veterinarian's login account.
  async function handleLinkSurgeonAccount(surgeonId: string, surgeonName: string, userId: string) {
    try {
      await updateSurgeon(surgeonId, { userId: userId || null });
      const vet = veterinarians.find((v) => v.id === userId);
      audit(userId ? tr("linkAccount") : tr("unlinkAccount"), vet ? `${surgeonName} ↔ ${vet.email}` : surgeonName);
      refreshClinics();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    }
  }

  async function handleRemoveSurgeon(surgeonId: string, surgeonName: string) {
    if (!window.confirm(`${tr("delete")}: "${surgeonName}"?`)) return;
    try {
      await deleteSurgeon(surgeonId);
      audit(tr("surgeonRemoved"), surgeonName);
      toast({ title: tr("surgeonRemoved"), variant: "success" });
      refreshClinics();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    }
  }

  async function handleAddSlot(surgeonId: string, surgeonName: string) {
    const value = slotDraftBySurgeon[surgeonId];
    if (!value) {
      toast({ title: tr("missingFields"), variant: "error" });
      return;
    }
    try {
      await addTimeSlot(surgeonId, new Date(value).toISOString());
      audit(tr("addSlotAction"), surgeonName);
      toast({ title: tr("slotAdded"), variant: "success" });
      setSlotDraftBySurgeon((prev) => ({ ...prev, [surgeonId]: "" }));
      refreshClinics();
    } catch {
      toast({ title: tr("actionFailed"), variant: "error" });
    }
  }

  // ── Veterinarian management ──
  async function handleAddVeterinarian() {
    const required = [
      vetDraft.doctorRegistrationNumber, vetDraft.name, vetDraft.age, vetDraft.email,
      vetDraft.phone, vetDraft.gender, vetDraft.dateOfBirth, vetDraft.specialization, vetDraft.initialPassword,
    ];
    if (required.some((field) => !field.trim())) {
      toast({ title: tr("missingFields"), variant: "error" });
      return;
    }
    const normalizedEmail = vetDraft.email.trim().toLowerCase();
    const normalizedRegNo = vetDraft.doctorRegistrationNumber.trim().toUpperCase();
    const duplicate = veterinarians.some(
      (vet) => vet.email.trim().toLowerCase() === normalizedEmail || vet.doctorRegistrationNumber.trim().toUpperCase() === normalizedRegNo,
    );
    if (duplicate) {
      toast({ title: "Duplicate email or registration number", variant: "error" });
      return;
    }
    try {
      await registerUser({
        email: normalizedEmail,
        password: vetDraft.initialPassword,
        displayName: vetDraft.name.trim(),
        phoneNumber: vetDraft.phone.trim(),
        role: "veterinarian",
        mustChangePassword: true,
        doctorRegistrationNumber: normalizedRegNo,
        age: vetDraft.age.trim(),
        gender: vetDraft.gender.trim(),
        dateOfBirth: vetDraft.dateOfBirth,
        specialization: vetDraft.specialization.trim(),
        address: vetDraft.address.trim(),
        photoURL: vetDraft.photoDataUrl || undefined,
      });
    } catch (error: unknown) {
      toast({ title: error instanceof Error ? error.message : tr("actionFailed"), variant: "error" });
      return;
    }

    // Deliver credentials to the veterinarian ("email" via notification-service;
    // SMTP integration is a deployment concern — the payload is identical)
    void sendNotification({
      type: "vet_credentials",
      recipientEmail: normalizedEmail,
      subject: "Your PetCare AI veterinarian account",
      message: `Hello Dr. ${vetDraft.name.trim()}, an administrator created your PetCare AI account. Sign in with username ${normalizedEmail} and your temporary password, then set a new password when prompted.`,
      metadata: { username: normalizedEmail, registrationNumber: normalizedRegNo },
    }).catch(() => undefined);
    // Re-read the roster from auth-service rather than optimistically pushing a
    // client-built row — the server owns the id and the created timestamp.
    await refreshVeterinarians();
    audit(tr("addVet"), vetDraft.name.trim());
    setVetDraft({
      doctorRegistrationNumber: "", name: "", age: "", email: "", phone: "",
      gender: "", dateOfBirth: "", specialization: "", address: "", photoDataUrl: "", initialPassword: "",
    });
    toast({ title: `${tr("addVet")} ✓`, description: normalizedEmail, variant: "success" });
    handleSelectSection("veterinarians");
  }

  async function saveVetEdit() {
    if (!editingVetId || !editingVetDraft) return;
    if (!editingVetDraft.name.trim() || !editingVetDraft.phone.trim() || !editingVetDraft.specialization.trim()) {
      toast({ title: tr("missingFields"), variant: "error" });
      return;
    }
    try {
      const updated = await updateManagedUser(editingVetId, editingVetDraft);
      setVeterinarians((prev) => prev.map((vet) => (vet.id === editingVetId ? updated : vet)));
      audit(tr("edit"), updated.name);
      setEditingVetId(null);
      setEditingVetDraft(null);
    } catch (error: unknown) {
      toast({ title: error instanceof Error ? error.message : tr("actionFailed"), variant: "error" });
    }
  }

  // Really removes the account. Recorded diagnoses are unaffected: they are
  // stored as text on the prediction document and the AI-vs-vet agreement
  // metric joins on that text, not on the vet's id. Use the status toggle
  // instead when the intent is to suspend rather than remove.
  async function handleDeleteVeterinarian(id: string, name: string) {
    if (!window.confirm(`${tr("delete")}: "${name}"?`)) return;
    try {
      await deleteManagedUser(id);
      setVeterinarians((prev) => prev.filter((vet) => vet.id !== id));
      audit(tr("delete"), name);
      toast({ title: `${tr("delete")} ✓`, description: name, variant: "success" });
    } catch (error: unknown) {
      toast({ title: error instanceof Error ? error.message : tr("actionFailed"), variant: "error" });
    }
  }

  async function toggleVeterinarianStatus(id: string) {
    const vet = veterinarians.find((v) => v.id === id);
    if (!vet) return;
    const next = vet.status === "active" ? "inactive" : "active";
    try {
      const updated = await updateManagedUser(id, { status: next });
      setVeterinarians((prev) => prev.map((v) => (v.id === id ? updated : v)));
      audit(next === "active" ? tr("activate") : tr("deactivate"), vet.name);
    } catch (error: unknown) {
      toast({ title: error instanceof Error ? error.message : tr("actionFailed"), variant: "error" });
    }
  }

  async function handleSaveProfile() {
    const normalizedName = adminProfile.name.trim() || defaultAdminName;
    const nextProfile: AdminProfile = { ...adminProfile, name: normalizedName };

    const token = getAccessToken();
    if (!token) {
      setAdminProfile(nextProfile);
      localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(nextProfile));
      saveProfileName(normalizedName, "admin");
      toast({ title: tr("profileSaved"), variant: "success" });
      return;
    }

    try {
      setProfileSaving(true);
      const updated = await updateMyProfile(token, {
        displayName: normalizedName,
        phoneNumber: nextProfile.phone.trim() || undefined,
        specialization: nextProfile.designation.trim() || undefined,
        bio: nextProfile.bio.trim() || undefined,
        photoURL: nextProfile.photoDataUrl || undefined,
      });
      const normalizedRemote: AdminProfile = {
        name: updated.displayName || normalizedName,
        email: updated.email || nextProfile.email,
        phone: updated.phoneNumber || "",
        designation: updated.specialization || "",
        bio: updated.bio || "",
        photoDataUrl: updated.photoURL || "",
      };
      setAdminProfile(normalizedRemote);
      localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(normalizedRemote));
      saveProfileName(normalizedRemote.name, "admin");
      toast({ title: tr("profileSaved"), variant: "success" });
    } catch (err) {
      toast({ title: tr("failedSaveProfile"), description: (err as Error).message, variant: "error" });
    } finally {
      setProfileSaving(false);
    }
  }

  function handleDeleteProfile() {
    if (!window.confirm(`${tr("deleteProfile")}?`)) return;
    const resetProfile: AdminProfile = {
      name: defaultAdminName, email: "", phone: "", designation: "", bio: "", photoDataUrl: "",
    };
    localStorage.removeItem(ADMIN_PROFILE_KEY);
    setAdminProfile(resetProfile);
    saveProfileName(defaultAdminName, "admin");
  }

  // ── Shared UI helpers ──
  const card = "rounded-xl border border-border/80 bg-surface p-4 dark:border-neutral-800 dark:bg-neutral-900";
  const inputClass = "h-9 w-full rounded-lg border border-border bg-surface px-3 text-[13px] text-accent outline-none transition focus:border-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100";

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

  function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
    return (
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-accent dark:text-white">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-accent-subtle dark:text-accent-faint">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    );
  }

  const priorityVariant = (priority: Ticket["priority"]) => (priority === "high" ? "danger" : priority === "medium" ? "warning" : "outline");
  const ticketStatusVariant = (status: Ticket["status"]) => (status === "resolved" ? "success" : status === "in-progress" ? "info" : "warning");

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
            onClick={() => handleSelectSection("profile")}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-surface-tertiary dark:hover:bg-primary"
          >
            <Avatar className="h-7 w-7">
              {adminProfile.photoDataUrl ? <AvatarImage src={adminProfile.photoDataUrl} alt={tr("adminProfileAlt")} /> : null}
              <AvatarFallback className="text-[11px]">{adminInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-accent dark:text-white">{displayName}</p>
              <p className="text-[10px] text-accent-faint dark:text-accent-subtle">{tr("administrator")}</p>
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
            {canGoBack && <BackButton onClick={goBack} label={tr("goBack")} />}
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
            <Badge variant={aiOnline ? "success" : "warning"} className="hidden gap-1 sm:inline-flex">
              <Sparkles className="h-3 w-3" />{aiOnline ? tr("online") : tr("degradedStatus")}
            </Badge>
            <Avatar className="h-7 w-7 cursor-pointer" onClick={() => handleSelectSection("profile")}>
              {adminProfile.photoDataUrl ? <AvatarImage src={adminProfile.photoDataUrl} alt={tr("adminProfileAlt")} /> : null}
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
                  <h2 className="text-2xl font-semibold tracking-tight text-accent dark:text-white">{tr("welcomeBack")} {firstName}</h2>
                  <p className="mt-1 text-sm text-accent-subtle dark:text-accent-faint">{tr("platformGlance")}</p>
                </div>

                {/* Vet accounts and clinic doctors are different things — an
                    account can log in and record diagnoses, a clinic listing is
                    who patients book with. Showing only one made the other look
                    wrong, so both are surfaced. */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <StatTile label={tr("activeClinics")} value={clinicsLoading ? "…" : activeClinicCount} icon={Building2} />
                  <StatTile label={tr("activeVeterinarians")} value={activeVetCount} icon={Stethoscope} />
                  <StatTile label={tr("clinicDoctors")} value={clinicsLoading ? "…" : clinicDoctorCount} icon={Stethoscope} />
                  <StatTile label={tr("totalBookings")} value={appointments.length} icon={Calendar} />
                  <StatTile label={tr("cancellationRate")} value={`${cancellationRate}%`} icon={Activity} tone={cancellationRate > 15 ? "danger" : "success"} />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className={card}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("operationalSnapshot")}</h3>
                      <button onClick={() => { refreshClinics(); listAllAppointments().then(setAppointments).catch(() => undefined); }} className="rounded-md p-1.5 text-accent-subtle transition hover:bg-surface-tertiary dark:hover:bg-neutral-800">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <button onClick={() => handleSelectSection("approvals")} className="rounded-lg border border-border/80 p-3 text-left transition hover:border-primary dark:border-neutral-800">
                        <p className="text-[11px] font-medium text-accent-subtle">{tr("pendingApprovals")}</p>
                        <p className="mt-1 text-xl font-semibold text-accent dark:text-white">{openApprovals}</p>
                      </button>
                      <button onClick={() => handleSelectSection("operations")} className="rounded-lg border border-border/80 p-3 text-left transition hover:border-primary dark:border-neutral-800">
                        <p className="text-[11px] font-medium text-accent-subtle">{tr("highPriorityTickets")}</p>
                        <p className="mt-1 text-xl font-semibold text-accent dark:text-white">{openHighPriorityTickets}</p>
                      </button>
                      <button onClick={() => handleSelectSection("governance")} className="rounded-lg border border-border/80 p-3 text-left transition hover:border-primary dark:border-neutral-800">
                        <p className="text-[11px] font-medium text-accent-subtle">{tr("aiSystems")}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xl font-semibold text-accent dark:text-white">
                          <span className={cn("h-2 w-2 rounded-full", aiOnline ? "bg-emerald-500" : "bg-amber-500")} />
                          {aiOnline ? tr("online") : tr("degradedStatus")}
                        </p>
                      </button>
                    </div>

                    <h4 className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-accent-subtle">{tr("auditTrail")}</h4>
                    <div className="mt-2 divide-y divide-border/60 dark:divide-neutral-800">
                      {auditLog.length === 0 && (
                        <p className="py-3 text-[13px] text-accent-subtle">{tr("noAuditEntries")}</p>
                      )}
                      {auditLog.slice(0, 8).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-accent dark:text-white">{entry.action}</p>
                            <p className="truncate text-[11px] text-accent-subtle">{entry.target}</p>
                          </div>
                          <span className="shrink-0 text-[11px] text-accent-faint">{relativeTime(entry.at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className={card}>
                      <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("clinicSlotUtilization")}</h3>
                      <div className="mt-3 space-y-3">
                        {clinicUtilization.length === 0 && <p className="text-[13px] text-accent-subtle">{clinicsLoading ? tr("loadingData") : tr("noClinicsYet")}</p>}
                        {clinicUtilization.map((clinic) => {
                          const pct = clinic.total ? Math.round((clinic.booked / clinic.total) * 100) : 0;
                          return (
                            <div key={clinic.id}>
                              <div className="flex items-center justify-between text-[12px]">
                                <span className="font-medium text-accent dark:text-white">{clinic.name}</span>
                                <span className="text-accent-subtle">{clinic.booked}/{clinic.total} {tr("slotsBooked")}</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary dark:bg-neutral-800">
                                <div className={cn("h-full rounded-full", pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* ─── Approvals ─── */}
            {activeSection === "approvals" && (
              <div className="animate-in">
                <SectionHeader title={tr("approvalQueue")} subtitle={`${openApprovals} ${tr("pendingApprovals").toLowerCase()}`} />
                <div className="overflow-hidden rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                  {approvals.length === 0 || approvals.every((a) => a.status !== "pending") ? (
                    <p className="p-6 text-center text-[13px] text-accent-subtle">{tr("noPendingApprovals")}</p>
                  ) : null}
                  <div className="divide-y divide-border/60 dark:divide-neutral-800">
                    {approvals.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            item.type === "clinic" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" : "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
                          )}>
                            {item.type === "clinic" ? <Building2 className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-accent dark:text-white">{item.name}</p>
                            <p className="text-[11px] text-accent-subtle">{item.type} · {item.submittedAt}</p>
                          </div>
                        </div>
                        {item.status === "pending" ? (
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => handleApprovalDecision(item.id, "approved")}><Check className="h-3.5 w-3.5" />{tr("approve")}</Button>
                            <Button size="sm" variant="secondary" onClick={() => handleApprovalDecision(item.id, "rejected")}><X className="h-3.5 w-3.5" />{tr("reject")}</Button>
                          </div>
                        ) : (
                          <Badge variant={item.status === "approved" ? "success" : "danger"}>{statusLabel(item.status)}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Operations ─── */}
            {activeSection === "operations" && (
              <div className="space-y-6 animate-in">
                <SectionHeader title={tr("bookingOperations")} subtitle={tr("liveDirectory")} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={card}>
                    <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("clinicSlotUtilization")}</h3>
                    <div className="mt-3 space-y-3">
                      {clinicUtilization.length === 0 && <p className="text-[13px] text-accent-subtle">{clinicsLoading ? tr("loadingData") : tr("noClinicsYet")}</p>}
                      {clinicUtilization.map((clinic) => {
                        const pct = clinic.total ? Math.round((clinic.booked / clinic.total) * 100) : 0;
                        return (
                          <div key={clinic.id}>
                            <div className="flex items-center justify-between text-[13px]">
                              <span className="font-medium text-accent dark:text-white">{clinic.name}</span>
                              <span className="text-accent-subtle">{pct}%</span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-tertiary dark:bg-neutral-800">
                              <div className={cn("h-full rounded-full transition-all", pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={card}>
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-primary" />
                      <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("broadcastNotice")}</h3>
                    </div>
                    <p className="mt-1 text-[12px] text-accent-subtle">{tr("sendUpdatesAll")}</p>
                    <textarea
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder={tr("broadcastPlaceholder")}
                      className="mt-3 h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-accent outline-none transition focus:border-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                    <Button className="mt-2 w-full" onClick={handleBroadcastSend} disabled={!broadcastMessage.trim()}>
                      {tr("sendBroadcast")}
                    </Button>

                    {/* Published announcements, so an admin can see what is
                        currently live and withdraw it. */}
                    <div className="mt-4 space-y-2">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-subtle">{tr("publishedAnnouncements")}</p>
                      {announcements.length === 0 && (
                        <p className="text-[12px] text-accent-faint">{tr("noAnnouncements")}</p>
                      )}
                      {announcements.slice(0, 5).map((a) => (
                        <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 dark:border-neutral-800">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] text-accent dark:text-white">{a.body}</p>
                            <p className="text-[11px] text-accent-subtle">
                              {new Date(a.publishedAt).toLocaleDateString()} · {a.active ? tr("statusActive") : tr("withdrawn")}
                            </p>
                          </div>
                          {a.active && (
                            <Button size="sm" variant="secondary" onClick={() => handleWithdrawAnnouncement(a.id, a.body.slice(0, 40))}>
                              {tr("withdraw")}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-[15px] font-semibold text-accent dark:text-white">{tr("disputeTickets")}</h3>
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-surface dark:border-neutral-800 dark:bg-neutral-900">
                    {tickets.length === 0 && (
                      <p className="p-6 text-center text-[13px] text-accent-subtle">{tr("noOpenTickets")}</p>
                    )}
                    <div className="divide-y divide-border/60 dark:divide-neutral-800">
                      {tickets.map((ticket) => (
                        <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[13px] font-semibold text-accent dark:text-white">{ticket.subject}</p>
                              <Badge variant={priorityVariant(ticket.priority)}>{levelLabel(ticket.priority)}</Badge>
                            </div>
                            <p className="mt-0.5 text-[11px] text-accent-subtle">{ticket.raisedBy} · {ticket.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={ticketStatusVariant(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                            {ticket.status !== "resolved" && (
                              <Button size="sm" variant="secondary" onClick={() => advanceTicket(ticket.id)}>
                                {ticket.status === "open" ? tr("markInProgress") : tr("resolveTicket")}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Clinics (live directory) ─── */}
            {activeSection === "clinics" && (
              <div className="space-y-4 animate-in">
                <SectionHeader
                  title={tr("manageExistingClinics")}
                  subtitle={tr("liveDirectory")}
                  action={
                    <Button size="sm" onClick={() => setShowAddClinic((v) => !v)}>
                      {showAddClinic ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {showAddClinic ? tr("cancel") : tr("addClinic")}
                    </Button>
                  }
                />

                {showAddClinic && (
                  <div className={cn(card, "border-primary/40")}>
                    <p className="text-[13px] font-semibold text-accent dark:text-white">{tr("addClinic")}</p>
                    <p className="mt-0.5 text-[12px] text-accent-subtle">{tr("newClinicHint")}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div><Label className="text-[11px]">{tr("name")} *</Label><input className={cn(inputClass, "mt-1")} value={clinicDraft.name} onChange={(e) => setClinicDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                      <div><Label className="text-[11px]">{tr("address")} *</Label><input className={cn(inputClass, "mt-1")} value={clinicDraft.address} onChange={(e) => setClinicDraft((d) => ({ ...d, address: e.target.value }))} /></div>
                      <div><Label className="text-[11px]">{tr("phone")}</Label><input className={cn(inputClass, "mt-1")} value={clinicDraft.phone} onChange={(e) => setClinicDraft((d) => ({ ...d, phone: e.target.value }))} /></div>
                      <div><Label className="text-[11px]">{tr("email")}</Label><input className={cn(inputClass, "mt-1")} value={clinicDraft.email} onChange={(e) => setClinicDraft((d) => ({ ...d, email: e.target.value }))} /></div>
                      <div><Label className="text-[11px]">{tr("specialization")}</Label><input className={cn(inputClass, "mt-1")} placeholder={tr("specializationPlaceholder")} value={clinicDraft.specializations} onChange={(e) => setClinicDraft((d) => ({ ...d, specializations: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Placeholders are marked as examples: they previously
                            showed bare Colombo coordinates, which were copied in
                            verbatim and put a Kurunegala clinic 93 km away. */}
                        <div><Label className="text-[11px]">{tr("latitude")}</Label><input className={cn(inputClass, "mt-1")} placeholder="e.g. 7.4863" value={clinicDraft.latitude} onChange={(e) => setClinicDraft((d) => ({ ...d, latitude: e.target.value }))} /></div>
                        <div><Label className="text-[11px]">{tr("longitude")}</Label><input className={cn(inputClass, "mt-1")} placeholder="e.g. 80.3647" value={clinicDraft.longitude} onChange={(e) => setClinicDraft((d) => ({ ...d, longitude: e.target.value }))} /></div>
                      </div>
                      <div className="col-span-full">
                        <div className="flex flex-wrap gap-2">
                          {/* Address lookup first: it is right wherever the
                              administrator happens to be sitting. */}
                          <Button size="sm" onClick={() => findCoordsFromAddress("create")} disabled={geocodeTarget === "create"}>
                            <MapPin className="h-3 w-3" />
                            {geocodeTarget === "create" ? tr("locating") : tr("findFromAddress")}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => fillCoordsFromDevice("create")} disabled={locatingClinic}>
                            {locatingClinic ? tr("locating") : tr("useMyLocationHere")}
                          </Button>
                        </div>
                        {geocodeTarget === "create" && geocodeMatches.length > 0 && (
                          <div className="mt-2 space-y-1 rounded-lg border border-border/70 bg-surface-secondary p-2 dark:border-neutral-800 dark:bg-neutral-900/50">
                            <p className="text-[11px] font-medium text-accent-subtle">{tr("pickCorrectPlace")}</p>
                            {geocodeMatches.map((match) => (
                              <button
                                key={`${match.latitude},${match.longitude}`}
                                type="button"
                                onClick={() => applyGeocodeMatch(match)}
                                className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] text-accent transition hover:bg-surface-tertiary dark:text-neutral-200 dark:hover:bg-neutral-800"
                              >
                                {match.label}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-[11px] text-accent-faint">{tr("coordsMustMatchAddress")}</p>
                      </div>
                    </div>
                    <Button className="mt-3" onClick={handleCreateClinic} disabled={savingClinic}>{savingClinic ? "..." : tr("save")}</Button>
                  </div>
                )}

                {clinicsLoading && <p className="text-[13px] text-accent-subtle">{tr("loadingData")}</p>}
                {!clinicsLoading && clinics.length === 0 && (
                  <div className={cn(card, "text-center text-[13px] text-accent-subtle")}>{tr("noClinicsYet")}</div>
                )}

                {clinics.map((clinic) => {
                  const isEditing = editingClinicId === clinic.id;
                  return (
                    <div key={clinic.id} className={card}>
                      {isEditing ? (
                        <div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div><Label className="text-[11px]">{tr("name")}</Label><input className={cn(inputClass, "mt-1")} value={editingClinicDraft.name} onChange={(e) => setEditingClinicDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                            <div><Label className="text-[11px]">{tr("address")}</Label><input className={cn(inputClass, "mt-1")} value={editingClinicDraft.address} onChange={(e) => setEditingClinicDraft((d) => ({ ...d, address: e.target.value }))} /></div>
                            <div><Label className="text-[11px]">{tr("phone")}</Label><input className={cn(inputClass, "mt-1")} value={editingClinicDraft.phone} onChange={(e) => setEditingClinicDraft((d) => ({ ...d, phone: e.target.value }))} /></div>
                            <div><Label className="text-[11px]">{tr("email")}</Label><input className={cn(inputClass, "mt-1")} value={editingClinicDraft.email} onChange={(e) => setEditingClinicDraft((d) => ({ ...d, email: e.target.value }))} /></div>
                            <div><Label className="text-[11px]">{tr("specialization")}</Label><input className={cn(inputClass, "mt-1")} value={editingClinicDraft.specializations} onChange={(e) => setEditingClinicDraft((d) => ({ ...d, specializations: e.target.value }))} /></div>
                            {/* Coordinates were not editable at all, so a clinic
                                saved at the wrong position could never be
                                corrected through the interface. */}
                            <div><Label className="text-[11px]">{tr("latitude")}</Label><input className={cn(inputClass, "mt-1")} placeholder="e.g. 7.4863" value={editingClinicDraft.latitude} onChange={(e) => setEditingClinicDraft((d) => ({ ...d, latitude: e.target.value }))} /></div>
                            <div><Label className="text-[11px]">{tr("longitude")}</Label><input className={cn(inputClass, "mt-1")} placeholder="e.g. 80.3647" value={editingClinicDraft.longitude} onChange={(e) => setEditingClinicDraft((d) => ({ ...d, longitude: e.target.value }))} /></div>
                            <div className="flex items-end gap-2 pb-0.5">
                              <label className="flex items-center gap-2 text-[13px] text-accent">
                                <input type="checkbox" className="h-4 w-4" checked={editingClinicDraft.isOpen} onChange={(e) => setEditingClinicDraft((d) => ({ ...d, isOpen: e.target.checked }))} />
                                {tr("active")}
                              </label>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button size="sm" onClick={saveClinicEdit} disabled={savingClinic}><Check className="h-3.5 w-3.5" />{tr("save")}</Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingClinicId(null)}><X className="h-3.5 w-3.5" />{tr("cancel")}</Button>
                            {/* Same address lookup as the create form — correcting a
                                wrong position is exactly when it is needed most. */}
                            <Button size="sm" variant="secondary" onClick={() => findCoordsFromAddress("edit")} disabled={geocodeTarget === "edit"}>
                              <MapPin className="h-3 w-3" />
                              {geocodeTarget === "edit" ? tr("locating") : tr("findFromAddress")}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => fillCoordsFromDevice("edit")} disabled={locatingClinic}>
                              {locatingClinic ? tr("locating") : tr("useMyLocationHere")}
                            </Button>
                          </div>
                          {geocodeTarget === "edit" && geocodeMatches.length > 0 && (
                            <div className="mt-2 space-y-1 rounded-lg border border-border/70 bg-surface-secondary p-2 dark:border-neutral-800 dark:bg-neutral-900/50">
                              <p className="text-[11px] font-medium text-accent-subtle">{tr("pickCorrectPlace")}</p>
                              {geocodeMatches.map((match) => (
                                <button
                                  key={`${match.latitude},${match.longitude}`}
                                  type="button"
                                  onClick={() => applyGeocodeMatch(match)}
                                  className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] text-accent transition hover:bg-surface-tertiary dark:text-neutral-200 dark:hover:bg-neutral-800"
                                >
                                  {match.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[15px] font-semibold text-accent dark:text-white">{clinic.name}</h3>
                              <Badge variant={clinic.isOpen !== false ? "success" : "outline"}>{clinic.isOpen !== false ? tr("active") : tr("inactive")}</Badge>
                            </div>
                            <p className="mt-0.5 text-[12px] text-accent-subtle">{clinic.address}{clinic.phone ? ` · ${clinic.phone}` : ""}</p>
                            {(clinic.specializations ?? []).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {clinic.specializations.map((spec) => <Badge key={spec} variant="outline">{spec}</Badge>)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => startClinicEdit(clinic)}><Pencil className="h-3.5 w-3.5" />{tr("edit")}</Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" onClick={() => handleDeleteClinic(clinic)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      )}

                      {/* Surgeons & slots */}
                      <div className="mt-4 border-t border-border/60 pt-3 dark:border-neutral-800">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-subtle">{tr("surgeonsSlots")}</p>
                        {clinic.surgeons.length === 0 && <p className="mt-2 text-[13px] text-accent-subtle">{tr("noSurgeonsAssigned")}</p>}
                        <div className="mt-2 space-y-2">
                          {clinic.surgeons.map((surgeon) => (
                            <div key={surgeon.id} className="rounded-lg border border-border/60 p-3 dark:border-neutral-800">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                {editingSurgeonId === surgeon.id ? (
                                  // Inline edit: clinics were editable but surgeons were
                                  // delete-only, even though the API already accepted a
                                  // name/specialization update.
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      className={cn(inputClass, "h-8 w-44")}
                                      placeholder={tr("surgeonName")}
                                      value={editingSurgeonDraft.name}
                                      onChange={(e) => setEditingSurgeonDraft((d) => ({ ...d, name: e.target.value }))}
                                    />
                                    <input
                                      className={cn(inputClass, "h-8 w-40")}
                                      placeholder={tr("specialization")}
                                      value={editingSurgeonDraft.specialization}
                                      onChange={(e) => setEditingSurgeonDraft((d) => ({ ...d, specialization: e.target.value }))}
                                    />
                                    <Button size="sm" onClick={() => handleSaveSurgeonEdit(surgeon.id)}>{tr("save")}</Button>
                                    <Button size="sm" variant="secondary" onClick={() => setEditingSurgeonId(null)}>{tr("cancel")}</Button>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-[13px] font-medium text-accent dark:text-white">{surgeon.name}</p>
                                    <p className="text-[11px] text-accent-subtle">{surgeon.specialization}</p>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  {/* Which login account this clinic listing belongs to */}
                                  <select
                                    className={cn(inputClass, "h-8 w-52")}
                                    value={surgeon.userId || ""}
                                    onChange={(e) => handleLinkSurgeonAccount(surgeon.id, surgeon.name, e.target.value)}
                                  >
                                    <option value="">{tr("noLinkedAccount")}</option>
                                    {veterinarians.filter((vet) => vet.status === "active" || vet.id === surgeon.userId).map((vet) => (
                                      <option key={vet.id} value={vet.id}>{vet.name} ({vet.email})</option>
                                    ))}
                                  </select>
                                  {editingSurgeonId !== surgeon.id && (
                                    <button
                                      onClick={() => {
                                        setEditingSurgeonId(surgeon.id);
                                        setEditingSurgeonDraft({ name: surgeon.name, specialization: surgeon.specialization || "" });
                                      }}
                                      className="rounded-md p-1.5 text-accent-faint transition hover:bg-surface-tertiary hover:text-accent dark:hover:bg-neutral-800"
                                      title={tr("edit")}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button onClick={() => handleRemoveSurgeon(surgeon.id, surgeon.name)} className="rounded-md p-1.5 text-accent-faint transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(surgeon.availableSlots ?? []).length === 0 && <span className="text-[11px] text-accent-faint">{tr("noSlotsSpecified")}</span>}
                                {(surgeon.availableSlots ?? []).map((slot) => (
                                  <span key={slot.id} className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                                    slot.isBooked
                                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                                      : "border-border text-accent-subtle dark:border-neutral-700",
                                  )}>
                                    <Clock className="h-2.5 w-2.5" />
                                    {new Date(slot.datetime).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <input
                                  type="datetime-local"
                                  className={cn(inputClass, "h-8 w-auto")}
                                  value={slotDraftBySurgeon[surgeon.id] || ""}
                                  onChange={(e) => setSlotDraftBySurgeon((prev) => ({ ...prev, [surgeon.id]: e.target.value }))}
                                />
                                <Button size="sm" variant="secondary" onClick={() => handleAddSlot(surgeon.id, surgeon.name)}>
                                  <Plus className="h-3 w-3" />{tr("addSlotAction")}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            className={cn(inputClass, "h-8 w-44")}
                            placeholder={tr("surgeonName")}
                            value={surgeonDraftByClinic[clinic.id]?.name || ""}
                            onChange={(e) => setSurgeonDraftByClinic((prev) => ({ ...prev, [clinic.id]: { ...(prev[clinic.id] || { specialization: "", userId: "" }), name: e.target.value } }))}
                          />
                          <input
                            className={cn(inputClass, "h-8 w-40")}
                            placeholder={tr("specialization")}
                            value={surgeonDraftByClinic[clinic.id]?.specialization || ""}
                            onChange={(e) => setSurgeonDraftByClinic((prev) => ({ ...prev, [clinic.id]: { ...(prev[clinic.id] || { name: "", userId: "" }), specialization: e.target.value } }))}
                          />
                          {/* Optional: bind this listing to the vet's login account */}
                          <select
                            className={cn(inputClass, "h-8 w-48")}
                            value={surgeonDraftByClinic[clinic.id]?.userId || ""}
                            onChange={(e) => setSurgeonDraftByClinic((prev) => ({ ...prev, [clinic.id]: { ...(prev[clinic.id] || { name: "", specialization: "" }), userId: e.target.value } }))}
                          >
                            <option value="">{tr("noLinkedAccount")}</option>
                            {veterinarians.filter((vet) => vet.status === "active").map((vet) => (
                              <option key={vet.id} value={vet.id}>{vet.name} ({vet.email})</option>
                            ))}
                          </select>
                          <Button size="sm" variant="secondary" onClick={() => handleAddSurgeon(clinic)}>
                            <Plus className="h-3 w-3" />{tr("addSurgeonAction")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Veterinarians ─── */}
            {activeSection === "veterinarians" && (
              <div className="animate-in">
                <SectionHeader
                  title={tr("veterinarians")}
                  subtitle={`${activeVetCount} ${tr("active").toLowerCase()} · ${veterinarians.length - activeVetCount} ${tr("inactive").toLowerCase()}`}
                  action={<Button size="sm" onClick={() => handleSelectSection("add-veterinarian")}><Plus className="h-3.5 w-3.5" />{tr("addVet")}</Button>}
                />
                {veterinarians.length === 0 && (
                  <div className={cn(card, "text-center text-[13px] text-accent-subtle")}>—</div>
                )}
                <div className="space-y-3">
                  {veterinarians.map((vet) => {
                    const isEditing = editingVetId === vet.id;
                    return (
                      <div key={vet.id} className={card}>
                        {isEditing && editingVetDraft ? (
                          <div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              <div><Label className="text-[11px]">{tr("name")}</Label><Input className="mt-1 h-9 text-[13px]" value={editingVetDraft.name} onChange={(e) => setEditingVetDraft((d) => (d ? { ...d, name: e.target.value } : d))} /></div>
                              <div><Label className="text-[11px]">{tr("phone")}</Label><Input className="mt-1 h-9 text-[13px]" value={editingVetDraft.phone} onChange={(e) => setEditingVetDraft((d) => (d ? { ...d, phone: e.target.value } : d))} /></div>
                              <div><Label className="text-[11px]">{tr("specialization")}</Label><Input className="mt-1 h-9 text-[13px]" value={editingVetDraft.specialization} onChange={(e) => setEditingVetDraft((d) => (d ? { ...d, specialization: e.target.value } : d))} /></div>
                              <div><Label className="text-[11px]">{tr("age")}</Label><Input className="mt-1 h-9 text-[13px]" value={editingVetDraft.age} onChange={(e) => setEditingVetDraft((d) => (d ? { ...d, age: e.target.value } : d))} /></div>
                              <div className="sm:col-span-2"><Label className="text-[11px]">{tr("address")}</Label><Input className="mt-1 h-9 text-[13px]" value={editingVetDraft.address} onChange={(e) => setEditingVetDraft((d) => (d ? { ...d, address: e.target.value } : d))} /></div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" onClick={saveVetEdit}><Check className="h-3.5 w-3.5" />{tr("save")}</Button>
                              <Button size="sm" variant="secondary" onClick={() => { setEditingVetId(null); setEditingVetDraft(null); }}><X className="h-3.5 w-3.5" />{tr("cancel")}</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-10 w-10">
                                {vet.photoDataUrl ? <AvatarImage src={vet.photoDataUrl} alt={vet.name} /> : null}
                                <AvatarFallback>{vet.name.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-[13px] font-semibold text-accent dark:text-white">{vet.name}</p>
                                  <Badge variant={vet.status === "active" ? "success" : "outline"}>{vet.status === "active" ? tr("active") : tr("inactive")}</Badge>
                                </div>
                                <p className="truncate text-[11px] text-accent-subtle">{vet.specialization} · {vet.email} · {vet.doctorRegistrationNumber}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button size="sm" variant="secondary" onClick={() => toggleVeterinarianStatus(vet.id)}>
                                {vet.status === "active" ? tr("inactive") : tr("active")}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => { setEditingVetId(vet.id); setEditingVetDraft({ ...vet }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" onClick={() => handleDeleteVeterinarian(vet.id, vet.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Add veterinarian ─── */}
            {activeSection === "add-veterinarian" && (
              <div className="animate-in">
                <SectionHeader title={tr("addVet")} subtitle={tr("doctorDetails")} />
                <div className={card}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div><Label className="text-[11px]">{tr("registrationNumber")} *</Label><Input className="mt-1 h-9 text-[13px]" value={vetDraft.doctorRegistrationNumber} onChange={(e) => setVetDraft((d) => ({ ...d, doctorRegistrationNumber: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("fullName")} *</Label><Input className="mt-1 h-9 text-[13px]" value={vetDraft.name} onChange={(e) => setVetDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("email")} *</Label><Input className="mt-1 h-9 text-[13px]" type="email" value={vetDraft.email} onChange={(e) => setVetDraft((d) => ({ ...d, email: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("phone")} *</Label><Input className="mt-1 h-9 text-[13px]" value={vetDraft.phone} onChange={(e) => setVetDraft((d) => ({ ...d, phone: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("age")} *</Label><Input className="mt-1 h-9 text-[13px]" value={vetDraft.age} onChange={(e) => setVetDraft((d) => ({ ...d, age: e.target.value }))} /></div>
                    <div>
                      <Label className="text-[11px]">{tr("gender")} *</Label>
                      <select className={cn(inputClass, "mt-1")} value={vetDraft.gender} onChange={(e) => setVetDraft((d) => ({ ...d, gender: e.target.value }))}>
                        <option value="">—</option>
                        <option value="male">{tr("male")}</option>
                        <option value="female">{tr("female")}</option>
                        <option value="other">{tr("other")}</option>
                      </select>
                    </div>
                    <div><Label className="text-[11px]">{tr("dateOfBirth")} *</Label><Input className="mt-1 h-9 text-[13px]" type="date" value={vetDraft.dateOfBirth} onChange={(e) => setVetDraft((d) => ({ ...d, dateOfBirth: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("specialization")} *</Label><Input className="mt-1 h-9 text-[13px]" value={vetDraft.specialization} onChange={(e) => setVetDraft((d) => ({ ...d, specialization: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("password")} *</Label><Input className="mt-1 h-9 text-[13px]" type="password" value={vetDraft.initialPassword} onChange={(e) => setVetDraft((d) => ({ ...d, initialPassword: e.target.value }))} /></div>
                    <div className="sm:col-span-2"><Label className="text-[11px]">{tr("address")}</Label><Input className="mt-1 h-9 text-[13px]" value={vetDraft.address} onChange={(e) => setVetDraft((d) => ({ ...d, address: e.target.value }))} /></div>
                    <div>
                      <Label className="text-[11px]">{tr("profilePhoto")}</Label>
                      <div className="mt-1">
                        <Dropzone label={tr("profilePhotoChoose")} value={vetDraft.photoDataUrl} onChange={(dataUrl) => setVetDraft((d) => ({ ...d, photoDataUrl: dataUrl }))} onClear={() => setVetDraft((d) => ({ ...d, photoDataUrl: "" }))} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={handleAddVeterinarian}><Check className="h-4 w-4" />{tr("addVet")}</Button>
                    <Button variant="secondary" onClick={() => handleSelectSection("veterinarians")}>{tr("cancel")}</Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Governance ─── */}
            {activeSection === "governance" && (
              <div className="space-y-4 animate-in">
                <SectionHeader title={tr("accessGovernance")} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={card}>
                    <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("accessGovernance")}</h3>
                    <ul className="mt-3 space-y-2 text-[13px] text-accent-subtle">
                      <li className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 dark:border-neutral-800"><span>{tr("roleReviewsDue")}</span><Badge variant="warning">8</Badge></li>
                      <li className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 dark:border-neutral-800"><span>{tr("suspendedClinicsPending")}</span><Badge variant="outline">2</Badge></li>
                      <li className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 dark:border-neutral-800"><span>{tr("unverifiedVetLicenses")}</span><Badge variant="danger">5</Badge></li>
                    </ul>
                  </div>

                  <div className={card}>
                    <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("globalConfiguration")}</h3>
                    <div className="mt-3 space-y-2 text-[13px] text-accent">
                      <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 dark:border-neutral-800">
                        <span>{tr("enableSlotConflictChecks")}</span>
                        <input type="checkbox" defaultChecked className="h-4 w-4" />
                      </label>
                      <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 dark:border-neutral-800">
                        <span>{tr("requireReVerification")}</span>
                        <input type="checkbox" defaultChecked className="h-4 w-4" />
                      </label>
                      <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 dark:border-neutral-800">
                        <span>{tr("allowEmergencyOverrides")}</span>
                        <input type="checkbox" className="h-4 w-4" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className={card}>
                  <h3 className="text-[15px] font-semibold text-accent dark:text-white">{tr("feedbackAnalytics")}</h3>
                  <p className="mt-0.5 text-[12px] text-accent-subtle">{tr("feedbackAnalyticsDetail")}</p>
                  {feedbackSummary && feedbackSummary.feedback_count + feedbackSummary.diagnosed_count > 0 ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border/60 p-3 dark:border-neutral-800">
                        <p className="text-[12px] font-medium text-accent-subtle">{tr("ownerHelpfulRate")}</p>
                        <p className="mt-1 text-2xl font-semibold text-accent dark:text-white">
                          {feedbackSummary.helpful_rate != null ? `${Math.round(feedbackSummary.helpful_rate * 100)}%` : "—"}
                        </p>
                        <p className="mt-1 text-[11px] text-accent-faint">{tr("responsesCount").replace("{n}", String(feedbackSummary.feedback_count))}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 p-3 dark:border-neutral-800">
                        <p className="text-[12px] font-medium text-accent-subtle">{tr("diagnosesConfirmed")}</p>
                        <p className="mt-1 text-2xl font-semibold text-accent dark:text-white">{feedbackSummary.diagnosed_count}</p>
                        <p className="mt-1 text-[11px] text-accent-faint">/ {feedbackSummary.total_predictions}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 p-3 dark:border-neutral-800">
                        <p className="text-[12px] font-medium text-accent-subtle">{tr("aiVetAgreement")}</p>
                        <p className="mt-1 text-2xl font-semibold text-accent dark:text-white">
                          {feedbackSummary.ai_vs_vet_agreement_rate != null ? `${Math.round(feedbackSummary.ai_vs_vet_agreement_rate * 100)}%` : "—"}
                        </p>
                        <p className="mt-1 text-[11px] text-accent-faint">{feedbackSummary.ai_vs_vet_agreement}/{feedbackSummary.diagnosed_count}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[13px] text-accent-subtle">{tr("noFeedbackYet")}</p>
                  )}
                </div>
              </div>
            )}

            {/* ─── Profile ─── */}
            {activeSection === "profile" && (
              <div className="animate-in">
                <SectionHeader title={tr("administratorDetails")} subtitle={tr("manageAccountDetail")} />
                <div className={cn(card, "max-w-2xl")}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      {adminProfile.photoDataUrl ? <AvatarImage src={adminProfile.photoDataUrl} alt={tr("adminProfileAlt")} /> : null}
                      <AvatarFallback className="text-xl">{adminInitial}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[15px] font-semibold text-accent dark:text-white">{displayName}</p>
                      <p className="text-[12px] text-accent-subtle">{adminProfile.designation}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-[11px]">{tr("fullName")}</Label><Input className="mt-1 h-9 text-[13px]" value={adminProfile.name} onChange={(e) => setAdminProfile((p) => ({ ...p, name: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("designation")}</Label><Input className="mt-1 h-9 text-[13px]" value={adminProfile.designation} onChange={(e) => setAdminProfile((p) => ({ ...p, designation: e.target.value }))} /></div>
                    <div><Label className="text-[11px]">{tr("email")}</Label><Input className="mt-1 h-9 text-[13px]" type="email" value={adminProfile.email} readOnly disabled /></div>
                    <div><Label className="text-[11px]">{tr("phone")}</Label><Input className="mt-1 h-9 text-[13px]" value={adminProfile.phone} onChange={(e) => setAdminProfile((p) => ({ ...p, phone: e.target.value }))} /></div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">{tr("bio")}</Label>
                      <textarea
                        value={adminProfile.bio}
                        onChange={(e) => setAdminProfile((p) => ({ ...p, bio: e.target.value }))}
                        className="mt-1 h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-accent outline-none transition focus:border-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px]">{tr("profilePhoto")}</Label>
                      <div className="mt-1">
                        <Dropzone label={tr("profilePhotoChoose")} value={adminProfile.photoDataUrl} onChange={(dataUrl) => setAdminProfile((p) => ({ ...p, photoDataUrl: dataUrl }))} onClear={() => setAdminProfile((p) => ({ ...p, photoDataUrl: "" }))} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button onClick={handleSaveProfile} disabled={profileSaving || profileLoading}><Check className="h-4 w-4" />{profileSaving ? tr("loadingData") : tr("saveProfile")}</Button>
                    <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" onClick={handleDeleteProfile}>
                      <Trash2 className="h-4 w-4" />{tr("deleteProfile")}
                    </Button>
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
