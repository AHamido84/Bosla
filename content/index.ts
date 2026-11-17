import ar from "./ar";
import type { Content, Locale, Localized } from "./types";

/**
 * Registered locales. To add English:
 *   1. create content/en.ts exporting a `Content` (brandName: "Human Compass", dir: "ltr")
 *   2. add `en` to this map
 *   3. set NEXT_PUBLIC_LOCALE=en (or deploy a second project with it)
 * Components only ever read from `t`, so no component changes are needed.
 */
const dictionaries: Partial<Record<Locale, Content>> = { ar };

export const locale: Locale =
  (process.env.NEXT_PUBLIC_LOCALE as Locale) in dictionaries
    ? (process.env.NEXT_PUBLIC_LOCALE as Locale)
    : "ar";

export const t: Content = dictionaries[locale] ?? ar;

/** Pick the current locale from a Localized value, falling back to Arabic. */
export const l = (value: Localized): string => value[locale] ?? value.ar;

export type { Content, Locale, Localized };
