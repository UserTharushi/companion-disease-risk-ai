import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getVerifiedRole, getProfileNameForRole } from "../lib/session";
import authVetConsultImage from "../assets/images/auth-vet-consult.jpg";

const PET_OWNER_APPOINTMENTS_KEY = "companion_ai_pet_owner_appointments";
const PET_OWNER_SURGEON_INQUIRIES_KEY = "companion_ai_pet_owner_surgeon_inquiries";

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

export function VeterinarianDashboardPage() {
  const navigate = useNavigate();
  const role = getVerifiedRole();
  const vetName = getProfileNameForRole("veterinarian", "Dr. Veterinarian");
  const firstName = vetName.trim().split(/\s+/)[0] || "Dr.";

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const raw = localStorage.getItem(PET_OWNER_APPOINTMENTS_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as Appointment[];
      return Array.isArray(parsed)
        ? parsed.map((appointment) => ({
            ...appointment,
            time: appointment.time || appointment.slot || "TBD",
            consultationType: appointment.consultationType || "General Consultation",
          }))
        : [];
    } catch {
      return [];
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
    {
      id: "3",
      petName: "Luna",
      petType: "Cat",
      breed: "Persian",
      ownerName: "Mike Davis",
      lastVisitDate: "March 20, 2026",
      vaccineStatus: "Up to date",
      allergies: [],
      conditions: ["Post-surgery recovery"],
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
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as SurgeonInquiryRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"today" | "patients" | "follow-ups" | "messages">(
    "today"
  );

  // Redirect if not a vet
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
      (p) =>
        p.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.breed.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const todayAppointmentCount = appointments.length;
  const pendingAppointments = appointments.filter((a) => a.status === "pending").length;
  const highPriorityFollowUps = followUps.filter((f) => f.priority === "high").length;
  const unreadMessages = messages.filter((m) => !m.isRead).length;
  const totalPatients = patients.length;

  const handleConfirmAppointment = (id: string) => {
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === id ? { ...appointment, status: "confirmed" } : appointment,
      ),
    );
  };

  const handleRescheduleAppointment = (id: string) => {
    const nextSlot = window.prompt("Enter new slot for this appointment (example: 04:00 PM):");
    if (!nextSlot?.trim()) return;
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === id
          ? { ...appointment, time: nextSlot.trim(), slot: nextSlot.trim(), status: "pending" }
          : appointment,
      ),
    );
  };

  const handleCancelAppointment = (id: string) => {
    setAppointments((prev) =>
      prev.map((appointment) =>
        appointment.id === id ? { ...appointment, status: "cancelled" } : appointment,
      ),
    );
  };

  const handleCreateNote = (appointmentId: string) => {
    alert(`Create consultation note for appointment ${appointmentId}`);
  };

  const handleMarkInquiryAsReplied = (inquiryId: string) => {
    setSurgeonInquiries((prev) =>
      prev.map((inquiry) => (inquiry.id === inquiryId ? { ...inquiry, status: "replied" } : inquiry)),
    );
  };

  return (
    <div className="min-h-dvh bg-slate-100">
      {/* Header */}
      <section className="mx-4 mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <img
          src={authVetConsultImage}
          alt="Veterinary clinic team"
          className="h-36 w-full object-cover"
        />
        <div className="flex w-full items-start justify-between px-5 pb-4 pt-4">
          <div>
            <p className="text-base leading-6 text-slate-500">Welcome back,</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight text-slate-900">{firstName}</h1>
            <p className="mt-1 text-base text-slate-600">Veterinary Clinic Dashboard</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="h-12 w-12 rounded-full border border-slate-200 bg-white text-xl"
              aria-label="Notifications"
              title="Notifications"
            >
              🔔
            </button>
            <button
              type="button"
              className="h-12 w-12 rounded-full border border-slate-200 bg-white text-xl"
              aria-label="Settings"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-5">
            <p className="text-sm font-medium text-blue-900">Today's Appointments</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{todayAppointmentCount}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-5">
            <p className="text-sm font-medium text-amber-900">Pending Confirmations</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">{pendingAppointments}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-red-50 to-red-100 p-5">
            <p className="text-sm font-medium text-red-900">Follow-ups Due</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{highPriorityFollowUps}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-5">
            <p className="text-sm font-medium text-purple-900">Total Patients</p>
            <p className="mt-1 text-3xl font-bold text-purple-600">{totalPatients}</p>
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white px-5">
        <div className="flex gap-6 overflow-x-auto">
          {(
            [
              { id: "today" as const, label: "📅 Today", icon: "calendar" },
              { id: "patients" as const, label: "🐾 Patients", icon: "patients" },
              { id: "follow-ups" as const, label: "📋 Follow-ups", icon: "followups" },
              { id: "messages" as const, label: `💬 Messages${unreadMessages > 0 ? ` (${unreadMessages})` : ""}`, icon: "messages" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 border-b-2 px-1 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Content Area */}
      <section className="px-4 pb-20 pt-6 sm:px-6">
        {/* TODAY'S SCHEDULE TAB */}
        {activeTab === "today" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Today's Appointments</h2>
            {appointments.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
                <p className="text-slate-600">No appointments scheduled for today</p>
              </div>
            ) : (
              appointments.map((appt) => (
                <div
                  key={appt.id}
                  className={`rounded-lg border-l-4 p-4 transition ${
                    appt.status === "pending"
                      ? "border-l-amber-500 bg-amber-50"
                      : appt.status === "confirmed"
                        ? "border-l-green-500 bg-green-50"
                        : "border-l-slate-400 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⏰</span>
                        <p className="font-semibold text-slate-900">{appt.time}</p>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            appt.status === "pending"
                              ? "bg-amber-200 text-amber-800"
                              : appt.status === "confirmed"
                                ? "bg-green-200 text-green-800"
                                : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {appt.status}
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-sm text-slate-700">
                        <span>🐾</span>
                        <span className="font-medium">{appt.petName}</span>
                        <span className="text-slate-500">• {appt.petType}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                        <span>👤</span>
                        <span>{appt.ownerName}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                        <span>📞</span>
                        {appt.ownerPhone ? (
                          <a href={`tel:${appt.ownerPhone}`} className="text-blue-600 hover:underline">
                            {appt.ownerPhone}
                          </a>
                        ) : (
                          <span className="text-slate-500">No phone provided</span>
                        )}
                      </p>
                      <div className="mt-2 flex gap-1 flex-wrap">
                        <span className="inline-block rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                          {appt.consultationType}
                        </span>
                        {appt.notes && (
                          <span className="inline-block rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            📝 {appt.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap text-sm">
                    {appt.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleConfirmAppointment(appt.id)}
                          className="rounded bg-green-600 px-3 py-1 font-medium text-white hover:bg-green-700"
                        >
                          ✓ Confirm
                        </button>
                        <button
                          onClick={() => handleRescheduleAppointment(appt.id)}
                          className="rounded border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100"
                        >
                          📅 Reschedule
                        </button>
                        <button
                          onClick={() => handleCancelAppointment(appt.id)}
                          className="rounded border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100"
                        >
                          ✕ Cancel
                        </button>
                      </>
                    )}
                    {appt.status === "confirmed" && (
                      <button
                        onClick={() => handleCancelAppointment(appt.id)}
                        className="rounded border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100"
                      >
                        ✕ Cancel
                      </button>
                    )}
                    {(appt.status === "confirmed" || appt.status === "pending") && (
                      <button
                        onClick={() => handleCreateNote(appt.id)}
                        className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
                      >
                        📝 Consultation Notes
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PATIENTS TAB */}
        {activeTab === "patients" && (
          <div className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Search by pet name, owner, or breed..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {filteredPatients.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
                <p className="text-slate-600">No patients found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="cursor-pointer rounded-lg border border-slate-200 p-4 transition hover:border-blue-400 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{patient.petName}</p>
                        <p className="text-sm text-slate-600">
                          {patient.petType} • {patient.breed}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">Owner: {patient.ownerName}</p>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              patient.vaccineStatus === "Up to date"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {patient.vaccineStatus}
                          </span>
                          {patient.allergies.length > 0 && (
                            <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                              ⚠️ Allergies: {patient.allergies.join(", ")}
                            </span>
                          )}
                          {patient.conditions.length > 0 && (
                            <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                              📋 {patient.conditions.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-2xl">→</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Last visit: {patient.lastVisitDate}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FOLLOW-UPS TAB */}
        {activeTab === "follow-ups" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Follow-up Reminders</h2>
            {followUps.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
                <p className="text-slate-600">No follow-ups scheduled</p>
              </div>
            ) : (
              followUps.map((followUp) => (
                <div
                  key={followUp.id}
                  className={`rounded-lg border-l-4 p-4 ${
                    followUp.priority === "high"
                      ? "border-l-red-500 bg-red-50"
                      : followUp.priority === "medium"
                        ? "border-l-amber-500 bg-amber-50"
                        : "border-l-blue-500 bg-blue-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{followUp.petName}</p>
                      <p className="mt-1 text-sm text-slate-700">{followUp.type}</p>
                      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-600">
                        <span>📅</span>
                        {followUp.dueDate}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        followUp.priority === "high"
                          ? "bg-red-200 text-red-800"
                          : followUp.priority === "medium"
                            ? "bg-amber-200 text-amber-800"
                            : "bg-blue-200 text-blue-800"
                      }`}
                    >
                      {followUp.priority.toUpperCase()}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mt-3 rounded bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    ✓ Mark as Done
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* MESSAGES TAB */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Owner Messages</h2>
            {messages.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
                <p className="text-slate-600">No surgeon inquiries yet</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-4 transition ${
                    msg.isRead
                      ? "border-slate-200 bg-slate-50"
                      : "border-blue-300 bg-blue-50 font-medium"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={msg.isRead ? "text-slate-900" : "font-semibold text-blue-900"}>
                        {msg.fromName}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{msg.subject}</p>
                      <p className="mt-2 text-xs text-slate-500">{msg.timestamp}</p>
                    </div>
                    {!msg.isRead && (
                      <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      ✉️ Reply
                    </button>
                    {!msg.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkInquiryAsReplied(msg.id)}
                        className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Mark as Replied
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Patient Detail Drawer */}
      {selectedPatient && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition"
          onClick={() => setSelectedPatient(null)}
        >
          <div
            className="fixed bottom-0 right-0 top-0 w-full bg-white shadow-lg sm:w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Patient Details</h3>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="text-2xl text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">Pet Name</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{selectedPatient.petName}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Type</p>
                    <p className="mt-1 text-slate-900">{selectedPatient.petType}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Breed</p>
                    <p className="mt-1 text-slate-900">{selectedPatient.breed}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-600">Owner Name</p>
                  <p className="mt-1 text-slate-900">{selectedPatient.ownerName}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-600">Last Visit</p>
                  <p className="mt-1 text-slate-900">{selectedPatient.lastVisitDate}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-600">Vaccination Status</p>
                  <p
                    className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium ${
                      selectedPatient.vaccineStatus === "Up to date"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {selectedPatient.vaccineStatus}
                  </p>
                </div>

                {selectedPatient.allergies.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Allergies</p>
                    <div className="mt-2 space-y-1">
                      {selectedPatient.allergies.map((allergy) => (
                        <span
                          key={allergy}
                          className="block rounded bg-yellow-50 px-2 py-1 text-sm text-yellow-700"
                        >
                          ⚠️ {allergy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPatient.conditions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-600">Known Conditions</p>
                    <div className="mt-2 space-y-1">
                      {selectedPatient.conditions.map((condition) => (
                        <span
                          key={condition}
                          className="block rounded bg-orange-50 px-2 py-1 text-sm text-orange-700"
                        >
                          📋 {condition}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-slate-100 p-4">
                  <span className="text-lg">💡</span>
                  <p className="mt-2 text-sm text-slate-700">
                    <strong>AI Health Check Available:</strong> This patient's recent symptom check shows
                    medium risk - consider discussing preventive care options.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 p-5">
                <button
                  type="button"
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  📝 Create Consultation Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
