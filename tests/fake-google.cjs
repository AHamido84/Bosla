/**
 * Fake Google OAuth + Calendar v3 server for end-to-end tests.
 * Implements exactly the endpoints the app calls and records every request,
 * so the test can assert on what would have been sent to Google.
 */
const http = require("node:http");

function startFakeGoogle({ port, calendarId, refreshToken }) {
  const state = {
    tokenCalls: 0,
    inserts: [], // { query, body }
    webhooks: [],
    events: [], // { id, calendarId, start, end, site, status }
    busy: { primary: [] }, // extra busy blocks per calendar id
  };

  const send = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) =>
    new Promise((resolve) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(data));
    });
  const authed = (req) => req.headers.authorization === "Bearer fake-access-token";

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const raw = await readBody(req);
    const path = url.pathname;

    // ── OAuth token endpoint ──
    if (req.method === "POST" && path === "/token") {
      state.tokenCalls++;
      const p = new URLSearchParams(raw);
      if (p.get("grant_type") !== "refresh_token" || p.get("refresh_token") !== refreshToken) {
        return send(res, 400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
      }
      return send(res, 200, { access_token: "fake-access-token", expires_in: 3599, token_type: "Bearer" });
    }

    // ── Test controls ──
    if (path === "/__state") return send(res, 200, state);
    if (req.method === "POST" && path === "/__busy") {
      const { calendar, start, end } = JSON.parse(raw);
      if (calendar === calendarId)
        state.events.push({ id: `ext-${Date.now()}`, calendarId, start, end, site: false, status: "confirmed" });
      else (state.busy[calendar] ??= []).push({ start, end });
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && path === "/monday") {
      if (req.headers.authorization !== "monday-test-token") return send(res, 401, { error_message: "Not Authenticated" });
      const body = JSON.parse(raw);
      if (body.query.includes("create_item")) {
        (state.monday ??= []).push(body.variables);
        return send(res, 200, { data: { create_item: { id: "998877" } } });
      }
      return send(res, 200, { data: { boards: body.variables.ids.includes("5108026540") ? [{ id: "5108026540" }] : [] } });
    }
    if (req.method === "POST" && path === "/webhook") {
      state.webhooks.push({ headers: req.headers, body: JSON.parse(raw) });
      return send(res, 200, { ok: true });
    }

    if (!path.startsWith("/calendar/v3")) return send(res, 404, { error: { message: "not found" } });
    if (!authed(req)) return send(res, 401, { error: { message: "Invalid Credentials", status: "UNAUTHENTICATED" } });
    const api = path.slice("/calendar/v3".length);

    // ── freeBusy ──
    if (req.method === "POST" && api === "/freeBusy") {
      const body = JSON.parse(raw);
      const min = Date.parse(body.timeMin);
      const max = Date.parse(body.timeMax);
      const calendars = {};
      for (const { id } of body.items) {
        if (id === calendarId) {
          calendars[id] = {
            busy: state.events
              .filter((e) => e.calendarId === id && e.status !== "cancelled")
              .filter((e) => Date.parse(e.start) < max && Date.parse(e.end) > min)
              .map(({ start, end }) => ({ start, end })),
          };
        } else if (state.busy[id]) {
          calendars[id] = { busy: state.busy[id] };
        } else {
          calendars[id] = { errors: [{ domain: "global", reason: "notFound" }], busy: [] };
        }
      }
      return send(res, 200, { kind: "calendar#freeBusy", timeMin: body.timeMin, timeMax: body.timeMax, calendars });
    }

    const m = api.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
    if (m) {
      const cal = decodeURIComponent(m[1]);
      if (cal !== calendarId) return send(res, 404, { error: { message: "Not Found", status: "NOT_FOUND" } });

      // list (used for per-day caps)
      if (req.method === "GET" && !m[2]) {
        if (url.searchParams.get("fields") === "accessRole") return send(res, 200, { accessRole: "owner" });
        const prop = url.searchParams.get("privateExtendedProperty");
        const items = state.events
          .filter((e) => (prop === "hcBooking=1" ? e.site : true))
          .map((e) => ({ status: e.status, start: { dateTime: e.start } }));
        return send(res, 200, { items });
      }
      // get
      if (req.method === "GET" && m[2]) {
        const ev = state.events.find((e) => e.id === m[2]);
        return ev ? send(res, 200, { hangoutLink: ev.hangoutLink }) : send(res, 404, { error: { message: "nf" } });
      }
      // insert
      if (req.method === "POST" && !m[2]) {
        const body = JSON.parse(raw);
        const query = Object.fromEntries(url.searchParams);
        state.inserts.push({ query, body });
        const id = `evt${state.inserts.length}`;
        const hangoutLink = query.conferenceDataVersion === "1" && body.conferenceData?.createRequest ? `https://meet.google.com/tst-${id}-xyz` : undefined;
        state.events.push({
          id,
          calendarId: cal,
          start: body.start.dateTime,
          end: body.end.dateTime,
          site: body.extendedProperties?.private?.hcBooking === "1",
          status: "confirmed",
          hangoutLink,
        });
        return send(res, 200, {
          id,
          htmlLink: `https://calendar.google.com/event?eid=${id}`,
          hangoutLink,
          conferenceData: hangoutLink
            ? { createRequest: { status: { statusCode: "success" } }, entryPoints: [{ entryPointType: "video", uri: hangoutLink }] }
            : undefined,
        });
      }
    }
    return send(res, 404, { error: { message: `unhandled ${req.method} ${api}` } });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, state })));
}

module.exports = { startFakeGoogle };
