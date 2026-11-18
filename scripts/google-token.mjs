#!/usr/bin/env node
/**
 * One-time Google authorisation for the booking site — plain Node 20+, no dependencies.
 * Works on your computer AND in Google Cloud Shell (no project checkout needed):
 *
 *   curl -fsSLO https://raw.githubusercontent.com/AHamido84/Bosla/claude/zealous-mayer-26kb2l/scripts/google-token.mjs
 *   node google-token.mjs
 *
 * Or inside the repo:  npm run google:token
 *
 * Needs an OAuth client of type "Desktop app". Reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * from the environment or .env.local, otherwise asks for them here in the terminal.
 * Prints GOOGLE_REFRESH_TOKEN and lists your calendars with their IDs.
 * Nothing is sent anywhere except to Google.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { createInterface } from "node:readline";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
const lines = rl[Symbol.asyncIterator]();
async function ask(q) {
  process.stdout.write(q);
  const { value, done } = await lines.next();
  if (done) throw new Error("No input received.");
  return value.trim();
}

const PORT = Number(process.env.OAUTH_PORT ?? 53682);
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
// Least privilege: create events + read free/busy; calendarlist.readonly only to show IDs here.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function main() {
  console.log("\n── Human Compass · Google Calendar authorisation ──\n");
  const clientId = process.env.GOOGLE_CLIENT_ID || (await ask("Client ID: "));
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || (await ask("Client secret: "));
  if (!clientId.endsWith(".apps.googleusercontent.com") || !clientSecret) {
    throw new Error("That doesn't look like an OAuth Client ID / secret (Google Auth Platform → Clients).");
  }

  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(16));
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });

  console.log("\n1) Open this link and sign in with the account that OWNS the “بوصلة الإنسان” calendar:\n");
  console.log(authUrl + "\n");
  console.log("2) Allow access. If Google warns the app is unverified: Advanced → Go to … (unsafe) → Continue.");
  console.log("3) Your browser then goes to http://127.0.0.1… — on a computer this finishes by itself.");
  console.log("   In Cloud Shell the page will say “This site can't be reached”: that's expected.");
  console.log("   Copy the FULL address from the browser's address bar and paste it below.\n");

  // Whichever comes first: the loopback callback (local machine) or a pasted URL (Cloud Shell).
  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT);
      if (url.pathname !== "/oauth2callback") return void res.writeHead(404).end();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end('<html dir="rtl"><body style="font-family:system-ui;padding:3rem;background:#F9F7F0;color:#16272B"><h2>✓ تم التفويض — ارجع إلى الطرفية</h2></body></html>');
      server.close();
      rl.close();
      try {
        resolve(codeFrom(url));
      } catch (e) {
        reject(e);
      }
    });
    server.on("error", () => {}); // port busy (e.g. Cloud Shell) → paste mode only
    server.listen(PORT, "127.0.0.1");
    ask("Paste the address here (or wait if your browser finished): ").then(
      (answer) => {
        server.close();
        let url;
        try {
          url = new URL(answer);
        } catch {
          return reject(new Error("That isn't the address from the browser — copy the whole address bar (starts with http://127.0.0.1)."));
        }
        try {
          resolve(codeFrom(url));
        } catch (e) {
          reject(e);
        }
      },
      (e) => {
        server.close();
        reject(e);
      },
    );
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start \"\"" : "xdg-open";
    if (!process.env.CLOUD_SHELL) exec(`${opener} "${authUrl}"`, () => {});
  });

  function codeFrom(url) {
    if (url.searchParams.get("error")) throw new Error(`Google returned: ${url.searchParams.get("error")}`);
    if (url.searchParams.get("state") !== state) throw new Error("This address is from a different attempt — run the script again.");
    const c = url.searchParams.get("code");
    if (!c) throw new Error("No ?code= in that address — copy the whole address bar.");
    return c;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`${tokens.error}: ${tokens.error_description ?? ""}`);

  const granted = (tokens.scope ?? "").split(" ");
  const missing = SCOPES.slice(0, 2).filter((s) => !granted.includes(s));
  if (missing.length) console.log(`\n⚠ Not granted: ${missing.join(", ")} — run again and tick every permission.`);
  if (!tokens.refresh_token) {
    console.log("\n⚠ No refresh token returned. Remove the app at https://myaccount.google.com/permissions and run again.");
  }

  const calRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const cals = (await calRes.json()).items ?? [];

  console.log("\nYour calendars:\n");
  for (const c of cals) {
    const writable = c.accessRole === "owner" || c.accessRole === "writer";
    console.log(`  • ${c.summary}${c.primary ? "  (primary)" : ""}`);
    console.log(`    id: ${c.id}`);
    console.log(`    access: ${c.accessRole}${writable ? "" : "  ✖ read-only — bookings can't be written here"}   time zone: ${c.timeZone}\n`);
  }
  const target = cals.find((c) => c.summary.includes("بوصلة") && (c.accessRole === "owner" || c.accessRole === "writer"));

  console.log("════════ Put these in Vercel → Settings → Environment Variables ════════\n");
  console.log(`GOOGLE_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
  if (tokens.refresh_token) console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  if (target) {
    console.log(`GOOGLE_CALENDAR_ID=${target.id}`);
    if (target.timeZone !== "Asia/Riyadh")
      console.log(`\n⚠ “${target.summary}” uses ${target.timeZone}. Set it to Asia/Riyadh in its calendar settings.`);
  } else {
    console.log('\n⚠ No writable calendar named "بوصلة الإنسان" in this account — create it (or get edit access), then copy its id from the list above.');
  }
  console.log("\nThen: Deployments → latest → ⋯ → Redeploy. Keep these values private.\n");
}

main()
  .catch((e) => {
    console.error(`\n✖ ${e.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
