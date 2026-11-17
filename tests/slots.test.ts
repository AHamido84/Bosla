import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { availability, type AvailabilityConfig } from "../config/availability";
import { toE164 } from "../lib/booking-schema";
import { buildIcs } from "../lib/ics";
import { generateSlots } from "../lib/slots";
import { dateKey, tzOffsetMinutes, zonedParts, zonedTimeToUtc } from "../lib/time";

const cfg: AvailabilityConfig = {
  ...availability,
  timeZone: "Asia/Riyadh",
  workingDays: [0, 1, 2, 3, 4],
  startTime: "10:00",
  endTime: "17:00",
  breaks: [],
  blockedDates: [],
  slotIntervalMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 12,
  horizonDays: 21,
  maxSessionsPerDay: 0,
};

const hm = (iso: string, tz: string) => {
  const p = zonedParts(new Date(iso), tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

// Tuesday 17 Nov 2026, 09:00 Riyadh (06:00Z)
const NOW = new Date("2026-11-17T06:00:00Z");

describe("time zone primitives", () => {
  it("Riyadh is UTC+3 all year (no DST)", () => {
    assert.equal(tzOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Asia/Riyadh"), 180);
    assert.equal(tzOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Asia/Riyadh"), 180);
  });
  it("Cairo is UTC+2 in winter and UTC+3 in summer (DST)", () => {
    assert.equal(tzOffsetMinutes(new Date("2026-11-17T12:00:00Z"), "Africa/Cairo"), 120);
    assert.equal(tzOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Africa/Cairo"), 180);
  });
  it("Berlin is UTC+1 in winter and UTC+2 in summer", () => {
    assert.equal(tzOffsetMinutes(new Date("2026-11-17T12:00:00Z"), "Europe/Berlin"), 60);
    assert.equal(tzOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Europe/Berlin"), 120);
  });
  it("converts Riyadh wall time to UTC", () => {
    assert.equal(zonedTimeToUtc(2026, 11, 18, 10, 0, "Asia/Riyadh").toISOString(), "2026-11-18T07:00:00.000Z");
  });
  it("handles a DST-gap wall time in Berlin without throwing", () => {
    // 29 Mar 2026 02:30 does not exist in Berlin; we land on a valid instant.
    const d = zonedTimeToUtc(2026, 3, 29, 2, 30, "Europe/Berlin");
    assert.ok(!Number.isNaN(d.getTime()));
  });
});

describe("slot generation (company zone = Asia/Riyadh)", () => {
  const slots = generateSlots({ now: NOW, config: cfg, durationMinutes: 30, busy: [], bookedStarts: [] });

  it("first slot respects 12h minimum notice (09:00 + 12h → 21:00 Tue, so Wed 10:00)", () => {
    assert.equal(slots[0].start, "2026-11-18T07:00:00.000Z");
    assert.equal(hm(slots[0].start, "Asia/Riyadh"), "10:00");
  });

  it("same instant shows correctly in Riyadh, Cairo and Europe", () => {
    const s = slots[0].start;
    assert.equal(hm(s, "Asia/Riyadh"), "10:00");
    assert.equal(hm(s, "Africa/Cairo"), "09:00");
    assert.equal(hm(s, "Europe/Berlin"), "08:00");
    assert.equal(hm(s, "Europe/London"), "07:00");
  });

  it("last slot of a day ends exactly at 17:00 Riyadh", () => {
    const wed = slots.filter((s) => dateKey(new Date(s.start), "Asia/Riyadh") === "2026-11-18");
    assert.equal(wed.length, 14); // 10:00 … 16:30
    assert.equal(hm(wed.at(-1)!.end, "Asia/Riyadh"), "17:00");
  });

  it("never offers Friday or Saturday", () => {
    for (const s of slots) {
      const wd = zonedParts(new Date(s.start), "Asia/Riyadh").weekday;
      assert.ok(wd !== 5 && wd !== 6, `weekend slot ${s.start}`);
    }
  });

  it("respects the 21-day horizon", () => {
    const last = new Date(slots.at(-1)!.start).getTime();
    assert.ok(last <= NOW.getTime() + 21 * 86400000);
  });

  it("groups by the visitor's local date (Los Angeles sees Riyadh 10:00 on the previous day)", () => {
    assert.equal(dateKey(new Date(slots[0].start), "America/Los_Angeles"), "2026-11-17");
    assert.equal(hm(slots[0].start, "America/Los_Angeles"), "23:00");
  });

  it("summer: Cairo matches Riyadh, Berlin is one hour behind", () => {
    const summer = generateSlots({
      now: new Date("2026-07-12T06:00:00Z"),
      config: cfg,
      durationMinutes: 30,
      busy: [],
      bookedStarts: [],
    });
    assert.equal(hm(summer[0].start, "Asia/Riyadh"), "10:00");
    assert.equal(hm(summer[0].start, "Africa/Cairo"), "10:00");
    assert.equal(hm(summer[0].start, "Europe/Berlin"), "09:00");
  });
});

describe("busy time, buffers, caps", () => {
  const day = (h: number, m = 0) => zonedTimeToUtc(2026, 11, 18, h, m, "Asia/Riyadh");
  const busy = [{ start: day(11), end: day(12, 30) }];
  const wed = (opts: Partial<Parameters<typeof generateSlots>[0]> = {}) =>
    generateSlots({ now: NOW, config: cfg, durationMinutes: 30, busy, bookedStarts: [], ...opts })
      .filter((s) => dateKey(new Date(s.start), "Asia/Riyadh") === "2026-11-18")
      .map((s) => hm(s.start, "Asia/Riyadh"));

  it("blocks overlapping slots plus a 15-minute buffer on both sides", () => {
    const times = wed();
    assert.ok(times.includes("10:00")); // ends 10:30, +15 = 10:45 < 11:00
    assert.ok(!times.includes("10:30")); // ends 11:00, buffer overlaps
    assert.ok(!times.includes("11:00"));
    assert.ok(!times.includes("12:00"));
    assert.ok(!times.includes("12:30")); // buffer 12:15 overlaps busy end
    assert.ok(times.includes("13:00"));
  });

  it("a booked slot disappears immediately (busy includes the new event)", () => {
    const booked = { start: day(14), end: day(14, 30) };
    const times = wed({ busy: [...busy, booked] });
    assert.ok(!times.includes("14:00"));
    assert.ok(!times.includes("13:30") && !times.includes("14:30")); // buffers
  });

  it("enforces max sessions per day", () => {
    const times = wed({
      config: { ...cfg, maxSessionsPerDay: 2 },
      bookedStarts: [day(15), day(16)],
    });
    assert.equal(times.length, 0);
  });

  it("supports breaks and blocked dates", () => {
    assert.ok(!wed({ config: { ...cfg, breaks: [{ start: "13:00", end: "14:00" }] } }).includes("13:00"));
    assert.equal(wed({ config: { ...cfg, blockedDates: ["2026-11-18"] } }).length, 0);
  });

  it("20-minute sessions still end by 17:00", () => {
    const times = wed({ durationMinutes: 20, busy: [] });
    assert.equal(times.at(-1), "16:30");
  });
});

describe("phone normalisation", () => {
  it("accepts Saudi mobiles in common formats", () => {
    for (const v of ["512345678", "0512345678", "+966512345678", "966 51 234 5678", "٠٥١٢٣٤٥٦٧٨"]) {
      assert.equal(toE164("+966", v), "+966512345678", v);
    }
  });
  it("rejects Saudi landlines / short numbers", () => {
    assert.equal(toE164("+966", "112345678"), null);
    assert.equal(toE164("+966", "51234"), null);
  });
  it("accepts other countries", () => {
    assert.equal(toE164("+20", "01001234567"), "+201001234567");
    assert.equal(toE164("+44", "07700 900123"), "+447700900123");
  });
});

describe("ics", () => {
  it("produces a valid, folded VEVENT in UTC", () => {
    const ics = buildIcs({
      uid: "abc",
      start: "2026-11-18T07:00:00.000Z",
      end: "2026-11-18T07:30:00.000Z",
      title: "اجتماع تعريفي للجهات — بوصلة الإنسان",
      description: "رابط: https://meet.google.com/abc-defg-hij",
      url: "https://meet.google.com/abc-defg-hij",
    });
    assert.match(ics, /DTSTART:20261118T070000Z/);
    assert.match(ics, /DTEND:20261118T073000Z/);
    for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  });
});
