import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { VaccinationRecord } from "@companion-ai/shared-types";
import { getOwnerId, listVaccinations, deleteVaccination, getUpcomingVaccinations } from "../lib/api";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function VaccinationDashboard() {
  const [petId, setPetId] = useState("pet-1");
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [upcoming, setUpcoming] = useState<VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ownerId = useMemo(() => getOwnerId(), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listVaccinations(petId), getUpcomingVaccinations(petId)])
      .then(([all, next]) => {
        if (!active) return;
        setRecords(all);
        setUpcoming(next);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [petId]);

  async function handleDelete(recordId: string) {
    await deleteVaccination(recordId);
    const [all, next] = await Promise.all([listVaccinations(petId), getUpcomingVaccinations(petId)]);
    setRecords(all);
    setUpcoming(next);
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Vaccination Service</p>
            <h1 className="text-3xl font-semibold">Vaccination Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Owner session: {ownerId}</p>
          </div>
          <div className="flex items-center gap-3">
            <input className="rounded-xl border border-slate-200 px-4 py-3" value={petId} onChange={(e) => setPetId(e.target.value)} placeholder="Pet ID" />
            <Link className="rounded-xl bg-green-500 px-4 py-3 font-semibold text-white" to="/vaccination/add">Add record</Link>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading vaccination records...</p>}
        {error && <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold">Upcoming due</h2>
            <div className="mt-3 space-y-3">
              {upcoming.length === 0 && <p className="text-sm text-slate-500">No upcoming vaccinations found for this pet.</p>}
              {upcoming.map((record) => (
                <div key={record.id} className="rounded-xl bg-amber-50 p-3">
                  <p className="font-medium text-amber-900">{record.vaccineName}</p>
                  <p className="text-sm text-amber-800">Due {formatDate(record.nextDueAt)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold">Records</h2>
            <div className="mt-3 space-y-3">
              {records.length === 0 && <p className="text-sm text-slate-500">No vaccination records found.</p>}
              {records.map((record) => (
                <div key={record.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{record.vaccineName}</p>
                      <p className="text-sm text-slate-500">Administered {formatDate(record.administeredAt)}</p>
                      <p className="text-sm text-slate-500">Next due {formatDate(record.nextDueAt)}</p>
                    </div>
                    <button type="button" className="text-sm font-medium text-red-600" onClick={() => handleDelete(record.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
