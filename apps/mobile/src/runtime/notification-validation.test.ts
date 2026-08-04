import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import {
  normalizeNotificationRequest,
  notificationUsesExactDelivery,
  parseNotificationRequestShape,
} from "./notification-validation.ts";

const inspection: MiniAppInspection = {
  manifest: { id: "reminder-test", name: "Reminder Test", sdkVersion: "1.2" },
  settings: {},
  collections: {},
  screens: ["home", "details"],
  actions: ["save"],
};

const now = "2026-08-04T05:30:00.000Z";

test("normalizes supported notification triggers and default delivery", () => {
  assert.deepEqual(
    normalizeNotificationRequest(
      {
        id: "dailyReminder",
        title: "Daily reminder",
        body: "",
        trigger: { type: "daily", hour: 8, minute: 30 },
        open: { screen: "details", input: { recordId: "abc" } },
      },
      inspection,
      "request",
    ),
    {
      id: "dailyReminder",
      title: "Daily reminder",
      body: "",
      trigger: { type: "daily", hour: 8, minute: 30, delivery: "standard" },
      open: { screen: "details", input: { recordId: "abc" } },
    },
  );

  const exact = normalizeNotificationRequest(
    {
      id: "weeklyReminder",
      title: "Weekly reminder",
      trigger: { type: "weekly", weekday: 7, hour: 20, minute: 0, delivery: "exact" },
    },
    inspection,
    "request",
  );
  assert.equal(notificationUsesExactDelivery(exact), true);
});

test("requires one-time reminders to be canonical and in the future when requested", () => {
  const request = normalizeNotificationRequest(
    {
      id: "appointment",
      title: "Appointment",
      trigger: { type: "date", at: "2026-08-04T06:00:00.000Z" },
    },
    inspection,
    "request",
    { now, requireFutureDate: true },
  );
  assert.deepEqual(request.trigger, {
    type: "date",
    at: "2026-08-04T06:00:00.000Z",
    delivery: "standard",
  });

  assert.throws(
    () =>
      normalizeNotificationRequest(
        {
          id: "appointment",
          title: "Appointment",
          trigger: { type: "date", at: now },
        },
        inspection,
        "request",
        { now, requireFutureDate: true },
      ),
    /must be in the future/,
  );
});

test("shape parsing defers declared-screen validation to the trusted tool boundary", () => {
  const shaped = parseNotificationRequestShape(
    {
      id: "openLater",
      title: "Open later",
      trigger: { type: "immediate" },
      open: { screen: "missing" },
    },
    "request",
  );
  assert.equal(shaped.open?.screen, "missing");

  assert.throws(
    () => normalizeNotificationRequest(shaped, inspection, "request"),
    /must name a declared screen/,
  );
});

const invalidRequests: readonly [string, unknown, RegExp][] = [
  [
    "unknown property",
    { id: "test", title: "Test", trigger: { type: "immediate" }, channel: "custom" },
    /channel is not supported/,
  ],
  [
    "overlong title",
    { id: "test", title: "a".repeat(81), trigger: { type: "immediate" } },
    /1 to 80/,
  ],
  [
    "overlong body",
    { id: "test", title: "Test", body: "a".repeat(241), trigger: { type: "immediate" } },
    /0 to 240/,
  ],
  [
    "invalid daily time",
    { id: "test", title: "Test", trigger: { type: "daily", hour: 24, minute: 0 } },
    /0 to 23/,
  ],
  [
    "invalid weekly day",
    {
      id: "test",
      title: "Test",
      trigger: { type: "weekly", weekday: 0, hour: 8, minute: 0 },
    },
    /1 to 7/,
  ],
  [
    "invalid date",
    { id: "test", title: "Test", trigger: { type: "date", at: "2026-02-30" } },
    /canonical UTC date-time/,
  ],
  [
    "non-finite input",
    {
      id: "test",
      title: "Test",
      trigger: { type: "immediate" },
      open: { screen: "home", input: Number.POSITIVE_INFINITY },
    },
    /finite and serializable/,
  ],
];

for (const [name, request, expected] of invalidRequests) {
  test(`rejects ${name}`, () => {
    assert.throws(() => normalizeNotificationRequest(request, inspection, "request"), expected);
  });
}
