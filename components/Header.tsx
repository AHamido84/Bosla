import Link from "next/link";
import { t } from "@/content";
import { Logo } from "./Logo";

/** Brochure header bar: tagline at inline-start, logo at inline-end, hairline beneath. */
export function Header() {
  return (
    <header className="container-page">
      <div className="flex items-center justify-between gap-4 border-b border-line py-4 sm:py-5">
        <p className="max-w-[16rem] text-[13px] leading-snug text-ink sm:max-w-none sm:text-sm">{t.tagline}</p>
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg" aria-label={`${t.brandName} — ${t.nav.home}`}>
          <span className="hidden font-display text-xl font-semibold text-emerald-700 sm:inline">{t.brandName}</span>
          <Logo className="h-10 w-auto sm:h-11" />
        </Link>
      </div>
    </header>
  );
}
