import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VetClinic } from "@companion-ai/shared-types";
import { listClinics } from "../lib/api";

export function ClinicMapPage() {
  const navigate = useNavigate();
  const [clinics, setClinics] = useState<VetClinic[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    listClinics(query)
      .then((data) => {
        if (active) setClinics(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  return (
    <div className="min-h-full bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Vet Discovery</p>
          <h1 className="text-3xl font-semibold text-slate-900">Find Veterinary Clinics</h1>
          <div className="mt-4 flex gap-3">
            <input className="flex-1 rounded-xl border border-slate-200 px-4 py-3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by clinic, surgeon, or specialization" />
            <button className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-white" onClick={() => listClinics(query).then(setClinics)}>
              Search
            </button>
          </div>
        </div>

        {loading && <div className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">Loading clinics...</div>}
        {!loading && error && <div className="rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clinics.map((clinic) => (
            <article key={clinic.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{clinic.name}</h2>
                  <p className="mt-1 text-slate-600">{clinic.address}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${clinic.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {clinic.isOpen ? "Open" : "Closed"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {clinic.specializations.map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{item}</span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <span>{clinic.surgeons.length} vets</span>
              </div>
              <button className="mt-5 w-full rounded-xl bg-green-500 px-4 py-3 font-semibold text-white" onClick={() => navigate(`/vet-discovery/${clinic.id}`)}>
                View Surgeons & Slots
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
