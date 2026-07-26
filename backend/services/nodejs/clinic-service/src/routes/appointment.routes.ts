import { Router, type Request } from "express";
import { AppointmentModel, TimeSlotModel, grantAccessForAppointment } from "../models/clinic.models";

export const appointmentRouter = Router();

// Identity headers stamped by the api-gateway from a verified JWT
function identity(req: Request): { uid: string; role: string } | null {
  const uid = req.headers["x-user-id"];
  const role = req.headers["x-user-role"];
  if (typeof uid === "string" && uid) {
    return { uid, role: typeof role === "string" ? role : "owner" };
  }
  return null;
}

function mapAppointment(appointment: any) {
  return {
    id: appointment._id.toString(),
    ownerId: appointment.ownerId,
    petId: appointment.petId,
    clinicId: appointment.clinicId,
    surgeonId: appointment.surgeonId,
    slotId: appointment.slotId,
    status: appointment.status,
    notes: appointment.notes,
    createdAt: appointment.createdAt,
  };
}

async function releaseSlot(slotId: string | undefined) {
  if (!slotId) return;
  const slot = await TimeSlotModel.findById(slotId);
  if (!slot) return;
  slot.isBooked = false;
  await slot.save();
}

async function bookSlot(slotId: string) {
  const slot = await TimeSlotModel.findById(slotId);
  if (!slot) {
    throw new Error("Time slot not found");
  }
  if (slot.isBooked) {
    throw new Error("Time slot already booked");
  }
  slot.isBooked = true;
  await slot.save();
}

appointmentRouter.get("/", async (req, res, next) => {
  try {
    const filter: Record<string, string> = {};
    if (req.query.ownerId) filter.ownerId = String(req.query.ownerId);
    if (req.query.clinicId) filter.clinicId = String(req.query.clinicId);
    if (req.query.petId) filter.petId = String(req.query.petId);

    // Owners can only see their own appointments
    const user = identity(req);
    if (user?.role === "owner") filter.ownerId = user.uid;

    const appointments = await AppointmentModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: appointments.map(mapAppointment) });
  } catch (err) {
    next(err);
  }
});

appointmentRouter.post("/", async (req, res, next) => {
  try {
    try {
      await bookSlot(String(req.body.slotId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to book slot";
      return res.status(message === "Time slot not found" ? 404 : 400).json({ success: false, message });
    }

    const user = identity(req);
    const appointment = await AppointmentModel.create({
      ownerId: user?.role === "owner" ? user.uid : req.body.ownerId,
      petId: req.body.petId,
      clinicId: req.body.clinicId,
      surgeonId: req.body.surgeonId,
      slotId: req.body.slotId,
      status: req.body.status || "pending",
      notes: req.body.notes || "",
    });

    // Booking is what establishes the vet↔pet relationship. Failing to record
    // it must not fail the booking itself — the appointment is the source of
    // truth and the grant can be rebuilt from it.
    await grantAccessForAppointment({
      petId: appointment.petId,
      ownerId: appointment.ownerId,
      surgeonId: appointment.surgeonId,
      appointmentId: String(appointment._id),
    }).catch((err) => console.warn("[clinic-service] access grant failed", err));

    res.status(201).json({ success: true, data: mapAppointment(appointment) });
  } catch (err) {
    next(err);
  }
});

appointmentRouter.patch("/:appointmentId", async (req, res, next) => {
  try {
    const appointment = await AppointmentModel.findById(req.params.appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    const user = identity(req);
    if (user?.role === "owner" && appointment.ownerId !== user.uid) {
      return res.status(403).json({ success: false, message: "You can only modify your own appointments" });
    }

    const nextSlotId = req.body.slotId ? String(req.body.slotId) : appointment.slotId;
    const nextStatus = req.body.status || appointment.status;
    const slotChanged = nextSlotId !== appointment.slotId;

    if (slotChanged) {
      await releaseSlot(appointment.slotId);
      try {
        await bookSlot(nextSlotId);
      } catch (error) {
        await bookSlot(appointment.slotId).catch(() => undefined);
        const message = error instanceof Error ? error.message : "Unable to update slot";
        return res.status(message === "Time slot not found" ? 404 : 400).json({ success: false, message });
      }
    } else if (nextStatus === "cancelled") {
      await releaseSlot(appointment.slotId);
    } else {
      const currentSlot = await TimeSlotModel.findById(appointment.slotId);
      if (currentSlot && !currentSlot.isBooked) {
        currentSlot.isBooked = true;
        await currentSlot.save();
      }
    }

    if (req.body.ownerId !== undefined) appointment.ownerId = String(req.body.ownerId);
    if (req.body.petId !== undefined) appointment.petId = String(req.body.petId);
    if (req.body.clinicId !== undefined) appointment.clinicId = String(req.body.clinicId);
    if (req.body.surgeonId !== undefined) appointment.surgeonId = String(req.body.surgeonId);
    appointment.slotId = nextSlotId;
    appointment.status = nextStatus;
    if (req.body.notes !== undefined) appointment.notes = String(req.body.notes);

    await appointment.save();
    res.json({ success: true, data: mapAppointment(appointment.toObject()) });
  } catch (err) {
    next(err);
  }
});
