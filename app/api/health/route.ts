import { connection } from "next/server";
import { getCalendar } from "@/lib/server/calendar";
import { getEnv, missingGoogleEnv } from "@/lib/server/env";

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
    return Response.json(
      { ok: result.ok, provider: env.provider, webhook: Boolean(env.webhookUrl), checks: { env: { ok: true }, ...result.checks } },
      { status: result.ok ? 200 : 503, headers },
    );
  } catch {
    return Response.json({ ok: false, provider: env.provider }, { status: 503, headers });
  }
}
