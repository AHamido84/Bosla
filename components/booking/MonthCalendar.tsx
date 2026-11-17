"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { t } from "@/content";
import { formatLongDate, formatMonth } from "@/lib/format";
import { addDaysToKey, weekdayOfKey } from "@/lib/time";

interface Props {
  /** "YYYY-MM-DD" keys (visitor's zone) that have at least one slot. */
  availableDays: Set<string>;
  selected: string | null;
  onSelect: (key: string) => void;
  /** Visitor's "today" and last bookable day, bounding month navigation. */
  minKey: string;
  maxKey: string;
  timeZone: string;
}

const ym = (key: string) => key.slice(0, 7);
const monthKeyAdd = (monthKey: string, delta: number) => {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
};
const daysInMonth = (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export function MonthCalendar({ availableDays, selected, onSelect, minKey, maxKey, timeZone }: Props) {
  const firstAvailable = useMemo(() => [...availableDays].sort()[0], [availableDays]);
  const [month, setMonth] = useState(() => ym(selected ?? firstAvailable ?? minKey));
  const [focusKey, setFocusKey] = useState(() => selected ?? firstAvailable ?? minKey);
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(false);

  // When the selection changes from outside (data loaded, slot taken), show its month.
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (selected) {
      setMonth(ym(selected));
      setFocusKey(selected);
    }
  }

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-key="${focusKey}"]`)?.focus();
  }, [focusKey, month]);

  const canPrev = month > ym(minKey);
  const canNext = month < ym(maxKey);

  const cells = useMemo(() => {
    const first = `${month}-01`;
    const lead = weekdayOfKey(first); // weeks start on Sunday
    const n = daysInMonth(month);
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 0; d < n; d++) out.push(addDaysToKey(first, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const moveFocus = (key: string) => {
    if (key < minKey || key > maxKey) return;
    shouldFocus.current = true;
    setFocusKey(key);
    if (ym(key) !== month) setMonth(ym(key));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, key: string) => {
    const rtl = document.dir === "rtl" || document.documentElement.dir === "rtl";
    const map: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    if (e.key in map) {
      e.preventDefault();
      moveFocus(addDaysToKey(key, map[e.key]));
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(addDaysToKey(key, -weekdayOfKey(key)));
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(addDaysToKey(key, 6 - weekdayOfKey(key)));
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      const target = monthKeyAdd(ym(key), e.key === "PageDown" ? 1 : -1);
      const day = Math.min(Number(key.slice(8)), daysInMonth(target));
      moveFocus(`${target}-${String(day).padStart(2, "0")}`);
    }
  };

  // The roving tab stop must be a day that is visible in this month.
  const tabStop = ym(focusKey) === month ? focusKey : (cells.find((c) => c && availableDays.has(c)) ?? `${month}-01`);

  const [y, m] = month.split("-").map(Number);
  const monthLabel = formatMonth(y, m);

  return (
    <div className="rounded-card border border-ink bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canPrev && setMonth(monthKeyAdd(month, -1))}
          disabled={!canPrev}
          aria-label={t.calendar.prevMonth}
          className="grid size-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-line"
        >
          {/* points to inline-start: "previous" in RTL is → */}
          <svg viewBox="0 0 24 24" className="size-5 rtl:rotate-180" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
        <h3 className="font-display text-xl font-semibold text-ink" aria-live="polite" id="cal-month">
          {monthLabel}
        </h3>
        <button
          type="button"
          onClick={() => canNext && setMonth(monthKeyAdd(month, 1))}
          disabled={!canNext}
          aria-label={t.calendar.nextMonth}
          className="grid size-10 place-items-center rounded-full border border-line text-ink transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-line"
        >
          <svg viewBox="0 0 24 24" className="size-5 rtl:rotate-180" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div role="grid" aria-labelledby="cal-month" ref={gridRef} className="w-full">
        <div role="row" className="grid grid-cols-7 pb-2">
          {t.calendar.weekdaysShort.map((d) => (
            <div role="columnheader" key={d} className="text-center text-xs font-medium text-ink/70">
              {d}
            </div>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, w) => (
          <div role="row" key={w} className="grid grid-cols-7 gap-1">
            {cells.slice(w * 7, w * 7 + 7).map((key, i) => {
              if (!key) return <div role="gridcell" key={`e${i}`} />;
              const available = availableDays.has(key);
              const isSelected = key === selected;
              const inRange = key >= minKey && key <= maxKey;
              const label = `${formatLongDate(`${key}T12:00:00Z`, "UTC")} — ${
                available ? t.calendar.available : t.calendar.unavailable
              }`;
              return (
                <div role="gridcell" key={key} aria-selected={isSelected} className="flex justify-center">
                  <button
                    type="button"
                    data-key={key}
                    tabIndex={key === tabStop ? 0 : -1}
                    aria-disabled={!available}
                    aria-pressed={isSelected}
                    aria-label={label}
                    onKeyDown={(e) => onKeyDown(e, key)}
                    onFocus={() => setFocusKey(key)}
                    onClick={() => available && onSelect(key)}
                    className={[
                      "tabular relative grid aspect-square w-full max-w-12 place-items-center rounded-full text-[15px] transition-colors",
                      isSelected
                        ? "bg-emerald font-semibold text-cream"
                        : available
                          ? "font-semibold text-emerald hover:bg-emerald/10"
                          : "cursor-default text-ink/30",
                      !inRange && !available ? "text-ink/20" : "",
                    ].join(" ")}
                  >
                    {Number(key.slice(8))}
                    {available && !isSelected && (
                      <span aria-hidden="true" className="absolute bottom-1.5 size-1 rounded-full bg-copper" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-ink/75" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-copper" /> {t.calendar.available}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-emerald" /> {t.calendar.selected}
        </span>
        <span className="ms-auto">{timeZone}</span>
      </div>
    </div>
  );
}
