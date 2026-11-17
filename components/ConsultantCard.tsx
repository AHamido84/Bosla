import { t } from "@/content";
import { Logo } from "./Logo";

export function ConsultantCard({ heading }: { heading?: string }) {
  const c = t.consultant;
  return (
    <section aria-labelledby="consultant" className="relative isolate overflow-hidden rounded-card bg-ink p-6 text-cream sm:p-8">
      <Logo variant="outline" className="pointer-events-none absolute -bottom-16 -end-14 -z-10 h-56 w-auto text-cream/50" />
      {heading && <p className="text-sm text-cream/75">{heading}</p>}
      <h2 id="consultant" className="mt-1 font-display text-3xl font-semibold text-copper">
        {c.name}
      </h2>
      <p className="mt-1 font-medium text-cream">{c.role}</p>
      <ul className="mt-2 space-y-0.5 text-sm text-cream/85">
        {c.titles.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-cream/15 pt-5">
        {c.stats.map((s) => (
          <div key={s.value}>
            <dt className="sr-only">{s.label}</dt>
            <dd className="tabular font-display text-3xl text-copper">
              <bdi dir="ltr">{s.value}</bdi>
            </dd>
            <dd className="mt-1 text-xs leading-relaxed text-cream/80">{s.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
