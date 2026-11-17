import "server-only";
import { monday } from "@/config/monday";
import { getEnv } from "./env";
import type { BookingWebhookPayload } from "./webhook";

/**
 * Creates one item per booking on the monday.com board (MONDAY_API_TOKEN + MONDAY_BOARD_ID).
 * Runs after the response is sent; never throws — a monday outage must not fail a booking
 * that is already on the calendar. Errors are logged without personal data.
 */
export async function syncLeadToMonday(b: BookingWebhookPayload): Promise<void> {
  const env = getEnv();
  if (!env.mondayToken || !env.mondayBoardId) return;

  const c = b.client;
  const cols = monday.columns;
  const start = new Date(b.start);
  const iso = start.toISOString(); // monday date columns store UTC
  const values: Record<string, unknown> = {};

  if (cols.person) values[cols.person] = [c.fullName, c.jobTitle].filter(Boolean).join(" — ");
  if (cols.email && c.email) values[cols.email] = { email: c.email, text: c.email };
  if (cols.phone && c.phone) values[cols.phone] = c.phone;
  if (cols.sector && c.sector) values[cols.sector] = { labels: [c.sector] };
  if (cols.source) values[cols.source] = { labels: [monday.sourceLabel] };
  if (cols.language) values[cols.language] = { labels: [monday.languageLabel] };
  if (cols.meetingAt) values[cols.meetingAt] = { date: iso.slice(0, 10), time: iso.slice(11, 19) };
  if (cols.status) values[cols.status] = { label: monday.statusLabel };
  if (cols.notes) {
    const riyadh = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
      timeZone: b.timeZone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(start);
    const lines = [
      `${b.sessionTitle} — ${riyadh} (توقيت الرياض)`,
      c.employees && `عدد الموظفين ضمن النطاق: ${c.employees}`,
      c.solution && `الحل المهتم به: ${c.solution}`,
      c.path && `المسار المهتم به: ${c.path}`,
      c.notes && `ملاحظات العميل: ${c.notes}`,
      b.meetLink && `رابط Google Meet: ${b.meetLink}`,
      c.timeZone && `المنطقة الزمنية للعميل: ${c.timeZone}`,
      `معرّف الحجز: ${b.bookingId}`,
    ].filter(Boolean);
    values[cols.notes] = { text: lines.join("\n") };
  }

  const itemName = c.organization || c.fullName;
  const query = `mutation ($board: ID!, $group: String, $name: String!, $values: JSON!) {
    create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values, create_labels_if_missing: true) { id }
  }`;

  try {
    const res = await fetch(env.mondayApiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: env.mondayToken },
      body: JSON.stringify({
        query,
        variables: {
          board: env.mondayBoardId,
          group: env.mondayGroupId ?? monday.groupId,
          name: itemName,
          values: JSON.stringify(values),
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { create_item?: { id: string } };
      errors?: { message: string }[];
      error_message?: string;
    };
    if (!res.ok || json.errors?.length || json.error_message || !json.data?.create_item?.id) {
      const msg = json.errors?.map((e) => e.message).join("; ") ?? json.error_message ?? res.statusText;
      console.error(`[monday] create_item failed (${res.status}): ${msg}`);
    }
  } catch (err) {
    console.error("[monday] request failed:", (err as Error).message);
  }
}
