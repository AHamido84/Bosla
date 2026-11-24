import { connection } from "next/server";
import { getCalendar } from "@/lib/server/calendar";
import { getEnv, missingGoogleEnv, type ServerEnv } from "@/lib/server/env";

/** Confirms the monday token can see the board. Returns only ok/error — no board data. */
async function mondayCheck(env: ServerEnv): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(env.mondayApiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: env.mondayToken! },
      body: JSON.stringify({ query: `query ($ids: [ID!]) { boards(ids: $ids) { id } }`, variables: { ids: [env.mondayBoardId] } }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { boards?: { id: string }[] }; errors?: unknown[] };
    if (res.status === 401) return { ok: false, detail: "invalid_token" };
    if (!res.ok || json.errors) return { ok: false, detail: `http_${res.status}` };
    return json.data?.boards?.length ? { ok: true } : { ok: false, detail: "board_not_found" };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

/**
 * GET /api/health — verifies the OAuth token can be refreshed and every configured
 * calendar is reachable via free/busy. Returns only ok/error flags: no event data,
 * no busy times, no secrets, and calendar IDs are masked.
 */
export async function GET() {
  await connection();
  const env = getEnv();
  const headers = { "cache-control": "no-store" };

  if (env.provider === "google") {
    const missing = missingGoogleEnv(env);
    if (missing.length) {
      return Response.json(
        { ok: false, provider: env.provider, checks: { env: { ok: false, detail: `missing: ${missing.join(", ")}` } } },
        { status: 503, headers },
      );
    }
  }

  try {
    const result = await getCalendar().health();
    const checks: Record<string, { ok: boolean; detail?: string }> = { env: { ok: true }, ...result.checks };
    if (env.mondayToken && env.mondayBoardId) checks.monday = await mondayCheck(env);
    const ok = Object.values(checks).every((c) => c.ok);
    // Diagnostics without secrets: is BUSY_CALENDAR_IDS reaching this deployment, and which build is live?
    const config = {
      busyCalendarIdsSet: Boolean(process.env.BUSY_CALENDAR_IDS?.trim()),
      calendarsChecked: env.busyCalendarIds.length,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    };
    return Response.json(
      { ok, provider: env.provider, webhook: Boolean(env.webhookUrl), monday: Boolean(env.mondayToken), config, checks },
      { status: ok ? 200 : 503, headers },
    );
  } catch {
    return Response.json({ ok: false, provider: env.provider }, { status: 503, headers });
  }
}
