import "server-only";
import { randomUUID } from "node:crypto";
import { availability } from "@/config/availability";
import { getSessionType } from "@/config/sessions";
import { l, t } from "@/content";
import type { BookingInput } from "@/lib/booking-schema";
import { toE164 } from "@/lib/booking-schema";
import type { BookingSummary } from "@/lib/booking-types";
import { getAvailableSlots } from "./availability";
import { getCalendar } from "./calendar";
import { withLock } from "./rate-limit";
import type { BookingWebhookPayload } from "./webhook";

export class SlotTakenError extends Error {
  constructor() {
    super("SLOT_TAKEN");
  }
}

const labelOf = (opts: { value: string; label: string }[], v?: string) =>
  opts.find((o) => o.value === v)?.label ?? v ?? "";

/** Human-readable fields, in display order (used in the event description + webhook). */
function describe(input: BookingInput, phone: string) {
  const L = t.eventLabels;
  const rows: [string, string, string][] = [
    ["sessionType", L.sessionType, l(getSessionType(input.sessionType)!.title)],
    ["fullName", L.fullName, input.fullName],
    ["jobTitle", L.jobTitle, input.jobTitle],
    ["email", L.email, input.email],
    ["phone", L.phone, phone],
  ];
  if (input.sessionType === "org-intro") {
    rows.push(
      ["organization", L.organization, input.organization],
      ["sector", L.sector, labelOf(t.form.sectors, input.sector)],
      ["employees", L.employees, labelOf(t.form.employeeRanges, input.employees)],
      ["solution", L.solution, labelOf(t.form.solutions, input.solution)],
    );
  } else {
    rows.push(["path", L.path, labelOf(t.form.paths, input.path)]);
  }
  if (input.notes) rows.push(["notes", L.notes, input.notes]);
  if (input.timeZone) rows.push(["timeZone", L.timeZone, input.timeZone]);
  return rows;
}

export async function createBooking(
  input: BookingInput,
): Promise<{ summary: BookingSummary; webhook: BookingWebhookPayload }> {
  const session = getSessionType(input.sessionType);
  if (!session) throw new Error("inactive session type");
  const phone = toE164(input.countryCode, input.phone)!;
  const start = new Date(input.start);

  return withLock(start.toISOString(), async () => {
    // Re-check right before inserting: the requested start must still be a generated slot,
    // which re-applies working hours, notice, horizon, buffers, daily cap AND live free/busy.
    const slots = await getAvailableSlots(session);
    const slot = slots.find((s) => s.start === start.toISOString());
    if (!slot) throw new SlotTakenError();

    const rows = describe(input, phone);
    const organization = input.sessionType === "org-intro" ? input.organization : undefined;
    const summary = `${l(session.title)} — ${input.fullName}${organization ? ` (${organization})` : ""}`;
    const description = [
      ...rows.map(([, label, value]) => `${label}: ${value}`),
      "",
      `— ${t.eventLabels.bookedVia}`,
    ].join("\n");

    const event = await getCalendar().insertEvent({
      summary,
      description,
      start,
      end: new Date(slot.end),
      timeZone: availability.timeZone,
      attendee: { email: input.email, displayName: input.fullName },
      colorId: session.colorId,
      privateProps: { hcBooking: "1", sessionType: session.id },
      requestId: randomUUID(),
    });

    return {
      summary: {
        id: event.id,
        sessionType: session.id,
        start: slot.start,
        end: slot.end,
        meetLink: event.meetLink,
        fullName: input.fullName,
        email: input.email,
        organization,
      },
      webhook: {
        event: "booking.created",
        bookingId: event.id,
        createdAt: new Date().toISOString(),
        sessionType: session.id,
        sessionTitle: l(session.title),
        start: slot.start,
        end: slot.end,
        timeZone: availability.timeZone,
        meetLink: event.meetLink,
        client: Object.fromEntries(rows.map(([key, , value]) => [key, value])),
      },
    };
  });
}
