"use client";

import Image from "next/image";
import { activeSessionTypes, type SessionTypeId } from "@/config/sessions";
import { l, t } from "@/content";
import { formatNumber } from "@/lib/format";
import { CheckBadge } from "../CheckBadge";

export function SessionPicker({
  value,
  onChange,
}: {
  value: SessionTypeId;
  onChange: (id: SessionTypeId) => void;
}) {
  const types = activeSessionTypes();
  const current = types.find((s) => s.id === value);

  return (
    <div>
      <fieldset>
        <legend className="sr-only">{t.sessionPicker.legend}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((s) => {
            const checked = s.id === value;
            return (
              <label
                key={s.id}
                className={[
                  "relative flex cursor-pointer gap-4 rounded-card border bg-white p-5 transition-colors sm:p-6",
                  checked ? "border-emerald ring-1 ring-emerald" : "border-line hover:border-ink/50",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="sessionType"
                  value={s.id}
                  checked={checked}
                  onChange={() => onChange(s.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={[
                    "mt-1 grid size-5 shrink-0 place-items-center rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald",
                    checked ? "border-emerald bg-emerald" : "border-ink/40",
                  ].join(" ")}
                >
                  {checked && <span className="size-2 rounded-full bg-cream" />}
                </span>
                <span className="flex-1">
                  <span className="block text-lg leading-snug font-bold text-ink">{l(s.title)}</span>
                  <span className="mt-1.5 block text-[15px] leading-relaxed text-ink/80">{l(s.description)}</span>
                  <span className="mt-3 flex flex-wrap gap-2 text-sm">
                    <span className="tabular rounded-full border border-line px-3 py-0.5 text-ink">
                      {t.sessionPicker.minutes(s.durationMinutes)}
                    </span>
                    {s.free && (
                      <span className="rounded-full bg-emerald/10 px-3 py-0.5 font-medium text-emerald">
                        {t.sessionPicker.free}
                      </span>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {current?.paths && (
        <div className="mt-6 animate-fade-up rounded-card border border-line bg-cream p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <Image src="/images/compass-bust.webp" alt="" width={295} height={329} className="hidden h-24 w-auto sm:block" sizes="88px" />
            <div>
              <h3 className="text-lg font-bold text-ink">{t.sessionPicker.pathsHeading}</h3>
              <p className="mt-1 text-sm text-ink/80">{t.sessionPicker.pathsNote}</p>
            </div>
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {current.paths.map((p) => (
              <li key={p.id} className="flex flex-col rounded-card border border-ink bg-white p-5">
                <h4 className="font-display text-xl font-semibold text-ink">{l(p.title)}</h4>
                <hr className="my-3 border-ink" />
                <p className="sr-only">{t.sessionPicker.includes}</p>
                <ul className="flex-1 space-y-2">
                  {p.includes.map((inc) => (
                    <li key={l(inc)} className="flex items-start gap-2.5 text-[15px] text-ink">
                      <CheckBadge className="mt-1 size-[18px]" />
                      {l(inc)}
                    </li>
                  ))}
                </ul>
                <p className="tabular mt-5 rounded-full bg-copper py-2 text-center text-xl font-bold text-white">
                  {formatNumber(p.priceSar)} {t.sessionPicker.currency}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
