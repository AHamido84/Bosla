/**
 * End-to-end test: real Next.js production server + REAL Google client code,
 * talking to a fake Google API (tests/fake-google.cjs) over HTTP.
 *
 *   npm run test:e2e         (builds first)
 *   node tests/e2e.cjs       (uses the existing .next build)
 *
 * Covers: health, availability, slot display in Riyadh / Cairo / Berlin,
 * full booking, event payload, Meet link, slot disappearing, race (slot taken
 * meanwhile), validation, honeypot, webhook, rate limit. Saves screenshots.
 */
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, devices } = require("playwright");
const { startFakeGoogle } = require("./fake-google.cjs");

const APP_PORT = 3100;
const G_PORT = 4010;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const CAL = "testcal123@group.calendar.google.com";
const SHOTS = path.join(__dirname, "..", "docs", "screenshots", "e2e");
const LOCALE = "ar-SA-u-nu-latn-ca-gregory";
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push(["✓", name, Date.now() - t0]);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push(["✖", name, Date.now() - t0]);
    console.log(`  ✖ ${name}\n    ${e.stack?.split("\n").slice(0, 4).join("\n    ")}`);
    process.exitCode = 1;
  }
}

const fmtTime = (iso, tz) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function fillOrgForm(page, { email = "client@example.com" } = {}) {
  await page.getByLabel("الاسم الكامل").fill("سارة العتيبي");
  await page.getByLabel("المسمى الوظيفي").fill("مديرة الموارد البشرية");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.locator("#phone").fill("0512345678");
  await page.getByLabel("اسم الجهة").fill("هيئة تجريبية");
  await page.getByText("حكومي", { exact: true }).click();
  await page.getByText("101–500", { exact: true }).click();
  await page.getByText("برنامج التحليل والتطوير القيادي (للقيادات)").click();
  await page.getByLabel("ملاحظات").fill("نرغب ببرنامج لفريق القيادات الوسطى.");
  await page.locator("#consent").check();
}

