import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Appointment, Pet, VetClinic } from "@companion-ai/shared-types";
import { createAppointment, getClinic, getSurgeon, getOwnerId, listOwnerPets } from "../lib/api";

export function BookingPage() {
  const { clinicId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [clinic, setClinic] = useState<VetClinic | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [selectedSurgeonId, setSelectedSurgeonId] = useState(params.get("surgeonId") || "");
  const [selectedSlotId, setSelectedSlotId] = useState(params.get("slotId") || "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    Promise.all([getClinic(clinicId), listOwnerPets(getOwnerId())])
      .then(async ([clinicData, petData]) => {
        setClinic(clinicData);
        setPets(petData);
        setSelectedPetId(petData[0]?.id || "");
        if (!selectedSurgeonId && clinicData.surgeons[0]) setSelectedSurgeonId(clinicData.surgeons[0].id);
        if (!selectedSlotId && clinicData.surgeons[0]?.availableSlots[0]) setSelectedSlotId(clinicData.surgeons[0].availableSlots[0].id);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clinicId]);

  useEffect(() => {
    if (!clinic || !selectedSurgeonId) return;
    getSurgeon(selectedSurgeonId)
      .then((surgeon: any) => {
        if (!selectedSlotId && surgeon.availableSlots?.[0]) {
          setSelectedSlotId(surgeon.availableSlots[0].id);
        }
      })
      .catch(() => undefined);
  }, [clinic, selectedSurgeonId]);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clinicId || !selectedPetId || !selectedSurgeonId || !selectedSlotId) return;
    setSaving(true);
    setError("");
    try {
      const booking = await createAppointment({
        ownerId: getOwnerId(),
        petId: selectedPetId,
        clinicId,
        surgeonId: selectedSurgeonId,
        slotId: selectedSlotId,
        status: "pending",
        notes,
      });
      setSuccess(booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create appointment");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Loading booking form...</div>;
  if (!clinic) return <div className="p-6 text-red-600">{error || "Clinic not found"}</div>;

  const surgeon = clinic.surgeons.find((item) => item.id === selectedSurgeonId) || clinic.surgeons[0];
  const slots = surgeon?.availableSlots || [];

  return (
    <div className="min-h-full bg-slate-100 px-5 py-6">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Book Appointment</p>
            <h1 className="text-3xl font-semibold text-slate-900">{clinic.name}</h1>
          </div>
          <button className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700" onClick={() => navigate(`/vet-discovery/${clinic.id}`)}>Back</button>
        </div>

        {success ? (
          <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-700">
            <p className="text-2xl font-semibold">Appointment created</p>
            <p className="mt-1">Your appointment request is now pending confirmation.</p>
            <button className="mt-4 rounded-xl bg-green-500 px-4 py-3 font-semibold text-white" onClick={() => navigate(`/vet-discovery/${clinic.id}`)}>Back to Clinic</button>
          </div>
        ) : (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitBooking}>
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-600">Choose Pet</span>
              <select className="rounded-xl border border-slate-200 px-4 py-3" value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)}>
                {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} ({pet.species})</option>)}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-600">Surgeon</span>
              <select className="rounded-xl border border-slate-200 px-4 py-3" value={selectedSurgeonId} onChange={(e) => {
                setSelectedSurgeonId(e.target.value);
                const selected = clinic.surgeons.find((item) => item.id === e.target.value);
                setSelectedSlotId(selected?.availableSlots[0]?.id || "");
              }}>
                {clinic.surgeons.map((item) => <option key={item.id} value={item.id}>{item.name} • {item.specialization}</option>)}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-600">Available Time Slots</span>
              <select className="rounded-xl border border-slate-200 px-4 py-3" value={selectedSlotId} onChange={(e) => setSelectedSlotId(e.target.value)}>
                {slots.map((slot) => <option key={slot.id} value={slot.id} disabled={slot.isBooked}>{new Date(slot.datetime).toLocaleString()} {slot.isBooked ? "(Booked)" : ""}</option>)}
              </select>
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <textarea className="min-h-28 rounded-xl border border-slate-200 px-4 py-3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add reason for visit or symptoms" />
            </label>

            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}

            <div className="flex gap-3 md:col-span-2">
              <button disabled={saving} className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-white disabled:opacity-60" type="submit">{saving ? "Booking..." : "Confirm Booking"}</button>
              <button type="button" className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700" onClick={() => navigate(`/vet-discovery/${clinic.id}`)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
