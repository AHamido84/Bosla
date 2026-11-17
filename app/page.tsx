import Image from "next/image";
import { Accent } from "@/components/Accent";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { CheckBadge } from "@/components/CheckBadge";
import { NextSteps } from "@/components/NextSteps";
import { t } from "@/content";

export default function BookingPage() {
  return (
    <>
      {/* Hero */}
      <section className="container-page grid items-center gap-8 pt-10 pb-12 sm:pt-16 md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:pb-20">
        <div className="animate-fade-up">
          <Accent as="h1" text={t.hero.headline} className="h-display" />
          <p className="mt-4 max-w-lg text-lg text-ink/85 sm:text-xl">{t.hero.subline}</p>
          <ul className="mt-7 space-y-2.5">
            {t.hero.badges.map((b) => (
              <li key={b} className="flex items-center gap-3 text-ink">
                <CheckBadge />
                {b}
              </li>
            ))}
          </ul>
          <a href="#booking" className="btn-primary mt-9 text-lg">
            {t.hero.cta}
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="M12 5v14m0 0l-6-6m6 6l6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-sm md:max-w-md">
          <Image
            src="/images/meeting.webp"
            alt={t.hero.imageAlt}
            width={1000}
            height={904}
            priority
            fetchPriority="high"
            sizes="(min-width: 768px) 448px, 304px"
            className="h-auto w-full"
          />
        </div>
      </section>

      <div id="booking" className="container-page scroll-mt-4 border-t border-line pt-14 pb-6 sm:pt-20">
        <BookingFlow />
      </div>

      <div className="border-t border-line">
        <NextSteps />
      </div>
    </>
  );
}
