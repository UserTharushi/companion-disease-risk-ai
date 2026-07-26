import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { VetClinic } from "@companion-ai/shared-types";
import { getClinic } from "../lib/api";

export function ClinicDetailPage() {
  const { clinicId } = useParams();
  const navigate = useNavigate();
  const [clinic, setClinic] = useState<VetClinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    getClinic(clinicId)
      .then(setClinic)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clinicId]);

  if (loading) return <div className="p-6 text-slate-500">Loading clinic...</div>;
  if (!clinic) return <div className="p-6 text-red-600">{error || "Clinic not found"}</div>;

  return (
    <div className="min-h-full bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Clinic Detail</p>
              <h1 className="text-3xl font-semibold text-slate-900">{clinic.name}</h1>
              <p className="mt-1 text-slate-600">{clinic.address}</p>
            </div>
            <button className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700" onClick={() => navigate("/vet-discovery")}>Back</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {clinic.specializations.map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{item}</span>
            ))}
          </div>
          <div className="mt-4 text-sm text-slate-600">
            <p>Phone: {clinic.phone}</p>
            <p>Email: {clinic.email || "-"}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {clinic.surgeons.map((surgeon) => (
            <article key={surgeon.id} className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{surgeon.name}</h2>
                  <p className="text-slate-600">{surgeon.specialization}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {surgeon.qualifications.map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{item}</span>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {surgeon.availableSlots.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{new Date(slot.datetime).toLocaleString()}</p>
                      <p className="text-sm text-slate-500">{slot.durationMins} mins</p>
                    </div>
                    <button
                      className={`rounded-xl px-4 py-2 text-sm font-semibold ${slot.isBooked ? "bg-slate-100 text-slate-400" : "bg-green-500 text-white"}`}
                      disabled={slot.isBooked}
                      onClick={() => navigate(`/vet-discovery/${clinic.id}/book?surgeonId=${surgeon.id}&slotId=${slot.id}`)}
                    >
                      {slot.isBooked ? "Booked" : "Book"}
                    </button>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
