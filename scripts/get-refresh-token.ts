/**
 * One-time OAuth 2.0 authorisation for the Google account that OWNS the
 * "بوصلة الإنسان" calendar. Run locally:
 *
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run google:token
 *   (or put both in .env.local first)
 *
 * It opens Google's consent screen, receives the code on a loopback URL,
 * prints GOOGLE_REFRESH_TOKEN, then lists your calendars with their IDs so you
 * can copy the "بوصلة الإنسان" ID into GOOGLE_CALENDAR_ID.
 *
 * Requires an OAuth client of type "Desktop app" (loopback redirects allowed).
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { exec } from "node:child_process";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = Number(process.env.OAUTH_PORT ?? 53682);
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;

// Least privilege: create events + read free/busy. calendarlist.readonly is only used
// here, once, to show you your calendar IDs.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n✖ Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (env or .env.local) first.\n");
  process.exit(1);
}

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const verifier = b64url(randomBytes(48));
const challenge = b64url(createHash("sha256").update(verifier).digest());
const state = b64url(randomBytes(16));

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    include_granted_scopes: "false",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

async function exchange(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; scope?: string; error?: string; error_description?: string };
  if (!res.ok) throw new Error(`${json.error}: ${json.error_description}`);
  return json;
}

async function listCalendars(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    items?: { id: string; summary: string; primary?: boolean; accessRole: string; timeZone?: string }[];
  };
  return json.items ?? [];
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end();
    return;
  }
  const done = (msg: string) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<html dir="rtl"><body style="font-family:system-ui;padding:3rem;background:#F9F7F0;color:#16272B"><h2>${msg}</h2><p>يمكنكم إغلاق هذه النافذة والعودة إلى الطرفية.</p></body></html>`);
  };
  try {
    if (url.searchParams.get("state") !== state) throw new Error("State mismatch — please run the script again.");
    const err = url.searchParams.get("error");
    if (err) throw new Error(err);
    const tokens = await exchange(url.searchParams.get("code") ?? "");
    done("✓ تم التفويض بنجاح");

    console.log("\n✓ Authorised. Granted scopes:\n  " + (tokens.scope ?? "").split(" ").join("\n  "));
    if (!tokens.refresh_token) {
      console.log(
        "\n⚠ Google did not return a refresh token. Remove this app at https://myaccount.google.com/permissions and run again.",
      );
    } else {
      console.log("\n────────── copy into .env.local / Vercel ──────────");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    }

    const cals = await listCalendars(tokens.access_token!);
    console.log("\nCalendars you can write to:\n");
    for (const c of cals) {
      const mark = c.summary.includes("بوصلة") ? "  ← use this one" : c.primary ? "  (primary)" : "";
      console.log(`  • ${c.summary}${mark}\n    id: ${c.id}\n    role: ${c.accessRole}  tz: ${c.timeZone ?? "?"}\n`);
    }
    const target = cals.find((c) => c.summary.includes("بوصلة"));
    if (target) {
      console.log(`GOOGLE_CALENDAR_ID=${target.id}`);
      console.log(`BUSY_CALENDAR_IDS=${target.id}`);
      if (target.timeZone && target.timeZone !== "Asia/Riyadh")
        console.log(`\n⚠ This calendar's time zone is ${target.timeZone}. Set it to Asia/Riyadh in its settings.`);
    } else {
      console.log('⚠ No calendar named "بوصلة الإنسان" found. Create it first (README step 1), then copy its ID.');
    }
    console.log("──────────────────────────────────────────────────\n");
  } catch (e) {
    done("✖ تعذّر التفويض");
    console.error("\n✖", (e as Error).message);
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("\nSign in with the Google account that OWNS the “بوصلة الإنسان” calendar:\n");
  console.log(authUrl + "\n");
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? 'start ""' : "xdg-open";
  exec(`${opener} "${authUrl}"`, () => {});
});
