export type Locale = "ar" | "en";

/** A string per locale. Arabic is required; others fall back to Arabic. */
export type Localized = { ar: string } & Partial<Record<Exclude<Locale, "ar">, string>>;

/**
 * Headlines may contain ONE accent span written as **…**, rendered in copper.
 * e.g. "احجزوا **اجتماعًا تعريفيًا**"
 */
export type AccentText = string;

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

export interface Content {
  locale: Locale;
  dir: "rtl" | "ltr";
  /** BCP-47 tag used for Intl date/number formatting (Latin digits, as in the brochure). */
  intlLocale: string;
  brandName: string;
  tagline: string;
  meta: { title: string; description: string };

  nav: { skipToContent: string; home: string; privacy: string };

  hero: {
    headline: AccentText;
    subline: string;
    imageAlt: string;
    cta: string;
    badges: string[];
  };

  sessionPicker: {
    heading: AccentText;
    legend: string;
    minutes: (n: number) => string;
    free: string;
    pathsHeading: string;
    pathsNote: string;
    currency: string;
    includes: string;
  };

  calendar: {
    heading: AccentText;
    subline: string;
    prevMonth: string;
    nextMonth: string;
    available: string;
    unavailable: string;
    selected: string;
    loading: string;
    error: string;
    retry: string;
    noSlotsDay: string;
    noSlotsAtAll: string;
    pickDayFirst: string;
    slotsFor: (date: string) => string;
    yourTimeZone: (tz: string) => string;
    riyadhTime: (time: string) => string;
    timesShownIn: string;
    riyadhLabel: string;
    weekdaysShort: string[];
  };

  form: {
    heading: AccentText;
    subline: string;
    selectedSlot: string;
    changeSlot: string;
    noSlotSelected: string;
    fields: {
      fullName: string;
      jobTitle: string;
      email: string;
      phone: string;
      countryCode: string;
      organization: string;
      sector: string;
      employees: string;
      solution: string;
      path: string;
      notes: string;
      notesPlaceholder: string;
      honeypot: string;
    };
    hints: { email: string; phone: string };
    sectors: Option<"government" | "education" | "private" | "nonprofit">[];
    employeeRanges: Option<"1-20" | "21-100" | "101-500" | "500+">[];
    solutions: Option<"self" | "leadership" | "professional" | "unsure">[];
    paths: Option<"consultative" | "specialized" | "unsure">[];
    consentBefore: string;
    consentLink: string;
    consentAfter: string;
    submit: string;
    submitting: string;
    required: string;
    optional: string;
    errorSummary: string;
  };

  validation: {
    required: string;
    fullName: string;
    jobTitle: string;
    email: string;
    phone: string;
    phoneSaudi: string;
    organization: string;
    choose: string;
    notesTooLong: string;
    consent: string;
    slot: string;
    sessionType: string;
  };

  errors: {
    slotTaken: string;
    rateLimited: string;
    invalid: string;
    unavailable: string;
    network: string;
  };

  nextSteps: {
    heading: AccentText;
    steps: { title: string; body: string }[];
  };

  confirmed: {
    metaTitle: string;
    headline: AccentText;
    sublineBefore: string;
    sublineAfter: string;
    summaryHeading: string;
    session: string;
    date: string;
    time: string;
    duration: string;
    name: string;
    organization: string;
    meetLink: string;
    joinMeet: string;
    meetPending: string;
    addToCalendar: string;
    backHome: string;
    emptyHeading: string;
    emptyBody: string;
    emptyCta: string;
    consultantHeading: string;
    icsDescription: string;
  };

  consultant: {
    name: string;
    role: string;
    titles: string[];
    stats: { value: string; label: string }[];
  };

  privacy: {
    metaTitle: string;
    headline: AccentText;
    subline: string;
    intro: string;
    sections: { title: string; body: string }[];
    contact: string;
    updated: string;
  };

  footer: {
    headline: AccentText;
    subline: string;
    whatsappLabel: string;
    rights: (year: number) => string;
    privacy: string;
  };

  whatsapp: { label: string; prefill: string };

  /** Labels used inside the Google Calendar event description and webhook. */
  eventLabels: {
    sessionType: string;
    fullName: string;
    jobTitle: string;
    email: string;
    phone: string;
    organization: string;
    sector: string;
    employees: string;
    solution: string;
    path: string;
    notes: string;
    timeZone: string;
    bookedVia: string;
  };
}
