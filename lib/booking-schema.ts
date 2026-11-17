import { z } from "zod";
import { t } from "@/content";
import type { Content } from "@/content/types";

/** Converts Arabic-Indic / Persian digits to Latin and strips everything else. */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

/** Returns E.164 or null. Saudi numbers must be mobiles: 5XXXXXXXX (leading 0 allowed). */
export function toE164(countryCode: string, phone: string): string | null {
  let digits = normalizeDigits(phone);
  const cc = countryCode.replace(/\D/g, "");
  if (digits.startsWith("00" + cc)) digits = digits.slice(2 + cc.length);
  // Someone pasted the full international number into the local field.
  else if (digits.startsWith(cc) && digits.length >= cc.length + 9) digits = digits.slice(cc.length);
  if (cc === "966") {
    if (digits.startsWith("0")) digits = digits.slice(1);
    return /^5\d{8}$/.test(digits) ? `+966${digits}` : null;
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{6,14}$/.test(digits) ? `+${cc}${digits}` : null;
}

export const COUNTRY_CODES = [
  { code: "+966", label: "السعودية +966", flag: "SA" },
  { code: "+971", label: "الإمارات +971", flag: "AE" },
  { code: "+965", label: "الكويت +965", flag: "KW" },
  { code: "+973", label: "البحرين +973", flag: "BH" },
  { code: "+974", label: "قطر +974", flag: "QA" },
  { code: "+968", label: "عُمان +968", flag: "OM" },
  { code: "+20", label: "مصر +20", flag: "EG" },
  { code: "+962", label: "الأردن +962", flag: "JO" },
  { code: "+44", label: "المملكة المتحدة +44", flag: "GB" },
  { code: "+1", label: "الولايات المتحدة / كندا +1", flag: "US" },
] as const;

export function makeBookingSchema(c: Content = t) {
  const v = c.validation;
  const enumOf = <T extends string>(opts: { value: T }[]) =>
    z.enum(opts.map((o) => o.value) as [T, ...T[]], { errorMap: () => ({ message: v.choose }) });
  const text = (min: number, msg: string, max = 120) =>
    z.string({ required_error: v.required, invalid_type_error: v.required }).trim().min(min, msg).max(max, msg);

  const base = {
    start: z.string({ required_error: v.slot }).datetime({ message: v.slot }),
    fullName: text(2, v.fullName),
    jobTitle: text(2, v.jobTitle),
    email: z
      .string({ required_error: v.email })
      .trim()
      .toLowerCase()
      .max(200, v.email)
      .email(v.email),
    countryCode: z.string().regex(/^\+\d{1,4}$/, v.phone),
    phone: z.string({ required_error: v.phone }).trim().min(1, v.phone).max(24, v.phone),
    notes: z.string().trim().max(1000, v.notesTooLong).optional().default(""),
    consent: z.literal(true, { errorMap: () => ({ message: v.consent }) }),
    /** Honeypot. Real users never see or fill it. */
    website: z.string().max(0).optional().default(""),
    /** Visitor's IANA zone, informational only. */
    timeZone: z.string().max(64).optional().default(""),
  };

  const org = z.object({
    sessionType: z.literal("org-intro"),
    ...base,
    organization: text(2, v.organization, 160),
    sector: enumOf(c.form.sectors),
    employees: enumOf(c.form.employeeRanges),
    solution: enumOf(c.form.solutions),
  });

  const individual = z.object({
    sessionType: z.literal("individual-intro"),
    ...base,
    path: enumOf(c.form.paths),
  });

  return z
    .discriminatedUnion("sessionType", [org, individual], {
      errorMap: () => ({ message: v.sessionType }),
    })
    .superRefine((d, ctx) => {
      if (!toE164(d.countryCode, d.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phone"],
          message: d.countryCode === "+966" ? v.phoneSaudi : v.phone,
        });
      }
    });
}

export type BookingInput = z.infer<ReturnType<typeof makeBookingSchema>>;

/**
 * Validates a booking payload. Unlike schema.safeParse alone, the phone check
 * (which depends on the country code) always runs, so every field error shows at once.
 */
export function validateBooking(
  payload: unknown,
  c: Content = t,
): { success: true; data: BookingInput } | { success: false; errors: Record<string, string> } {
  const parsed = makeBookingSchema(c).safeParse(payload);
  if (parsed.success) return { success: true, data: parsed.data };
  const errors = fieldErrors(parsed.error);
  const p = (payload ?? {}) as { countryCode?: unknown; phone?: unknown };
  if (!errors.phone && typeof p.phone === "string" && p.phone.trim() && typeof p.countryCode === "string") {
    if (!toE164(p.countryCode, p.phone)) {
      errors.phone = p.countryCode === "+966" ? c.validation.phoneSaudi : c.validation.phone;
    }
  }
  return { success: false, errors };
}

/** Flattens zod issues into { field: firstMessage }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
