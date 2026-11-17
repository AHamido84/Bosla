/**
 * monday.com lead sync — which board columns receive which booking fields.
 *
 * Board: "Outreach CRM — Central Team" (https://lgnd-co.monday.com/boards/5108026540)
 * The board ID and API token come from env (MONDAY_BOARD_ID, MONDAY_API_TOKEN); only the
 * column mapping lives here. Set any column to null to skip it.
 * Column IDs: open the board → column menu → "Column settings" → copy ID, or ask monday's API.
 */
export const monday = {
  /** Group new leads land in («ردود وحجوزات»). Override with MONDAY_GROUP_ID. */
  groupId: "group_mm96fs4",
  columns: {
    /** text — "Full name — Job title" */
    person: "text_mm961w74" as string | null,
    /** email */
    email: "email_mm96wbf5" as string | null,
    /** text — E.164 phone */
    phone: "text_mm969rgh" as string | null,
    /** dropdown — sector label (created on the board if missing) */
    sector: "dropdown_mm965s25" as string | null,
    /** dropdown — lead source */
    source: "dropdown_mm96cgte" as string | null,
    /** dropdown — language of the site the lead came from */
    language: "dropdown_mm96j88z" as string | null,
    /** date (with time) — meeting start */
    meetingAt: "date_mm96mrk8" as string | null,
    /** long text — everything else */
    notes: "long_text_mm96yvmy" as string | null,
    /** status — optional initial status label, e.g. "Working on it" (null = leave empty) */
    status: null as string | null,
  },
  /** Label values written into the dropdowns above. */
  sourceLabel: "موقع الحجز",
  languageLabel: "العربية",
  statusLabel: "Working on it",
} as const;
