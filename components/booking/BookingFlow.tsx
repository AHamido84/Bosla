"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { activeSessionTypes, DEFAULT_SESSION_TYPE, getSessionType, type SessionTypeId } from "@/config/sessions";
import { whatsappLink } from "@/config/site";
import { l, t } from "@/content";
import { COUNTRY_CODES, validateBooking } from "@/lib/booking-schema";
import {
  BOOKING_STORAGE_KEY,
  type AvailabilityResponse,
  type BookingErrorResponse,
  type BookingSummary,
} from "@/lib/booking-types";
import { formatLongDate, formatTime, sameOffset, timeZoneLabel, visitorTimeZone } from "@/lib/format";
import type { Slot } from "@/lib/slots";
import { addDaysToKey, dateKey } from "@/lib/time";
import { Accent } from "../Accent";
import { FieldError, ChoiceField, TextAreaField, TextField } from "./fields";
import { MonthCalendar } from "./MonthCalendar";
import { SessionPicker } from "./SessionPicker";
import { SlotList } from "./SlotList";

type LoadState = "loading" | "ready" | "error";

const noopSubscribe = () => () => {};
const fetchSlots = (type: SessionTypeId) =>
  fetch(`/api/availability?sessionType=${type}`, { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error(String(res.status));
    return res.json() as Promise<AvailabilityResponse>;
  });
const omit = (o: Record<string, string>, key: string) => {
  const next = { ...o };
  delete next[key];
  return next;
};

const emptyForm = {
  fullName: "",
  jobTitle: "",
  email: "",
  countryCode: "+966",
  phone: "",
  organization: "",
  sector: "",
  employees: "",
  solution: "",
  path: "",
  notes: "",
  consent: false,
  website: "",
};
type FormState = typeof emptyForm;

const FIELD_ORDER = [
  "start",
  "fullName",
  "jobTitle",
  "email",
  "phone",
  "organization",
  "sector",
  "employees",
  "solution",
  "path",
  "notes",
  "consent",
];

