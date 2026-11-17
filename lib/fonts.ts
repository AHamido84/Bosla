/**
 * Brand fonts.
 *
 * NOW: fallbacks from Google Fonts, self-hosted by next/font at build time
 *      (no runtime requests to Google).
 *   body/UI   → IBM Plex Sans Arabic
 *   headlines → Noto Naskh Arabic
 *
 * TO SWITCH TO THMANYAH (the brochure's typeface):
 *   1. Put the files in brand/fonts/, e.g.
 *        thmanyahsans-Regular.woff2, thmanyahsans-Medium.woff2, thmanyahsans-Bold.woff2,
 *        thmanyahserifdisplay-Medium.woff2
 *   2. Replace the two exports below with:
 *
 *      import localFont from "next/font/local";
 *      export const fontSans = localFont({
 *        variable: "--font-sans-src",
 *        display: "swap",
 *        src: [
 *          { path: "../brand/fonts/thmanyahsans-Regular.woff2", weight: "400" },
 *          { path: "../brand/fonts/thmanyahsans-Medium.woff2", weight: "500" },
 *          { path: "../brand/fonts/thmanyahsans-Bold.woff2", weight: "700" },
 *        ],
 *      });
 *      export const fontDisplay = localFont({
 *        variable: "--font-display-src",
 *        display: "swap",
 *        src: [{ path: "../brand/fonts/thmanyahserifdisplay-Medium.woff2", weight: "500" }],
 *      });
 *
 *   3. Check the Thmanyah licence allows web embedding for your use.
 */
import { IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic } from "next/font/google";

export const fontSans = IBM_Plex_Sans_Arabic({
  variable: "--font-sans-src",
  subsets: ["arabic", "latin"],
  // 600 (font-semibold) falls back to 700 — one file fewer on the critical path.
  weight: ["400", "500", "700"],
  display: "swap",
  // next/font's size-adjusted fallback keeps layout shift at 0 while it swaps in.
  adjustFontFallback: true,
  preload: false,
});

export const fontDisplay = Noto_Naskh_Arabic({
  variable: "--font-display-src",
  // Headlines are Arabic and set in one weight; not preloaded so the hero image wins
  // the bandwidth race on mobile (swap keeps text visible meanwhile).
  subsets: ["arabic"],
  weight: ["500"],
  display: "swap",
  preload: false,
});
