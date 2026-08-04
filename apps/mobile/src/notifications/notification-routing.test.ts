import assert from "node:assert/strict";
import test from "node:test";

import {
  extractNotificationHostId,
  normalizeNotificationOpenTarget,
} from "./notification-routing.ts";

test("extracts only Pocket Tools notification deep links", () => {
  assert.equal(
    extractNotificationHostId(
      "pocket-tools://notification?hostId=pocket-tools%3A12%3Aexample-tool%3AdailyReminder",
    ),
    "pocket-tools:12:example-tool:dailyReminder",
  );
  assert.equal(extractNotificationHostId("https://example.com/notification?hostId=test"), null);
  assert.equal(extractNotificationHostId("pocket-tools://notification"), null);
  assert.equal(extractNotificationHostId("not a url"), null);
});

test("defaults native notification routes to the home screen", () => {
  assert.deepEqual(
    normalizeNotificationOpenTarget({
      hostId: "host",
      storageId: "example-tool",
      notificationId: "dailyReminder",
    }),
    {
      hostId: "host",
      storageId: "example-tool",
      notificationId: "dailyReminder",
      screen: "home",
    },
  );
});

test("preserves declared screen input", () => {
  assert.deepEqual(
    normalizeNotificationOpenTarget({
      hostId: "host",
      storageId: "example-tool",
      notificationId: "dailyReminder",
      screen: "details",
      input: { recordId: "abc" },
    }),
    {
      hostId: "host",
      storageId: "example-tool",
      notificationId: "dailyReminder",
      screen: "details",
      input: { recordId: "abc" },
    },
  );
});

test("rejects invalid native routing data", () => {
  assert.throws(
    () =>
      normalizeNotificationOpenTarget({
        hostId: "",
        storageId: "example-tool",
        notificationId: "dailyReminder",
      }),
    /routing identity is invalid/,
  );
  assert.throws(
    () =>
      normalizeNotificationOpenTarget({
        hostId: "host",
        storageId: "example-tool",
        notificationId: "dailyReminder",
        screen: "not-valid",
      }),
    /routing screen is invalid/,
  );
  assert.throws(
    () =>
      normalizeNotificationOpenTarget({
        hostId: "host",
        storageId: "example-tool",
        notificationId: "dailyReminder",
        input: Number.POSITIVE_INFINITY,
      }),
    /routing input is invalid/,
  );
});
