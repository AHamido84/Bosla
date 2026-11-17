"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { getSessionType } from "@/config/sessions";
import { l, t } from "@/content";
import { BOOKING_STORAGE_KEY, type BookingSummary } from "@/lib/booking-types";
import { formatLongDate, formatTime, sameOffset, timeZoneLabel, visitorTimeZone } from "@/lib/format";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { Accent } from "./Accent";
import { ConsultantCard } from "./ConsultantCard";

const noopSubscribe = () => () => {};
function readStoredBooking(): string | null {
  try {
    return sessionStorage.getItem(BOOKING_STORAGE_KEY);
  } catch {
    return null;
  }
}

type State = { status: "loading" } | { status: "empty" } | { status: "ready"; booking: BookingSummary; tz: string };

export function ConfirmedView() {
  // undefined = prerender (show skeleton); null = no booking in this tab.
  const raw = useSyncExternalStore(noopSubscribe, readStoredBooking, () => undefined);
  const state = useMemo<State>(() => {
    if (raw === undefined) return { status: "loading" };
    try {
      const booking = raw ? (JSON.parse(raw) as BookingSummary) : null;
      return booking ? { status: "ready", booking, tz: visitorTimeZone() } : { status: "empty" };
    } catch {
      return { status: "empty" };
    }
  }, [raw]);

  if (state.status === "loading") {
    return (
      <div className="animate-pulse space-y-4 py-10" role="status">
        <span className="sr-only">…</span>
        <div className="h-12 w-2/3 rounded-full bg-line/70" />
        <div className="h-5 w-1/2 rounded-full bg-line/50" />
        <div className="h-64 rounded-card bg-line/40" />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="py-12 text-center sm:py-20">
        <Image src="/images/chairs.webp" alt="" width={372} height={324} sizes="180px" className="mx-auto h-36 w-auto" />
        <h1 className="h-section mt-6">{t.confirmed.emptyHeading}</h1>
        <p className="mx-auto mt-3 max-w-md text-ink/80">{t.confirmed.emptyBody}</p>
        <Link href="/" className="btn-primary mt-8">
          {t.confirmed.emptyCta}
        </Link>
      </div>
    );
  }

  const { booking: b, tz } = state;
  const session = getSessionType(b.sessionType);
  const title = session ? l(session.title) : "";
  const minutes = Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60000);
  const riyadh = "Asia/Riyadh";
  const differs = !sameOffset(tz, riyadh, new Date(b.start));

  const rows: [string, React.ReactNode][] = [
    [t.confirmed.session, title],
    [t.confirmed.date, formatLongDate(b.start, tz)],
    [
      t.confirmed.time,
      <span key="time" className="tabular">
        {formatTime(b.start, tz)} – {formatTime(b.end, tz)}{" "}
        <span className="text-sm text-ink/70">
          (<bdi dir="ltr">{timeZoneLabel(tz)}</bdi>)
        </span>
        {differs && (
          <span className="block text-sm text-ink/70">
            {t.calendar.riyadhTime(`${formatTime(b.start, riyadh)} – ${formatTime(b.end, riyadh)}`)}
          </span>
        )}
      </span>,
    ],
    [t.confirmed.duration, t.sessionPicker.minutes(minutes)],
    [t.confirmed.name, b.fullName],
    ...(b.organization ? ([[t.confirmed.organization, b.organization]] as [string, string][]) : []),
  ];

  const onIcs = () =>
    downloadIcs(
      "human-compass-meeting.ics",
      buildIcs({
        uid: b.id,
        start: b.start,
        end: b.end,
        title: `${title} — ${t.brandName}`,
        description: [t.confirmed.icsDescription, b.meetLink ? `${t.confirmed.meetLink}: ${b.meetLink}` : ""].filter(Boolean).join("\n"),
        url: b.meetLink,
      }),
    );

  return (
    <div className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_22rem] lg:gap-14">
      <div className="animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-emerald text-cream" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-6">
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <Accent as="h1" text={t.confirmed.headline} className="h-display mt-5" />
        <p className="mt-3 text-lg text-ink/85">
          {t.confirmed.sublineBefore}{" "}
          <bdi dir="ltr" className="font-medium">
            {b.email}
          </bdi>{" "}
          {t.confirmed.sublineAfter}
        </p>

        <section aria-labelledby="summary" className="mt-8 rounded-card border border-ink bg-white p-5 sm:p-8">
          <h2 id="summary" className="text-lg font-bold text-ink">
            {t.confirmed.summaryHeading}
          </h2>
          <hr className="my-4 border-ink" />
          <dl className="divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
                <dt className="text-sm text-ink/70">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
            <div className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm text-ink/70">{t.confirmed.meetLink}</dt>
              <dd>
                {b.meetLink ? (
                  <a href={b.meetLink} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-copper-600 underline underline-offset-4 hover:text-copper-700" dir="ltr">
                    {b.meetLink}
                  </a>
                ) : (
                  <span className="text-ink/80">{t.confirmed.meetPending}</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {b.meetLink && (
              <a href={b.meetLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
                {t.confirmed.joinMeet}
              </a>
            )}
            <button type="button" onClick={onIcs} className="btn-secondary">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {t.confirmed.addToCalendar}
            </button>
          </div>
        </section>

        <Link href="/" className="mt-8 inline-block text-sm font-medium text-copper-600 underline underline-offset-4 hover:text-copper-700">
          {t.confirmed.backHome}
        </Link>
      </div>

      <aside className="space-y-6">
        <Image src="/images/chairs.webp" alt="" width={372} height={324} sizes="(min-width: 1024px) 352px, 60vw" className="mx-auto h-auto w-3/5 lg:w-full" priority />
        <ConsultantCard heading={t.confirmed.consultantHeading} />
      </aside>
    </div>
  );
}
