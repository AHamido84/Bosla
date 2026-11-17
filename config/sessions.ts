/**
 * Session types offered on the booking page.
 *
 * - `id` is stable: it is stored on the Google Calendar event and sent to the webhook.
 * - `active: false` hides a type without deleting it.
 * - `colorId` is a Google Calendar event colour (1–11):
 *   https://developers.google.com/calendar/api/v3/reference/colors
 *   10 = Basil (green), 6 = Tangerine (copper-ish), 7 = Peacock, 5 = Banana …
 * - Text is localised: add an `en` value next to each `ar` when the English site is added.
 */
import type { Localized } from "@/content/types";

export type SessionTypeId = "org-intro" | "individual-intro";

export interface IndividualPath {
  id: "consultative" | "specialized";
  title: Localized;
  priceSar: number;
  includes: Localized[];
}

export interface SessionType {
  id: SessionTypeId;
  title: Localized;
  description: Localized;
  durationMinutes: number;
  /** Shown as a small "free" tag. */
  free: boolean;
  active: boolean;
  colorId: string;
  /** Info cards shown under this type (no online payment). */
  paths?: IndividualPath[];
}

export const DEFAULT_SESSION_TYPE: SessionTypeId = "org-intro";

export const sessionTypes: SessionType[] = [
  {
    id: "org-intro",
    title: { ar: "اجتماع تعريفي للجهات" },
    description: {
      ar: "لقاء مرئي مع المستشار الرئيسي لمناقشة احتياج جهتكم، والفئة المستهدفة، واختيار البرنامج الأنسب لكوادركم أو قياداتكم.",
    },
    durationMinutes: 30,
    free: true,
    active: true,
    colorId: "10",
  },
  {
    id: "individual-intro",
    title: { ar: "مكالمة تعريفية للمسارات الفردية" },
    description: {
      ar: "مكالمة قصيرة للقيادات والمهنيين لاختيار المسار الفردي المناسب قبل التعاقد.",
    },
    durationMinutes: 20,
    free: true,
    // Hidden for now. Set to true to show the session-type picker again.
    active: false,
    colorId: "6",
    paths: [
      {
        id: "consultative",
        title: { ar: "مسار بيركمان الاستشاري" },
        priceSar: 1500,
        includes: [
          { ar: "إجراء مقياس بيركمان" },
          { ar: "جلسة شرح وتحليل معمّقة لمدة 90 دقيقة" },
        ],
      },
      {
        id: "specialized",
        title: { ar: "مسار بيركمان التخصصي" },
        priceSar: 2500,
        includes: [
          { ar: "إجراء مقياس بيركمان" },
          { ar: "جلسة شرح وتحليل لمدة 90 دقيقة" },
          { ar: "تقرير مكتوب ومخصص للمستفيد" },
        ],
      },
    ],
  },
];

export const activeSessionTypes = () => sessionTypes.filter((s) => s.active);

export function getSessionType(id: string): SessionType | undefined {
  return sessionTypes.find((s) => s.id === id && s.active);
}
