"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { t } from "@/content";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
      <svg viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" aria-hidden="true" fill="currentColor">
        <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1Zm0 7.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" />
      </svg>
      {message}
    </p>
  );
}

function LabelText({ children, optional }: { children: ReactNode; optional?: boolean }) {
  return (
    <>
      {children}
      {optional ? (
        <span className="ms-1.5 text-xs font-normal text-ink/65">({t.form.optional})</span>
      ) : (
        <span className="ms-0.5 text-copper-600" aria-hidden="true">
          *
        </span>
      )}
    </>
  );
}

type TextFieldProps = {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ name, label, error, hint, optional, ...rest }: TextFieldProps) {
  const errId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div>
      <label htmlFor={name} className="label">
        <LabelText optional={optional}>{label}</LabelText>
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-required={optional ? undefined : true}
        aria-describedby={[error && errId, hint && hintId].filter(Boolean).join(" ") || undefined}
        className="field"
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink/70">
          {hint}
        </p>
      )}
      <FieldError id={errId} message={error} />
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  error,
  ...rest
}: { name: string; label: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const errId = `${name}-error`;
  return (
    <div>
      <label htmlFor={name} className="label">
        <LabelText optional>{label}</LabelText>
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        className="field min-h-24 resize-y py-3"
        {...rest}
      />
      <FieldError id={errId} message={error} />
    </div>
  );
}

/** Radio group rendered as pills (short labels) or stacked tiles (long labels). */
export function ChoiceField<V extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  layout = "pills",
}: {
  name: string;
  legend: string;
  options: { value: V; label: string }[];
  value: V | "";
  onChange: (v: V) => void;
  error?: string;
  layout?: "pills" | "tiles";
}) {
  const errId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errId : undefined}>
      <legend className="label">
        <LabelText>{legend}</LabelText>
      </legend>
      <div className={layout === "pills" ? "flex flex-wrap gap-2" : "grid gap-2"}>
        {options.map((o, i) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={[
                "relative flex cursor-pointer items-center gap-2.5 border bg-white text-[15px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald",
                layout === "pills" ? "min-h-11 rounded-full px-4" : "min-h-12 rounded-field px-4 py-2.5",
                checked
                  ? "border-emerald bg-emerald/5 font-medium text-emerald ring-1 ring-emerald"
                  : error
                    ? "border-danger/60 text-ink"
                    : "border-line text-ink hover:border-ink/50",
              ].join(" ")}
            >
              <input
                type="radio"
                id={i === 0 ? name : undefined}
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`grid size-4 shrink-0 place-items-center rounded-full border ${checked ? "border-emerald" : "border-ink/40"}`}
              >
                {checked && <span className="size-2 rounded-full bg-emerald" />}
              </span>
              <span className="tabular">{o.label}</span>
            </label>
          );
        })}
      </div>
      <FieldError id={errId} message={error} />
    </fieldset>
  );
}
