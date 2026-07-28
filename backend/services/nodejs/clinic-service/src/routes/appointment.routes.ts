import { Router, type Request } from "express";
import { AppointmentModel, PetAccessGrantModel, TimeSlotModel, grantAccessForAppointment } from "../models/clinic.models";

const SERVICE_KEY = process.env.SERVICE_KEY || "internal-dev-key";

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

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4004";

/**
 * Tell the owner when their appointment changes.
 *
 * Cancelling or moving a booking previously updated the record and released the
 * slot but told nobody, so an owner whose vet became unavailable would still
 * travel to the clinic. Fire-and-forget: notification failure must never fail
 * the appointment change itself.
 */
async function notifyOwner(params: {
  ownerId: string;
  appointmentId: string;
  type: "appointment_cancelled" | "appointment_rescheduled";
  title: string;
  body: string;
}) {
  if (!params.ownerId) return;
  try {
    await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: params.ownerId,
        type: params.type,
        title: params.title,
        body: params.body,
        urgency: "high",
        // One notice per appointment per transition, so a retry cannot spam.
        dedupeKey: `${params.type}:${params.appointmentId}`,
      }),
    });
  } catch (err) {
    console.warn("[clinic-service] owner notification failed", err);
  }
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

/**
 * DELETE /api/appointments/pet/:petId — clean up after a deleted pet.
 *
 * Releases every slot the pet held, removes its appointments, and revokes its
 * access grants. Without this a deleted pet permanently consumes its booked
 * slots (nobody can ever book them again) and leaves veterinarians holding
 * grants to an animal that no longer exists.
 *
 * Service-key guarded - internal cleanup, not a user action.
 */
appointmentRouter.delete("/pet/:petId", async (req, res, next) => {
  try {
    if (req.headers["x-service-key"] !== SERVICE_KEY) {
      return res.status(403).json({ success: false, message: "Service key required" });
    }
    const { petId } = req.params;
    const appointments = await AppointmentModel.find({ petId }).lean();

    // Release slots first so they return to the pool even if a later step fails.
    for (const appointment of appointments) {
      await releaseSlot(appointment.slotId);
    }
    const removed = await AppointmentModel.deleteMany({ petId });
    const grants = await PetAccessGrantModel.deleteMany({ petId });

    res.json({
      success: true,
      data: {
        slotsReleased: appointments.length,
        appointmentsRemoved: removed.deletedCount ?? 0,
        grantsRevoked: grants.deletedCount ?? 0,
      },
    });
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

    const previousStatus = appointment.status;
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

    // Notify only when someone other than the owner made the change - an owner
    // cancelling their own booking does not need telling.
    const changedByStaff = user?.role === "vet" || user?.role === "admin";
    if (changedByStaff && nextStatus === "cancelled" && previousStatus !== "cancelled") {
      await notifyOwner({
        ownerId: appointment.ownerId,
        appointmentId: String(appointment._id),
        type: "appointment_cancelled",
        title: "Appointment cancelled",
        body: "Your veterinary appointment has been cancelled by the clinic. Please book another time slot.",
      });
    } else if (changedByStaff && slotChanged) {
      await notifyOwner({
        ownerId: appointment.ownerId,
        appointmentId: String(appointment._id),
        type: "appointment_rescheduled",
        title: "Appointment rescheduled",
        body: "Your veterinary appointment has been moved by the clinic. Please check the new time in your appointments.",
      });
    }

    res.json({ success: true, data: mapAppointment(appointment.toObject()) });
  } catch (err) {
    next(err);
  }
});
