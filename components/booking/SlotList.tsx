"use client";

import { t } from "@/content";
import { formatDayTitle, formatTime, sameOffset } from "@/lib/format";
import type { Slot } from "@/lib/slots";

interface Props {
  dayKey: string | null;
  slots: Slot[];
  selected: string | null;
  onSelect: (slot: Slot) => void;
  visitorTz: string;
  companyTz: string;
}

export function SlotList({ dayKey, slots, selected, onSelect, visitorTz, companyTz }: Props) {
  if (!dayKey) {
    return <p className="rounded-card border border-dashed border-line p-6 text-center text-ink/75">{t.calendar.pickDayFirst}</p>;
  }
  if (!slots.length) {
    return (
      <p role="status" className="rounded-card border border-dashed border-line p-6 text-center text-ink/75">
        {t.calendar.noSlotsDay}
      </p>
    );
  }
  const heading = t.calendar.slotsFor(formatDayTitle(slots[0].start, visitorTz));
  return (
    <div>
      <h3 id="slots-heading" className="mb-3 font-bold text-ink">
        {heading}
      </h3>
      <ul aria-labelledby="slots-heading" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((s) => {
          const isSel = s.start === selected;
          const local = formatTime(s.start, visitorTz);
          const differs = !sameOffset(visitorTz, companyTz, new Date(s.start));
          const riyadh = formatTime(s.start, companyTz);
          return (
            <li key={s.start}>
              <button
                type="button"
                aria-pressed={isSel}
                onClick={() => onSelect(s)}
                className={[
                  "tabular flex min-h-12 w-full flex-col items-center justify-center rounded-full border px-3 py-1.5 transition-colors",
                  isSel
                    ? "border-emerald bg-emerald text-cream"
                    : "border-line bg-white text-ink hover:border-emerald hover:text-emerald",
                ].join(" ")}
              >
                <span className="font-semibold">{local}</span>
                {differs && (
                  <span className={`text-[11px] leading-tight ${isSel ? "text-cream/85" : "text-ink/70"}`}>
                    {t.calendar.riyadhTime(riyadh)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
