import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { PetSex, PetSpecies } from "@companion-ai/shared-types";
import { createPet, getOwnerId } from "../lib/api";

type PetFormState = {
  name: string;
  species: PetSpecies;
  breed: string;
  ageYears: number;
  weightKg: number;
  sex: PetSex;
  neutered: boolean;
  photoURL: string;
};

export function AddPetPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<PetFormState>({
    name: "",
    species: "dog",
    breed: "",
    ageYears: 1,
    weightKg: 1,
    sex: "male",
    neutered: false,
    photoURL: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const pet = await createPet({ ownerId: getOwnerId(), ...form });
      navigate(`/pets/${pet.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pet");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Pet Profile</p>
            <h1 className="text-3xl font-semibold text-slate-900">Add New Pet</h1>
          </div>
          <button type="button" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => navigate("/pets")}>Back</button>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-600">Pet Name</span>
            <input className="rounded-xl border border-slate-200 px-4 py-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-600">Species</span>
            <select className="rounded-xl border border-slate-200 px-4 py-3" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value as PetSpecies })}>
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-600">Breed</span>
            <input className="rounded-xl border border-slate-200 px-4 py-3" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} required />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-600">Age (Years)</span>
            <input type="number" min="0" className="rounded-xl border border-slate-200 px-4 py-3" value={form.ageYears} onChange={(e) => setForm({ ...form, ageYears: Number(e.target.value) })} required />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-600">Weight (Kg)</span>
            <input type="number" min="0" step="0.1" className="rounded-xl border border-slate-200 px-4 py-3" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: Number(e.target.value) })} required />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-600">Sex</span>
            <select className="rounded-xl border border-slate-200 px-4 py-3" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as PetSex })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          <label className="flex items-center gap-3 md:col-span-2">
            <input type="checkbox" checked={form.neutered} onChange={(e) => setForm({ ...form, neutered: e.target.checked })} />
            <span className="text-sm font-medium text-slate-600">Neutered</span>
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-600">Photo URL</span>
            <input className="rounded-xl border border-slate-200 px-4 py-3" value={form.photoURL} onChange={(e) => setForm({ ...form, photoURL: e.target.value })} placeholder="https://..." />
          </label>

          {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}

          <div className="flex gap-3 md:col-span-2">
            <button disabled={loading} className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-white disabled:opacity-60" type="submit">{loading ? "Saving..." : "Create Pet"}</button>
            <button type="button" className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700" onClick={() => navigate("/pets")}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
