import assert from "node:assert/strict";
import test from "node:test";

import {
  parseNativeNotificationOpenTarget,
  parseNativeNotificationResults,
} from "./validation.ts";

test("parses exact native reconciliation results", () => {
  assert.deepEqual(
    parseNativeNotificationResults(
      JSON.stringify([
        {
          hostId: "host",
          storageId: "example-tool",
          notificationId: "dailyReminder",
          status: "scheduled",
          platformId: "host",
        },
        {
          hostId: "blocked",
          storageId: "example-tool",
          notificationId: "exactReminder",
          status: "blocked",
          message: "Exact access required",
        },
      ]),
    ),
    [
      {
        hostId: "host",
        storageId: "example-tool",
        notificationId: "dailyReminder",
        status: "scheduled",
        platformId: "host",
      },
      {
        hostId: "blocked",
        storageId: "example-tool",
        notificationId: "exactReminder",
        status: "blocked",
        message: "Exact access required",
      },
    ],
  );
});

test("rejects malformed reconciliation results", () => {
  assert.throws(() => parseNativeNotificationResults("{"), /invalid JSON/);
  assert.throws(() => parseNativeNotificationResults("{}"), /invalid data/);
  assert.throws(
    () =>
      parseNativeNotificationResults(
        JSON.stringify([
          {
            hostId: "host",
            storageId: "example-tool",
            notificationId: "dailyReminder",
            status: "unknown",
          },
        ]),
      ),
    /status is unsupported/,
  );
  assert.throws(
    () =>
      parseNativeNotificationResults(
        JSON.stringify([
          {
            hostId: "host",
            storageId: "example-tool",
            notificationId: "dailyReminder",
            status: "scheduled",
            nativePayload: true,
          },
        ]),
      ),
    /nativePayload is not supported/,
  );
});

test("parses exact native tap routing state", () => {
  assert.deepEqual(
    parseNativeNotificationOpenTarget(
      JSON.stringify({
        hostId: "host",
        storageId: "example-tool",
        notificationId: "dailyReminder",
        screen: "details",
        input: { id: "abc" },
      }),
    ),
    {
      hostId: "host",
      storageId: "example-tool",
      notificationId: "dailyReminder",
      screen: "details",
      input: { id: "abc" },
    },
  );
  assert.equal(parseNativeNotificationOpenTarget(null), null);
});

test("rejects malformed native tap routing state", () => {
  assert.throws(() => parseNativeNotificationOpenTarget("{"), /routing JSON is invalid/);
  assert.throws(
    () =>
      parseNativeNotificationOpenTarget(
        JSON.stringify({
          hostId: "host",
          storageId: "example-tool",
          notificationId: "dailyReminder",
          action: "run",
        }),
      ),
    /action is not supported/,
  );
});