(async () => {
  const fake = await startFakeGoogle({ port: G_PORT, calendarId: CAL, refreshToken: "test-refresh" });
  // The owner's primary calendar has a busy block → must also block slots.
  const env = {
    ...process.env,
    PORT: String(APP_PORT),
    CALENDAR_PROVIDER: "google",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-secret",
    GOOGLE_REFRESH_TOKEN: "test-refresh",
    GOOGLE_CALENDAR_ID: CAL,
    BUSY_CALENDAR_IDS: "primary",
    BOOKING_WEBHOOK_URL: `http://127.0.0.1:${G_PORT}/webhook`,
    BOOKING_WEBHOOK_SECRET: "whsec",
    GOOGLE_API_BASE_URL: `http://127.0.0.1:${G_PORT}/calendar/v3`,
    GOOGLE_TOKEN_URL: `http://127.0.0.1:${G_PORT}/token`,
  };
  // E2E_DEPLOY_DIR=/path/to/deploy → test the packaged folder exactly as a host runs it:
  // `node server.js`, configured only through a .env file in that folder.
  const deployDir = process.env.E2E_DEPLOY_DIR;
  let app;
  if (deployDir) {
    const keys = Object.keys(env).filter((k) => /^(CALENDAR_PROVIDER|GOOGLE_|BUSY_|BOOKING_)/.test(k));
    fs.writeFileSync(path.join(deployDir, ".env"), keys.map((k) => `${k}=${env[k]}`).join("\n") + "\n");
    const bare = { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(APP_PORT), HOSTNAME: "127.0.0.1", NODE_ENV: "production" };
    app = spawn(process.execPath, ["server.js"], { cwd: deployDir, env: bare, stdio: ["ignore", "pipe", "pipe"] });
    console.log(`(testing packaged folder ${deployDir})`);
  } else {
    app = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(APP_PORT)], { env, stdio: ["ignore", "pipe", "pipe"] });
  }
  let appLog = "";
  app.stdout.on("data", (d) => (appLog += d));
  app.stderr.on("data", (d) => (appLog += d));
  const browser = await chromium.launch();

  try {
    await waitFor(`${BASE}/api/health`);
    console.log("\nE2E against fake Google API\n");

    await step("health: token + calendars reachable, no event data", async () => {
      const r = await fetch(`${BASE}/api/health`);
      const j = await r.json();
      assert.equal(r.status, 200, JSON.stringify(j));
      assert.equal(j.ok, true);
      assert.equal(j.checks.token.ok, true);
      assert.equal(j.checks.bookingCalendar.ok, true);
      const s = JSON.stringify(j);
      assert.ok(!s.includes(CAL), "calendar id must not leak");
      assert.ok(!/"busy"|summary|description|dateTime/i.test(s), "no event data");
    });

    let slots;
    await step("availability: returns UTC slots inside Riyadh working hours", async () => {
      const r = await fetch(`${BASE}/api/availability?sessionType=org-intro`);
      const j = await r.json();
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "no-store, max-age=0");
      assert.equal(j.companyTimeZone, "Asia/Riyadh");
      assert.ok(j.slots.length > 20);
      for (const s of j.slots) {
        const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", hourCycle: "h23" }).format(new Date(s.start)));
        assert.ok(h >= 10 && h < 17, `slot outside hours: ${s.start}`);
        assert.equal(Date.parse(s.end) - Date.parse(s.start), 30 * 60000);
      }
      slots = j.slots;
    });

    await step("BUSY_CALENDAR_IDS: a busy block on 'primary' removes overlapping slots", async () => {
      const target = slots[3];
      await fetch(`http://127.0.0.1:${G_PORT}/__busy`, {
        method: "POST",
        body: JSON.stringify({ calendar: "primary", start: target.start, end: target.end }),
      });
      const j = await (await fetch(`${BASE}/api/availability?sessionType=org-intro`)).json();
      assert.ok(!j.slots.some((s) => s.start === target.start), "primary busy must block");
      slots = j.slots;
    });

    await step("inactive session type (individual-intro) is rejected; picker hidden", async () => {
      const r = await fetch(`${BASE}/api/availability?sessionType=individual-intro`);
      assert.equal(r.status, 400);
      const html = await (await fetch(BASE)).text();
      assert.ok(!html.includes("نوع الاجتماع"), "session-type section must not render");
    });

    for (const [tz, showsRiyadh] of [
      ["Asia/Riyadh", false],
      ["Africa/Cairo", true],
      ["Europe/Berlin", true],
    ]) {
      await step(`UI in ${tz}: first slot shows local time${showsRiyadh ? " + Riyadh time" : ""}`, async () => {
        const ctx = await browser.newContext({ timezoneId: tz, locale: "ar-SA" });
        const page = await ctx.newPage();
        await page.goto(BASE);
        const first = page.locator('ul[aria-labelledby="slots-heading"] button').first();
        await first.waitFor();
        const text = (await first.innerText()).replace(/\s+/g, " ");
        const expectedLocal = fmtTime(slots[0].start, tz);
        assert.ok(text.includes(expectedLocal), `${tz}: "${text}" should include "${expectedLocal}"`);
        const riyadh = fmtTime(slots[0].start, "Asia/Riyadh");
        assert.equal(text.includes("بتوقيت الرياض"), showsRiyadh, `${tz}: Riyadh note`);
        if (showsRiyadh) assert.ok(text.includes(riyadh));
        const tzBadge = await page.getByText("الأوقات معروضة بتوقيتكم المحلي").innerText();
        assert.ok(tzBadge.includes(tz.replace("_", " ")), `badge shows ${tz}: ${tzBadge}`);
        await ctx.close();
      });
    }

    await step("validation: empty submit shows Arabic errors on every required field", async () => {
      const page = await browser.newPage();
      await page.goto(BASE);
      await page.locator('ul[aria-labelledby="slots-heading"] button').first().waitFor();
      await page.getByRole("button", { name: "تأكيد الحجز" }).click();
      for (const msg of [
        "يرجى اختيار يوم ووقت من التقويم",
        "يرجى كتابة الاسم الكامل",
        "يرجى إدخال بريد إلكتروني صحيح",
        "يرجى كتابة اسم الجهة",
        "يلزم الموافقة على سياسة الخصوصية",
      ]) {
        assert.ok(await page.getByText(msg).first().isVisible(), `missing: ${msg}`);
      }
      assert.ok((await page.getByText("يرجى اختيار أحد الخيارات").count()) >= 3);
      await page.locator("#phone").fill("12345");
      await page.getByRole("button", { name: "تأكيد الحجز" }).click();
      assert.ok(await page.getByText("رقم الجوال السعودي يتكون من 9 أرقام").isVisible());
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("#fullName").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, "mobile-validation.png") });
      await page.close();
    });

    let booked;
    await step("full booking: Riyadh visitor books first slot → /confirmed with Meet link", async () => {
      const ctx = await browser.newContext({ timezoneId: "Asia/Riyadh", acceptDownloads: true });
      const page = await ctx.newPage();
      await page.goto(BASE);
      const first = page.locator('ul[aria-labelledby="slots-heading"] button').first();
      await first.click();
      assert.equal(await first.getAttribute("aria-pressed"), "true");
      await fillOrgForm(page);
      await page.getByRole("button", { name: "تأكيد الحجز" }).click();
      await page.waitForURL("**/confirmed");
      await page.getByRole("heading", { name: "تم تأكيد حجزكم" }).waitFor();
      const meet = page.locator('a[href^="https://meet.google.com/"]').first();
      booked = { start: slots[0].start, meet: await meet.getAttribute("href") };
      assert.match(booked.meet, /^https:\/\/meet\.google\.com\/tst-evt\d+-xyz$/);
      assert.ok(await page.getByText("خالد الغامدي").first().isVisible());
      assert.ok(await page.getByText("سارة العتيبي").isVisible());

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /إضافة إلى التقويم/ }).click(),
      ]);
      const ics = fs.readFileSync(await download.path(), "utf8");
      assert.match(ics, /BEGIN:VEVENT/);
      assert.ok(ics.includes(`DTSTART:${new Date(booked.start).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`));
      assert.ok(ics.includes(booked.meet));
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: path.join(SHOTS, "desktop-confirmed.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(SHOTS, "mobile-confirmed.png"), fullPage: true });
      await ctx.close();
    });

    await step("event payload sent to Google is correct", async () => {
      const st = await (await fetch(`http://127.0.0.1:${G_PORT}/__state`)).json();
      assert.equal(st.inserts.length, 1);
      const { query, body } = st.inserts[0];
      assert.equal(query.conferenceDataVersion, "1");
      assert.equal(query.sendUpdates, "all");
      assert.equal(body.summary, "اجتماع تعريفي للجهات — سارة العتيبي (هيئة تجريبية)");
      assert.deepEqual(body.attendees, [{ email: "client@example.com", displayName: "سارة العتيبي" }]);
      assert.equal(body.colorId, "10");
      assert.equal(body.start.timeZone, "Asia/Riyadh");
      assert.equal(new Date(body.start.dateTime).toISOString(), booked.start);
      assert.equal(body.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
      assert.ok(body.conferenceData.createRequest.requestId);
      assert.equal(body.extendedProperties.private.hcBooking, "1");
      for (const s of ["المسمى الوظيفي: مديرة الموارد البشرية", "الجوال: +966512345678", "القطاع: حكومي", "عدد الموظفين ضمن النطاق: 101–500", "الحل المهتم به: برنامج التحليل والتطوير القيادي (للقيادات)", "ملاحظات: نرغب"]) {
        assert.ok(body.description.includes(s), `description missing "${s}"`);
      }
    });

    await step("booked slot disappears from availability immediately", async () => {
      const j = await (await fetch(`${BASE}/api/availability?sessionType=org-intro`)).json();
      assert.ok(!j.slots.some((s) => s.start === booked.start));
      // 15-min buffer: the next 30-min slot (start+30) would end within buffer… it must be gone too
      const next = new Date(Date.parse(booked.start) + 30 * 60000).toISOString();
      assert.ok(!j.slots.some((s) => s.start === next), "buffer after booking");
    });

    await step("webhook received with signed booking JSON", async () => {
      await new Promise((r) => setTimeout(r, 500));
      const st = await (await fetch(`http://127.0.0.1:${G_PORT}/__state`)).json();
      assert.equal(st.webhooks.length, 1);
      const w = st.webhooks[0];
      assert.equal(w.body.event, "booking.created");
      assert.equal(w.body.meetLink, booked.meet);
      assert.equal(w.body.client.email, "client@example.com");
      assert.match(w.headers["x-signature"], /^sha256=[0-9a-f]{64}$/);
    });

    await step("race: slot taken meanwhile → friendly message + slots refresh", async () => {
      const page = await browser.newPage();
      await page.goto(BASE);
      const btn = page.locator('ul[aria-labelledby="slots-heading"] button').first();
      await btn.click();
      const picked = (await btn.innerText()).trim();
      const j = await (await fetch(`${BASE}/api/availability?sessionType=org-intro`)).json();
      const visibleDay = j.slots[0]; // UI defaults to first available day, first slot
      // Someone books it directly in Google Calendar while the visitor fills the form:
      await fetch(`http://127.0.0.1:${G_PORT}/__busy`, {
        method: "POST",
        body: JSON.stringify({ calendar: CAL, start: visibleDay.start, end: visibleDay.end }),
      });
      await fillOrgForm(page, { email: "second@example.com" });
      await page.getByRole("button", { name: "تأكيد الحجز" }).click();
      await page.getByText("عذرًا، تم حجز هذا الموعد للتو").waitFor();
      assert.ok(page.url().endsWith("/") || !page.url().includes("confirmed"));
      // Refreshed list no longer offers the taken slot
      await page.locator('ul[aria-labelledby="slots-heading"] button').first().waitFor();
      const firstNow = (await page.locator('ul[aria-labelledby="slots-heading"] button').first().innerText()).trim();
      assert.notEqual(firstNow, picked, "taken slot must no longer be offered");
      const st = await (await fetch(`http://127.0.0.1:${G_PORT}/__state`)).json();
      assert.equal(st.inserts.length, 1, "no second event inserted");
      await page.close();
    });

    await step("server rejects a slot outside working hours / not offered", async () => {
      const r = await fetch(`${BASE}/api/book`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.2" },
        body: JSON.stringify({
          sessionType: "org-intro",
          start: "2030-01-01T00:00:00.000Z",
          fullName: "Test User",
          jobTitle: "Engineer",
          email: "t@example.com",
          countryCode: "+44",
          phone: "7700900123",
          organization: "Test Org",
          sector: "private",
          employees: "1-20",
          solution: "unsure",
          consent: true,
        }),
      });
      assert.equal(r.status, 409);
      assert.equal((await r.json()).error, "SLOT_TAKEN");
    });

    await step("server-side zod validation returns field errors", async () => {
      const r = await fetch(`${BASE}/api/book`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.3" },
        body: JSON.stringify({ sessionType: "org-intro", email: "nope", consent: false }),
      });
      assert.equal(r.status, 422);
      const j = await r.json();
      assert.equal(j.fields.email, "يرجى إدخال بريد إلكتروني صحيح، مثل name@company.com");
      assert.ok(j.fields.consent && j.fields.organization && j.fields.start);
    });

    await step("honeypot: filled hidden field is rejected", async () => {
      const r = await fetch(`${BASE}/api/book`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.4" },
        body: JSON.stringify({ website: "http://spam", sessionType: "org-intro" }),
      });
      assert.equal(r.status, 400);
    });

    await step("rate limit: 6th booking attempt from one IP in 10 min → 429", async () => {
      let last;
      for (let i = 0; i < 6; i++) {
        last = await fetch(`${BASE}/api/book`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.9" },
          body: "{}",
        });
      }
      assert.equal(last.status, 429);
      assert.ok(Number(last.headers.get("retry-after")) > 0);
    });

    await step("no secrets in the client bundle", async () => {
      const dir = path.join(__dirname, "..", ".next", "static");
      const files = [];
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))));
      walk(dir);
      const js = files.filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
      for (const needle of ["GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "refresh_token", "oauth2.googleapis.com", "freeBusy"]) {
        assert.ok(!js.includes(needle), `client bundle contains "${needle}"`);
      }
    });

    await step("screenshots: booking page desktop + mobile, individual type, privacy", async () => {
      const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, timezoneId: "Asia/Riyadh" });
      let page = await desk.newPage();
      await page.goto(BASE);
      await page.locator('ul[aria-labelledby="slots-heading"] button').nth(1).click();
      await page.screenshot({ path: path.join(SHOTS, "desktop-booking.png"), fullPage: true });
      await page.screenshot({ path: path.join(SHOTS, "desktop-hero.png") });
      await page.goto(`${BASE}/privacy`);
      await page.screenshot({ path: path.join(SHOTS, "desktop-privacy.png"), fullPage: true });
      await desk.close();

      const mob = await browser.newContext({ ...devices["iPhone 13"], timezoneId: "Europe/Berlin" });
      page = await mob.newPage();
      await page.goto(BASE);
      await page.locator('ul[aria-labelledby="slots-heading"] button').first().click();
      await page.screenshot({ path: path.join(SHOTS, "mobile-booking.png"), fullPage: true });
      await page.screenshot({ path: path.join(SHOTS, "mobile-hero.png") });
      await mob.close();
    });
  } finally {
    await browser.close();
    app.kill("SIGTERM");
    fake.server.close();
    if (process.exitCode) console.log("\n--- app log ---\n" + appLog.slice(-4000));
    const pass = results.filter((r) => r[0] === "✓").length;
    console.log(`\n${pass}/${results.length} passed. Screenshots → docs/screenshots/e2e/\n`);
  }
})();
