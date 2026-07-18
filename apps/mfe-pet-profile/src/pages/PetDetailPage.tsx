import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Pet, PetSex, PetSpecies } from "@companion-ai/shared-types";
import { deletePet, getPet, updatePet } from "../lib/api";

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

type PetDetailLocationState = {
  pet?: Pet;
};

export function PetDetailPage() {
  const { petId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialPet = (location.state as PetDetailLocationState | null | undefined)?.pet ?? null;
  const [pet, setPet] = useState<Pet | null>(initialPet);
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!petId) return;
    if (initialPet?.id === petId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getPet(petId)
      .then((data) => {
        setPet(data);
        setForm({
          name: data.name,
          species: data.species,
          breed: data.breed,
          ageYears: data.ageYears,
          weightKg: data.weightKg,
          sex: data.sex,
          neutered: data.neutered,
          photoURL: data.photoURL || "",
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [petId, initialPet]);

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!petId) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updatePet(petId, form);
      setPet(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pet");
    } finally {
      setSaving(false);
    }
  }

  async function removePet() {
    if (!petId) return;
    if (!confirm("Delete this pet profile?")) return;
    await deletePet(petId);
    navigate("/pets");
  }

  if (loading) {
    return <div className="p-6 text-slate-500">Loading pet profile...</div>;
  }

  if (!pet) {
    return <div className="p-6 text-red-600">{error || "Pet not found"}</div>;
  }

  return (
    <div className="min-h-full bg-slate-100 px-5 py-6">
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Pet Profile</p>
              <h1 className="text-3xl font-semibold text-slate-900">{pet.name}</h1>
            </div>
            <button className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => navigate("/pets")}>Back</button>
          </div>

          <div className="mb-6 rounded-2xl bg-slate-50 p-4 text-slate-700">
            <p><strong>Owner ID:</strong> {pet.ownerId}</p>
            <p><strong>Species:</strong> {pet.species}</p>
            <p><strong>Breed:</strong> {pet.breed}</p>
            <p><strong>Age:</strong> {pet.ageYears} years</p>
            <p><strong>Weight:</strong> {pet.weightKg} kg</p>
            <p><strong>Sex:</strong> {pet.sex}</p>
            <p><strong>Neutered:</strong> {pet.neutered ? "Yes" : "No"}</p>
          </div>

          <button className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white" onClick={removePet}>Delete Pet</button>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-semibold text-slate-900">Update Pet Details</h2>
          <form className="grid gap-4" onSubmit={saveChanges}>
            <input className="rounded-xl border border-slate-200 px-4 py-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="rounded-xl border border-slate-200 px-4 py-3" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value as PetSpecies })}>
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
            </select>
            <input className="rounded-xl border border-slate-200 px-4 py-3" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
            <input type="number" className="rounded-xl border border-slate-200 px-4 py-3" value={form.ageYears} onChange={(e) => setForm({ ...form, ageYears: Number(e.target.value) })} />
            <input type="number" step="0.1" className="rounded-xl border border-slate-200 px-4 py-3" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: Number(e.target.value) })} />
            <select className="rounded-xl border border-slate-200 px-4 py-3" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as PetSex })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <label className="flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={form.neutered} onChange={(e) => setForm({ ...form, neutered: e.target.checked })} />
              Neutered
            </label>
            <input className="rounded-xl border border-slate-200 px-4 py-3" value={form.photoURL} onChange={(e) => setForm({ ...form, photoURL: e.target.value })} placeholder="Photo URL" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button disabled={saving} className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-white disabled:opacity-60" type="submit">{saving ? "Saving..." : "Save Changes"}</button>
              <button type="button" className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700" onClick={() => navigate("/pets")}>Cancel</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
