import "server-only";
import { createHmac } from "node:crypto";
import { getEnv } from "./env";

export interface BookingWebhookPayload {
  event: "booking.created";
  bookingId: string;
  createdAt: string;
  sessionType: string;
  sessionTitle: string;
  start: string;
  end: string;
  timeZone: string;
  meetLink: string | null;
  client: Record<string, string>;
}

/**
 * Optional: POSTs the booking JSON to BOOKING_WEBHOOK_URL (e.g. a Make/Zapier hook that
 * writes to monday.com or Google Sheets). Never throws — a failing webhook must not
 * fail a booking that is already on the calendar.
 * If BOOKING_WEBHOOK_SECRET is set, the body is signed: X-Signature: sha256=<hex HMAC>.
 */
export async function sendBookingWebhook(payload: BookingWebhookPayload): Promise<void> {
  const { webhookUrl, webhookSecret } = getEnv();
  if (!webhookUrl) return;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (webhookSecret) {
    headers["x-signature"] = `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[webhook] ${res.status} from booking webhook`);
  } catch (err) {
    console.error("[webhook] delivery failed:", (err as Error).message);
  }
}
