import { t } from "@/content";
import { Accent } from "./Accent";

/** "ماذا يحدث بعد الحجز؟" — outlined numbered circles joined by a hairline (brochure p. 23). */
export function NextSteps() {
  const steps = t.nextSteps.steps;
  return (
    <section aria-labelledby="next-steps" className="container-page py-16 sm:py-20">
      <Accent as="h2" id="next-steps" text={t.nextSteps.heading} className="h-section text-center" />
      <ol className="mx-auto mt-10 grid max-w-4xl gap-8 sm:mt-14 sm:grid-cols-3 sm:gap-6">
        {steps.map((step, i) => (
          <li key={step.title} className="relative flex gap-5 sm:flex-col sm:items-center sm:gap-0 sm:text-center">
            {/* connector: vertical on mobile, horizontal on desktop */}
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-14 bottom-[-2rem] start-7 w-px bg-ink sm:top-7 sm:bottom-auto sm:start-[calc(50%+2.75rem)] sm:h-px sm:w-[calc(100%-5.5rem+1.5rem)]"
              />
            )}
            <span className="tabular relative grid size-14 shrink-0 place-items-center rounded-full border border-ink bg-cream text-xl font-semibold text-ink">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="sm:mt-5">
              <h3 className="text-lg font-bold text-copper-600">{step.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-ink/85">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
