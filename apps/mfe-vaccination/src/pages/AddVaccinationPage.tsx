import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createVaccination } from "../lib/api";

export function AddVaccinationPage() {
  const navigate = useNavigate();
  const [petId, setPetId] = useState("pet-1");
  const [vaccineName, setVaccineName] = useState("Rabies");
  const [administeredAt, setAdministeredAt] = useState("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [administeredBy, setAdministeredBy] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createVaccination({
        petId,
        vaccineName,
        administeredAt,
        nextDueAt,
        administeredBy: administeredBy || undefined,
        batchNumber: batchNumber || undefined,
        notes: notes || undefined,
      });
      navigate("/vaccination");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vaccination record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold">Add Vaccination</h1>
        <p className="mt-1 text-sm text-slate-500">Create a record that will appear in the vaccination dashboard.</p>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <input className="rounded-xl border border-slate-200 px-4 py-3" value={petId} onChange={(e) => setPetId(e.target.value)} placeholder="Pet ID" />
          <input className="rounded-xl border border-slate-200 px-4 py-3" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} placeholder="Vaccine name" />
          <input type="date" className="rounded-xl border border-slate-200 px-4 py-3" value={administeredAt} onChange={(e) => setAdministeredAt(e.target.value)} />
          <input type="date" className="rounded-xl border border-slate-200 px-4 py-3" value={nextDueAt} onChange={(e) => setNextDueAt(e.target.value)} />
          <input className="rounded-xl border border-slate-200 px-4 py-3" value={administeredBy} onChange={(e) => setAdministeredBy(e.target.value)} placeholder="Administered by" />
          <input className="rounded-xl border border-slate-200 px-4 py-3" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Batch number" />
          <textarea className="min-h-28 rounded-xl border border-slate-200 px-4 py-3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="button" className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700" onClick={() => navigate("/vaccination")}>Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Vaccination"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
