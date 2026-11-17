import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { site } from "@/config/site";
import { t } from "@/content";
import { fontDisplay, fontSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: t.meta.title,
  description: t.meta.description,
  applicationName: t.brandName,
  openGraph: {
    title: t.meta.title,
    description: t.meta.description,
    locale: t.locale === "ar" ? "ar_SA" : "en_US",
    type: "website",
    siteName: t.brandName,
    images: [{ url: "/images/meeting.webp", width: 1000, height: 904 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F9F7F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={t.locale} dir={t.dir} className={`${fontSans.variable} ${fontDisplay.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-2 focus:text-cream"
        >
          {t.nav.skipToContent}
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <WhatsAppFab />
      </body>
    </html>
  );
}
