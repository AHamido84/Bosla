/** Contact details and non-translatable site constants. */
export const site = {
  /** E.164 without "+", used for wa.me links. */
  whatsappNumber: "966590555525",
  /** Display form, matching the brochure. */
  whatsappDisplay: "+966 59 055 5525",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const whatsappLink = (text?: string) =>
  `https://wa.me/${site.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
