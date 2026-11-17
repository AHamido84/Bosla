import type { SessionTypeId } from "@/config/sessions";
import type { Slot } from "./slots";

/** What the client keeps after a successful booking (sessionStorage → /confirmed). */
export interface BookingSummary {
  id: string;
  sessionType: SessionTypeId;
  start: string;
  end: string;
  meetLink: string | null;
  fullName: string;
  email: string;
  organization?: string;
}

export interface AvailabilityResponse {
  sessionType: SessionTypeId;
  durationMinutes: number;
  companyTimeZone: string;
  generatedAt: string;
  slots: Slot[];
}

export type BookingErrorCode = "SLOT_TAKEN" | "INVALID" | "RATE_LIMITED" | "UNAVAILABLE";

export interface BookingErrorResponse {
  error: BookingErrorCode;
  fields?: Record<string, string>;
}

export const BOOKING_STORAGE_KEY = "hc:lastBooking";
