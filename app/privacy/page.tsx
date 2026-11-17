import type { Metadata } from "next";
import Image from "next/image";
import { Accent } from "@/components/Accent";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { site, whatsappLink } from "@/config/site";
import { t } from "@/content";

export const metadata: Metadata = { title: t.privacy.metaTitle, description: t.privacy.intro };

export default function PrivacyPage() {
  const p = t.privacy;
  return (
    <div className="container-page grid gap-10 py-12 sm:py-16 md:grid-cols-[1fr_18rem] md:gap-16">
      <article>
        <Accent as="h1" text={p.headline} className="h-display" />
        <p className="mt-3 font-display text-xl text-ink sm:text-2xl">{p.subline}</p>
        <p className="mt-6 max-w-2xl text-lg text-ink/85">{p.intro}</p>

        <div className="mt-10 max-w-2xl divide-y divide-copper/60 border-y border-copper/60">
          {p.sections.map((s) => (
            <section key={s.title} className="py-5">
              <h2 className="text-lg font-bold text-ink">{s.title}</h2>
              <p className="mt-1.5 text-ink/85">{s.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-ink/85">{p.contact}</p>
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 font-medium text-copper-600 hover:text-copper-700"
        >
          <WhatsAppIcon className="size-5" />
          <bdi dir="ltr" className="tabular">
            {site.whatsappDisplay}
          </bdi>
        </a>
        <p className="mt-8 text-sm text-ink/65">{p.updated}</p>
      </article>
      <Image
        src="/images/shield.webp"
        alt=""
        width={798}
        height={900}
        sizes="(min-width: 768px) 288px, 192px"
        className="order-first mx-auto h-auto w-48 md:order-none md:w-full md:self-start"
        priority
      />
    </div>
  );
}
