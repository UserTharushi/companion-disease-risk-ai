import { useEffect, useMemo, useState } from "react";
import { getProfileNameForRole, getVerifiedRole } from "../lib/session";
import adminOpsHeroImage from "../assets/images/admin-ops-hero.jpg";

const CLINIC_DIRECTORY_KEY = "companion_ai_clinic_directory";

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

interface SurgeonRecord {
  id: string;
  name: string;
  specialization: string;
  availableSlots: string[];
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
    longitude: 80.5540,
    surgeons: [],
  },
];

function loadClinicDirectory(): ClinicRecord[] {
  const raw = localStorage.getItem(CLINIC_DIRECTORY_KEY);
  if (!raw) return DEFAULT_CLINICS;

  try {
    const parsed = JSON.parse(raw) as ClinicRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CLINICS;

    // Migration-safe: ensure surgeons field always exists
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
  const activeRole = getVerifiedRole();
  const adminName = getProfileNameForRole("admin", "Admin");
  const firstName = adminName.trim().split(/\s+/)[0] || "Admin";

  const [activeView, setActiveView] = useState<"overview" | "approvals" | "operations" | "clinics" | "governance">("overview");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [editingClinicDraft, setEditingClinicDraft] = useState<ClinicRecord | null>(null);
  const [surgeonDraftByClinic, setSurgeonDraftByClinic] = useState<Record<string, { name: string; specialization: string; slots: string }>>({});

  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    { id: "ap-101", type: "clinic", name: "Green Valley Pet Clinic", submittedAt: "2026-03-22", status: "pending" },
    { id: "ap-102", type: "veterinarian", name: "Dr. Niroshan Perera", submittedAt: "2026-03-23", status: "pending" },
    { id: "ap-103", type: "clinic", name: "Animal Care Hub", submittedAt: "2026-03-24", status: "pending" },
  ]);

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

  const [clinics, setClinics] = useState<ClinicRecord[]>(() => loadClinicDirectory());

  const platformHealth = {
    activeClinics: 27,
    activeVeterinarians: 61,
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

  function handleApprovalDecision(id: string, decision: "approved" | "rejected") {
    setApprovals((prev) => prev.map((item) => (item.id === id ? { ...item, status: decision } : item)));
  }

  function handleBroadcastSend() {
    if (!broadcastMessage.trim()) return;
    // Placeholder for notification service integration.
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
    setClinics((prev) =>
      prev.map((clinic) => (clinic.id === editingClinicId ? { ...editingClinicDraft } : clinic))
    );
    setEditingClinicId(null);
    setEditingClinicDraft(null);
  }

  function deleteClinic(clinicId: string, clinicName: string) {
    const confirmed = window.confirm(`Delete clinic \"${clinicName}\"? This action cannot be undone.`);
    if (!confirmed) return;

    setClinics((prev) => prev.filter((clinic) => clinic.id !== clinicId));
    if (editingClinicId === clinicId) {
      setEditingClinicId(null);
      setEditingClinicDraft(null);
    }
  }

  function updateSurgeonDraft(
    clinicId: string,
    field: "name" | "specialization" | "slots",
    value: string,
  ) {
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

  const sectionButton = (id: "overview" | "approvals" | "operations" | "clinics" | "governance", label: string) => (
    <button
      type="button"
      onClick={() => setActiveView(id)}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        activeView === id
          ? "border-blue-200 bg-blue-600 text-white shadow-md"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-dvh bg-gradient-to-br from-cyan-50 via-white to-emerald-50">
      <header className="mx-4 mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <img
          src={adminOpsHeroImage}
          alt="Veterinary operations workspace"
          className="h-36 w-full object-cover"
        />
        <div className="w-full">
          <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-4">
            <div>
              <p className="text-base text-slate-500">Welcome back,</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">{firstName}</h1>
              <p className="mt-1 text-base text-slate-600">Platform Administration</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Service Health</p>
              <p className="text-lg font-semibold text-slate-900">
                {platformHealth.servicesOnline}/{platformHealth.servicesTotal} Online
              </p>
              <p className="mt-1 text-xs text-slate-500">{activeRole || "admin"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-5 pb-4">
            {sectionButton("overview", "Overview")}
            {sectionButton("approvals", "Approvals")}
            {sectionButton("operations", "Operations")}
            {sectionButton("clinics", "Manage Clinics")}
            {sectionButton("governance", "Governance")}
          </div>
        </div>
      </header>

      <main className="w-full px-5 pb-10 pt-5">
        {activeView === "overview" && (
          <section className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-100 to-emerald-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-emerald-800">Active Clinics</p>
                <p className="mt-1 text-4xl font-bold text-emerald-900">{platformHealth.activeClinics}</p>
              </article>
              <article className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-100 to-sky-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-sky-800">Active Veterinarians</p>
                <p className="mt-1 text-4xl font-bold text-sky-900">{platformHealth.activeVeterinarians}</p>
              </article>
              <article className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-100 to-violet-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-violet-800">Today's Bookings</p>
                <p className="mt-1 text-4xl font-bold text-violet-900">{platformHealth.todaysBookings}</p>
              </article>
              <article className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-100 to-rose-50 p-5 shadow-sm">
                <p className="text-sm font-medium text-rose-800">Cancellation Rate</p>
                <p className="mt-1 text-4xl font-bold text-rose-900">{platformHealth.cancellationRate}%</p>
              </article>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900">Operational Snapshot</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-700">Pending Approvals</p>
                    <p className="mt-1 text-2xl font-bold text-amber-600">{openApprovals}</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-xs font-medium text-red-700">High Priority Tickets</p>
                    <p className="mt-1 text-2xl font-bold text-red-600">{openHighPriorityTickets}</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-700">Avg Confirm Time</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600">{platformHealth.avgConfirmTimeMins}m</p>
                  </div>
                </div>

                <h3 className="mt-5 text-sm font-semibold text-slate-700">Audit Trail</h3>
                <ul className="mt-2 space-y-2">
                  {auditLogs.map((log, idx) => (
                    <li key={log.id} className={`rounded-xl border p-3 text-sm ${idx % 2 === 0 ? "border-sky-100 bg-sky-50/40" : "border-emerald-100 bg-emerald-50/40"}`}>
                      <p className="font-medium text-slate-800">{log.action}</p>
                      <p className="mt-1 text-slate-600">
                        {log.actor} • {log.target} • {log.timestamp}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-gradient-to-b from-indigo-50 to-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Broadcast Notice</h2>
                <p className="mt-1 text-sm text-slate-500">Send updates to all clinics and vets.</p>
                <textarea
                  value={broadcastMessage}
                  onChange={(event) => setBroadcastMessage(event.target.value)}
                  className="mt-3 h-28 w-full rounded-xl border border-indigo-200 p-3 text-sm outline-none focus:border-indigo-500"
                  placeholder="Example: System maintenance at 10:00 PM tonight."
                />
                <button
                  type="button"
                  onClick={handleBroadcastSend}
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 font-medium text-white hover:from-indigo-500 hover:to-blue-500"
                >
                  Send Broadcast
                </button>
              </article>
            </div>
          </section>
        )}

        {activeView === "approvals" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Approval and Verification Queue</h2>
            {approvals.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-4 shadow-sm ${item.type === "clinic" ? "border-emerald-200 bg-emerald-50/40" : "border-sky-200 bg-sky-50/40"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-600">{item.type === "clinic" ? "Clinic" : "Veterinarian"} Verification</p>
                    <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                    <p className="text-sm text-slate-600">Submitted on {item.submittedAt}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : item.status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                  }`}
                  >
                    {item.status}
                  </span>
                </div>

                {item.status === "pending" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprovalDecision(item.id, "approved")}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprovalDecision(item.id, "rejected")}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {activeView === "operations" && (
          <section className="space-y-5">
            <h2 className="text-xl font-semibold text-slate-900">Booking Operations and Capacity</h2>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Clinic Slot Utilization</h3>
              <p className="text-sm text-slate-500">Utilization {utilizationSummary.utilizationPct}% • Avg no-show {utilizationSummary.avgNoShow}%</p>
              <div className="mt-3 space-y-3">
                {clinicUtilization.map((clinic) => {
                  const pct = Math.round((clinic.bookedSlots / clinic.totalSlots) * 100);
                  return (
                    <div key={clinic.clinicName} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <p className="font-semibold text-slate-800">{clinic.clinicName}</p>
                        <p className="text-slate-600">{clinic.bookedSlots}/{clinic.totalSlots} slots</p>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-200">
                        <div className={`h-2 rounded-full ${pct >= 85 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">No-show rate: <span className={clinic.noShowRate >= 15 ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>{clinic.noShowRate}%</span></p>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Dispute and Support Tickets</h3>
              <div className="mt-3 space-y-2">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800">{ticket.subject}</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        ticket.priority === "high"
                          ? "bg-red-100 text-red-700"
                          : ticket.priority === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {ticket.category} • {ticket.raisedBy} • {ticket.status}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeView === "governance" && (
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-fuchsia-200 bg-gradient-to-b from-fuchsia-50 to-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Access Governance</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="rounded-lg bg-fuchsia-100/60 p-3">Role reviews due this week: 8 users</li>
                <li className="rounded-lg bg-fuchsia-100/60 p-3">Suspended clinics pending reactivation: 2</li>
                <li className="rounded-lg bg-fuchsia-100/60 p-3">Unverified vet licenses: 5</li>
              </ul>
            </article>

            <article className="rounded-2xl border border-cyan-200 bg-gradient-to-b from-cyan-50 to-white p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Global Configuration</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <label className="flex items-center justify-between rounded-lg bg-cyan-100/70 p-3">
                  <span>Enable automatic slot conflict checks</span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className="flex items-center justify-between rounded-lg bg-cyan-100/70 p-3">
                  <span>Require vet re-verification every 6 months</span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className="flex items-center justify-between rounded-lg bg-cyan-100/70 p-3">
                  <span>Allow emergency booking overrides</span>
                  <input type="checkbox" />
                </label>
              </div>
            </article>
          </section>
        )}

        {activeView === "clinics" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Manage Existing Clinics</h2>
              <p className="mt-1 text-sm text-slate-600">
                Admins can update clinic profile details, contact information, specialization, and active status.
              </p>
            </div>

            <div className="space-y-3">
              {clinics.map((clinic) => {
                const isEditing = editingClinicId === clinic.id;
                const draft = isEditing ? editingClinicDraft : null;

                return (
                  <article key={clinic.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{clinic.name}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          clinic.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {clinic.status}
                      </span>
                    </div>

                    {isEditing && draft ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <input
                          value={draft.name}
                          onChange={(event) => setEditingClinicDraft({ ...draft, name: event.target.value })}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                          placeholder="Clinic Name"
                        />
                        <input
                          value={draft.specialization}
                          onChange={(event) => setEditingClinicDraft({ ...draft, specialization: event.target.value })}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                          placeholder="Specialization"
                        />
                        <input
                          value={draft.phone}
                          onChange={(event) => setEditingClinicDraft({ ...draft, phone: event.target.value })}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                          placeholder="Phone"
                        />
                        <input
                          value={draft.email}
                          onChange={(event) => setEditingClinicDraft({ ...draft, email: event.target.value })}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                          placeholder="Email"
                        />
                        <input
                          value={draft.address}
                          onChange={(event) => setEditingClinicDraft({ ...draft, address: event.target.value })}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500 md:col-span-2"
                          placeholder="Address"
                        />
                        <input
                          type="number"
                          step="0.0001"
                          value={draft.latitude}
                          onChange={(event) =>
                            setEditingClinicDraft({
                              ...draft,
                              latitude: Number(event.target.value),
                            })
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                          placeholder="Latitude"
                        />
                        <input
                          type="number"
                          step="0.0001"
                          value={draft.longitude}
                          onChange={(event) =>
                            setEditingClinicDraft({
                              ...draft,
                              longitude: Number(event.target.value),
                            })
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                          placeholder="Longitude"
                        />
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setEditingClinicDraft({
                              ...draft,
                              status: event.target.value as "active" | "inactive",
                            })
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>

                        <div className="flex gap-2 md:col-span-2">
                          <button
                            type="button"
                            onClick={saveClinicEdit}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={cancelClinicEdit}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-1 text-sm text-slate-700">
                        <p><span className="font-medium">Address:</span> {clinic.address}</p>
                        <p><span className="font-medium">Phone:</span> {clinic.phone}</p>
                        <p><span className="font-medium">Email:</span> {clinic.email}</p>
                        <p><span className="font-medium">Specialization:</span> {clinic.specialization}</p>
                        <p><span className="font-medium">Coordinates:</span> {clinic.latitude.toFixed(4)}, {clinic.longitude.toFixed(4)}</p>

                        <div className="mt-3 rounded-xl bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-900">Surgeons and Available Time Slots</p>
                          {clinic.surgeons.length === 0 ? (
                            <p className="mt-2 text-xs text-slate-500">No surgeons assigned yet.</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {clinic.surgeons.map((surgeon) => (
                                <div key={surgeon.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">{surgeon.name}</p>
                                      <p className="text-xs text-slate-600">{surgeon.specialization}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeSurgeonFromClinic(clinic.id, surgeon.id)}
                                      className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {surgeon.availableSlots.length === 0 ? (
                                      <span className="text-xs text-slate-500">No slots specified</span>
                                    ) : (
                                      surgeon.availableSlots.map((slot) => (
                                        <span key={slot} className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
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
                            <input
                              value={surgeonDraftByClinic[clinic.id]?.name || ""}
                              onChange={(event) => updateSurgeonDraft(clinic.id, "name", event.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-green-500"
                              placeholder="Surgeon name"
                            />
                            <input
                              value={surgeonDraftByClinic[clinic.id]?.specialization || ""}
                              onChange={(event) => updateSurgeonDraft(clinic.id, "specialization", event.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-green-500"
                              placeholder="Specialization"
                            />
                            <input
                              value={surgeonDraftByClinic[clinic.id]?.slots || ""}
                              onChange={(event) => updateSurgeonDraft(clinic.id, "slots", event.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-green-500"
                              placeholder="Slots e.g. Mon 09:00, Tue 14:30"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => addSurgeonToClinic(clinic.id)}
                            className="mt-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                          >
                            Add Surgeon and Slots
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => startClinicEdit(clinic)}
                          className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                        >
                          Edit Clinic
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteClinic(clinic.id, clinic.name)}
                          className="mt-2 ml-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                        >
                          Delete Clinic
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}

              {clinics.length === 0 && (
                <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                  No clinics available. Add or approve clinics to manage them here.
                </article>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
