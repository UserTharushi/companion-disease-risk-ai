import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Pet } from "@companion-ai/shared-types";
import { getOwnerId, listPets } from "../lib/api";

export function PetListPage() {
  const navigate = useNavigate();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const storedName = localStorage.getItem("companion_ai_profile_name") || "Pet Owner";
  const firstName = storedName.trim().split(/\s+/)[0] || "Pet Owner";

  function openPetDetails(pet: Pet) {
    navigate(`/pets/${pet.id}`, { state: { pet } });
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPets(getOwnerId())
      .then((items) => {
        if (!active) return;
        setPets(items);
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
  }, []);

  return (
    <div className="min-h-full bg-slate-100">
      <section className="rounded-b-3xl bg-green-500 px-5 pb-7 pt-8 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[20px] leading-7 text-white/90">Welcome back,</p>
            <h1 className="mt-1 text-[42px] font-semibold leading-tight">{firstName}</h1>
          </div>
          <button
            type="button"
            className="rounded-full bg-white/20 px-4 py-3 text-base font-semibold"
            onClick={() => navigate("/pets/add")}
          >
            + Add Pet
          </button>
        </div>
      </section>

      <section className="space-y-6 px-5 pb-28 pt-4">
        <div className="rounded-2xl border-l-4 border-red-500 bg-red-50 p-4 text-red-700">
          <p className="text-[34px] leading-none">⚠️</p>
          <h2 className="mt-2 text-3xl font-medium">Emergency Alert</h2>
          <p className="mt-2 text-xl leading-8">
            Keep checking symptom updates and risk predictions for any urgent cases.
          </p>
          <button className="mt-3 text-xl underline underline-offset-4" type="button" onClick={() => navigate("/vet-discovery")}>Find Nearby Vet</button>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-4xl font-semibold text-slate-900">My Pets</h2>
            <button type="button" className="text-3xl font-medium text-green-500" onClick={() => navigate("/pets/add")}>Add</button>
          </div>

          {loading && <div className="rounded-2xl bg-white p-4 text-slate-500 shadow-sm">Loading pets...</div>}
          {!loading && error && <div className="rounded-2xl bg-red-50 p-4 text-red-700 shadow-sm">{error}</div>}
          {!loading && !error && pets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
              <p className="text-2xl font-medium text-slate-900">No pets yet</p>
              <p className="mt-1 text-lg text-slate-500">Add your first pet profile to get started.</p>
            </div>
          )}

          <div className="space-y-3">
            {pets.map((pet) => (
              <article
                key={pet.id}
                className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                onClick={() => openPetDetails(pet)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">🐾</div>
                  <div>
                    <h3 className="text-2xl font-medium text-slate-900">{pet.name}</h3>
                    <p className="text-xl text-slate-600">{pet.species} • {pet.ageYears} years • {pet.breed}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openPetDetails(pet);
                  }}
                  className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
                >
                  View Details
                </button>
              </article>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-4xl font-semibold text-slate-900">Recent AI Predictions</h2>
          <div className="space-y-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-3xl font-medium text-slate-900">Link symptoms and prediction history</h3>
              <p className="mt-1 text-xl text-slate-600">After the pet profile is created, use the symptom checker to generate predictions and review them here.</p>
            </article>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-4xl font-semibold text-slate-900">Vaccination Reminders</h2>
          <div className="space-y-3">
            <article className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-600">📅</div>
              <div>
                <h3 className="text-3xl font-medium text-slate-900">Sync vaccination records</h3>
                <p className="text-2xl text-slate-700">Vaccination reminders will appear once records are added.</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
