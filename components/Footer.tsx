import { cacheLife } from "next/cache";
import Link from "next/link";
import { site, whatsappLink } from "@/config/site";
import { t } from "@/content";
import { Accent } from "./Accent";
import { Logo } from "./Logo";
import { WhatsAppIcon } from "./WhatsAppIcon";

/** Dark ink footer echoing the brochure's last page (p. 31). */
export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-ink text-cream">
      {/* Large outline logo motif bleeding off the inline-end bottom corner */}
      <Logo
        variant="outline"
        className="pointer-events-none absolute -bottom-24 -end-20 -z-10 h-[26rem] w-auto text-cream/70 sm:-bottom-28 sm:h-[34rem] md:-end-10"
      />
      <div className="container-page py-16 sm:py-24">
        <Accent as="h2" text={t.footer.headline} className="font-display text-5xl leading-tight font-medium sm:text-6xl" />
        <p className="mt-3 max-w-xl text-lg text-cream/90 sm:text-xl">{t.footer.subline}</p>

        <div className="mt-12 max-w-sm border-s border-copper ps-5">
          <p className="text-sm text-cream/80">
            {t.brandName} <span className="text-cream/40">|</span> <span dir="ltr">Human Compass</span>
          </p>
          <p className="mt-3 text-sm text-cream/80">{t.consultant.role}</p>
          <p className="font-display text-2xl font-semibold text-copper">{t.consultant.name}</p>
          {t.consultant.titles.map((title) => (
            <p key={title} className="text-sm text-cream/80">
              {title}
            </p>
          ))}
          <a
            href={whatsappLink(t.whatsapp.prefill)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2.5 rounded-full py-1 text-lg text-cream hover:text-copper-300"
            aria-label={`${t.footer.whatsappLabel}: ${site.whatsappDisplay}`}
          >
            <WhatsAppIcon className="size-6" />
            <span dir="ltr" className="tabular">
              {site.whatsappDisplay}
            </span>
          </a>
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-cream/15 pt-6 text-sm text-cream/70">
          <p>
            <Rights />
          </p>
          <Link href="/privacy" className="underline-offset-4 hover:text-cream hover:underline">
            {t.footer.privacy}
          </Link>
        </div>
      </div>
    </footer>
  );
}

/** Cached so the footer stays prerendered; refreshed daily so the year rolls over. */
async function Rights() {
  "use cache";
  cacheLife("days");
  return <>{t.footer.rights(new Date().getFullYear())}</>;
}