export function BookingFlow() {
  const router = useRouter();
  const activeTypes = activeSessionTypes();
  const showPicker = activeTypes.length > 1;
  const [sessionType, setSessionType] = useState<SessionTypeId>(
    activeTypes.some((s) => s.id === DEFAULT_SESSION_TYPE) ? DEFAULT_SESSION_TYPE : activeTypes[0].id,
  );
  // Browser-only values: null during prerender, real values after hydration.
  const visitorTz = useSyncExternalStore(noopSubscribe, visitorTimeZone, () => null);
  const today = useSyncExternalStore(
    noopSubscribe,
    () => dateKey(new Date(), visitorTimeZone()),
    () => null,
  );
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [pickedDay, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const reqId = useRef(0);


  /** Fetches slots. Callers set state("loading") first when re-loading from an event. */
  const load = useCallback((type: SessionTypeId, keepSelection = false) => {
    const id = ++reqId.current;
    return fetchSlots(type).then(
      (json) => {
        if (id !== reqId.current) return;
        setData(json);
        setState("ready");
        if (!keepSelection) setSlot(null);
      },
      () => {
        if (id === reqId.current) setState("error");
      },
    );
  }, []);

  useEffect(() => {
    load(sessionType);
  }, [sessionType, load]);

  const tz = visitorTz ?? data?.companyTimeZone ?? "Asia/Riyadh";
  const companyTz = data?.companyTimeZone ?? "Asia/Riyadh";

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of data?.slots ?? []) {
      const k = dateKey(new Date(s.start), tz);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [data, tz]);
  const availableDays = useMemo(() => new Set(byDay.keys()), [byDay]);

  // The picked day stays selected while it still has slots; otherwise fall back to the first available day.
  const day = pickedDay && availableDays.has(pickedDay) ? pickedDay : ([...availableDays].sort()[0] ?? null);

  const firstDay = data?.slots.length ? dateKey(new Date(data.slots[0].start), tz) : null;
  const minKey = today ?? firstDay ?? "1970-01-01";
  const lastDay = data?.slots.length
    ? dateKey(new Date(data.slots[data.slots.length - 1].start), tz)
    : addDaysToKey(minKey, 21);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as string]) setErrors((e) => omit(e, k as string));
  };

  const onSessionChange = (id: SessionTypeId) => {
    setState("loading");
    setSessionType(id);
    setSlot(null);
    setDay(null);
    setErrors({});
    setBanner(null);
  };

  const focusFirstError = (errs: Record<string, string>) => {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (!first) return;
    if (first === "start") {
      calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const el = formRef.current?.querySelector<HTMLElement>(`#${first}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    const payload = {
      sessionType,
      start: slot?.start,
      ...form,
      consent: form.consent ? true : undefined,
      timeZone: tz,
    };
    const parsed = validateBooking(payload);
    if (!parsed.success) {
      const errs = parsed.errors;
      setErrors(errs);
      setBanner({ tone: "error", text: t.form.errorSummary });
      focusFirstError(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 201) {
        const { booking } = (await res.json()) as { booking: BookingSummary };
        try {
          sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(booking));
        } catch {}
        router.push("/confirmed");
        return;
      }
      const body = (await res.json().catch(() => ({ error: "UNAVAILABLE" }))) as BookingErrorResponse;
      if (body.error === "SLOT_TAKEN") {
        setSlot(null);
        setBanner({ tone: "error", text: t.errors.slotTaken });
        setState("loading");
        await load(sessionType);
        calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (body.error === "INVALID" && body.fields) {
        setErrors(body.fields);
        setBanner({ tone: "error", text: t.errors.invalid });
        focusFirstError(body.fields);
      } else if (body.error === "RATE_LIMITED") {
        setBanner({ tone: "error", text: t.errors.rateLimited });
      } else {
        setBanner({ tone: "error", text: t.errors.unavailable });
      }
    } catch {
      setBanner({ tone: "error", text: t.errors.network });
    } finally {
      setSubmitting(false);
    }
  }

  const session = getSessionType(sessionType)!;
  const daySlots = day ? (byDay.get(day) ?? []) : [];
  const showRiyadhNote =
    visitorTz && data?.slots[0] ? !sameOffset(visitorTz, companyTz, new Date(data.slots[0].start)) : false;

  return (
    <div className="space-y-14 sm:space-y-20">
      {/* 1 — Session type (only when more than one type is active in config/sessions.ts) */}
      {showPicker && (
        <section aria-labelledby="session-heading">
          <Accent as="h2" id="session-heading" text={t.sessionPicker.heading} className="h-section mb-6" />
          <SessionPicker value={sessionType} onChange={onSessionChange} />
        </section>
      )}

      {/* 2 — Calendar + slots */}
      <section aria-labelledby="calendar-heading" ref={calendarRef} className="scroll-mt-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <Accent as="h2" id="calendar-heading" text={t.calendar.heading} className="h-section" />
            <p className="mt-2 text-ink/80">{t.calendar.subline}</p>
          </div>
          <Image src="/images/calendar.webp" alt="" width={382} height={324} sizes="112px" className="hidden h-24 w-auto sm:block" />
        </div>

        {visitorTz && (
          <p className="mb-4 inline-flex flex-wrap items-center gap-x-2 rounded-full bg-white px-4 py-1.5 text-sm text-ink ring-1 ring-line">
            <svg viewBox="0 0 20 20" className="size-4 text-emerald" aria-hidden="true">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 5.5V10l3 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>
              {t.calendar.timesShownIn}{" "}
              <bdi dir="ltr" className="font-medium">
                {timeZoneLabel(visitorTz)}
              </bdi>
            </span>
            {showRiyadhNote && (
              <span className="text-ink/70">
                · {t.calendar.riyadhLabel} <bdi dir="ltr">{timeZoneLabel(companyTz)}</bdi>
              </span>
            )}
          </p>
        )}

        {banner?.text === t.errors.slotTaken && (
          <div role="alert" className="mb-4 rounded-field border border-danger/40 bg-danger/5 px-4 py-3 text-danger">
            {banner.text}
          </div>
        )}

        {state === "loading" && !data ? (
          <CalendarSkeleton />
        ) : state === "error" ? (
          <div role="alert" className="rounded-card border border-line bg-white p-8 text-center">
            <p className="text-ink">{t.calendar.error}</p>
            <button
              type="button"
              onClick={() => {
                setState("loading");
                load(sessionType);
              }}
              className="btn-secondary mt-4"
            >
              {t.calendar.retry}
            </button>
          </div>
        ) : data && data.slots.length === 0 ? (
          <div role="status" className="rounded-card border border-line bg-white p-8 text-center">
            <p className="text-ink">{t.calendar.noSlotsAtAll}</p>
            <a href={whatsappLink(t.whatsapp.prefill)} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4">
              {t.whatsapp.label}
            </a>
          </div>
        ) : (
          <div className={`grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] ${state === "loading" ? "opacity-60" : ""}`} aria-busy={state === "loading"}>
            <MonthCalendar
              key={sessionType}
              availableDays={availableDays}
              selected={day}
              onSelect={(k) => {
                setDay(k);
                setSlot(null);
              }}
              minKey={minKey < (firstDay ?? minKey) ? minKey : (firstDay ?? minKey)}
              maxKey={lastDay}
              timeZone={visitorTz ? timeZoneLabel(visitorTz) : ""}
            />
            <div aria-live="polite">
              <SlotList
                dayKey={day}
                slots={daySlots}
                selected={slot?.start ?? null}
                onSelect={(s) => {
                  setSlot(s);
                  setErrors((e) => omit(e, "start"));
                  setBanner(null);
                }}
                visitorTz={tz}
                companyTz={companyTz}
              />
              <FieldError id="start-error" message={errors.start} />
            </div>
          </div>
        )}
      </section>

      {/* 3 — Registration form */}
      <section aria-labelledby="form-heading">
        <Accent as="h2" id="form-heading" text={t.form.heading} className="h-section" />
        <p className="mt-2 text-ink/80">{t.form.subline}</p>

        <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6 rounded-card border border-ink bg-white p-5 sm:p-8">
          {/* Selected slot summary */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-field bg-cream px-4 py-3">
            <div>
              <p className="text-xs text-ink/70">{t.form.selectedSlot}</p>
              {slot ? (
                <p className="tabular font-semibold text-emerald">
                  {l(session.title)} · {formatLongDate(slot.start, tz)} · {formatTime(slot.start, tz)}
                  {!sameOffset(tz, companyTz, new Date(slot.start)) && (
                    <span className="ms-1 text-sm font-normal text-ink/70">({t.calendar.riyadhTime(formatTime(slot.start, companyTz))})</span>
                  )}
                </p>
              ) : (
                <p className="text-ink/75">{t.form.noSlotSelected}</p>
              )}
            </div>
            {slot && (
              <button
                type="button"
                className="text-sm font-medium text-copper-600 underline underline-offset-4 hover:text-copper-700"
                onClick={() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                {t.form.changeSlot}
              </button>
            )}
          </div>

          {banner && banner.text !== t.errors.slotTaken && (
            <div role="alert" className="mb-6 rounded-field border border-danger/40 bg-danger/5 px-4 py-3 text-danger">
              {banner.text}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField name="fullName" label={t.form.fields.fullName} autoComplete="name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} />
            <TextField name="jobTitle" label={t.form.fields.jobTitle} autoComplete="organization-title" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} error={errors.jobTitle} />
            <TextField
              name="email"
              type="email"
              dir="ltr"
              inputMode="email"
              autoComplete="email"
              label={t.form.fields.email}
              hint={t.form.hints.email}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              error={errors.email}
              className="field text-end"
            />
            <div>
              <label htmlFor="phone" className="label">
                {t.form.fields.phone}
                <span className="ms-0.5 text-copper-600" aria-hidden="true">*</span>
              </label>
              <div className="flex gap-2" dir="ltr">
                <label htmlFor="countryCode" className="sr-only">
                  {t.form.fields.countryCode}
                </label>
                <select
                  id="countryCode"
                  name="countryCode"
                  autoComplete="tel-country-code"
                  value={form.countryCode}
                  onChange={(e) => set("countryCode", e.target.value)}
                  className="field w-28 shrink-0 px-3"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} {c.flag}
                    </option>
                  ))}
                </select>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder={form.countryCode === "+966" ? "5X XXX XXXX" : ""}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-required
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  className="field tabular"
                />
              </div>
              <FieldError id="phone-error" message={errors.phone} />
            </div>

            {sessionType === "org-intro" ? (
              <>
                <div className="sm:col-span-2">
                  <TextField name="organization" label={t.form.fields.organization} autoComplete="organization" value={form.organization} onChange={(e) => set("organization", e.target.value)} error={errors.organization} />
                </div>
                <div className="sm:col-span-2">
                  <ChoiceField name="sector" legend={t.form.fields.sector} options={t.form.sectors} value={form.sector as never} onChange={(v) => set("sector", v)} error={errors.sector} />
                </div>
                <div className="sm:col-span-2">
                  <ChoiceField name="employees" legend={t.form.fields.employees} options={t.form.employeeRanges} value={form.employees as never} onChange={(v) => set("employees", v)} error={errors.employees} />
                </div>
                <div className="sm:col-span-2">
                  <ChoiceField name="solution" layout="tiles" legend={t.form.fields.solution} options={t.form.solutions} value={form.solution as never} onChange={(v) => set("solution", v)} error={errors.solution} />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <ChoiceField name="path" legend={t.form.fields.path} options={t.form.paths} value={form.path as never} onChange={(v) => set("path", v)} error={errors.path} />
              </div>
            )}

            <div className="sm:col-span-2">
              <TextAreaField name="notes" label={t.form.fields.notes} placeholder={t.form.fields.notesPlaceholder} maxLength={1000} value={form.notes} onChange={(e) => set("notes", e.target.value)} error={errors.notes} />
            </div>

            {/* Honeypot — hidden from people and assistive tech */}
            <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="website">{t.form.fields.honeypot}</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3 text-[15px] text-ink">
                <input
                  id="consent"
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? "consent-error" : undefined}
                  className="mt-1 size-5 shrink-0 accent-emerald"
                />
                <span>
                  {t.form.consentBefore}
                  <Link href="/privacy" target="_blank" className="font-medium text-copper-600 underline underline-offset-4 hover:text-copper-700">
                    {t.form.consentLink}
                  </Link>
                  {t.form.consentAfter}
                </span>
              </label>
              <FieldError id="consent-error" message={errors.consent} />
            </div>
          </div>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <button type="submit" className="btn-primary text-lg" disabled={submitting} aria-busy={submitting}>
              {submitting && (
                <svg viewBox="0 0 24 24" className="size-5 animate-spin" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {submitting ? t.form.submitting : t.form.submit}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]" role="status" aria-live="polite">
      <span className="sr-only">{t.calendar.loading}</span>
      <div className="animate-pulse rounded-card border border-line bg-white p-6">
        <div className="mx-auto mb-6 h-6 w-32 rounded-full bg-line/70" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="aspect-square rounded-full bg-line/40" />
          ))}
        </div>
      </div>
      <div className="grid animate-pulse grid-cols-2 content-start gap-2 sm:grid-cols-3">
        <div className="col-span-full mb-1 h-5 w-48 rounded-full bg-line/70" />
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="h-12 rounded-full bg-line/40" />
        ))}
      </div>
    </div>
  );
}
