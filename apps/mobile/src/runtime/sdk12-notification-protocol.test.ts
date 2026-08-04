import assert from "node:assert/strict";
import test from "node:test";

import { MiniAppRuntimeError, parseRuntimeResponse } from "./protocol.ts";
import { parseDormantSdk12NotificationRuntimeResponse } from "./sdk12-notification-protocol.ts";

function response(operations: unknown): string {
  return JSON.stringify({
    ok: true,
    value: { operations },
    logs: [],
    logsTruncated: false,
  });
}

test("parses dormant notification operations in their original order", () => {
  const parsed = parseDormantSdk12NotificationRuntimeResponse(
    response([
      { type: "timer-start", timerId: "work", startedAt: "2026-08-04T05:30:00.000Z" },
      {
        type: "notification-schedule",
        request: {
          id: "finishWork",
          title: "Finish work",
          trigger: { type: "daily", hour: 17, minute: 0 },
        },
      },
      { type: "notification-cancel", notificationId: "oldReminder" },
      { type: "notification-cancel-all" },
      { type: "timer-stop", timerId: "work" },
    ]),
  );

  assert.deepEqual(
    parsed.value.operations.map((operation) => operation.type),
    [
      "timer-start",
      "notification-schedule",
      "notification-cancel",
      "notification-cancel-all",
      "timer-stop",
    ],
  );
  const schedule = parsed.value.operations[1];
  assert.equal(schedule?.type, "notification-schedule");
  if (schedule?.type === "notification-schedule") {
    assert.deepEqual(schedule.request.trigger, {
      type: "daily",
      hour: 17,
      minute: 0,
      delivery: "standard",
    });
  }
});

test("normal response parsing rejects dormant notification operations", () => {
  assert.throws(
    () =>
      parseRuntimeResponse(
        response([
          {
            type: "notification-schedule",
            request: { id: "test", title: "Test", trigger: { type: "immediate" } },
          },
        ]),
      ),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
  );
});

const invalidOperations: readonly [string, unknown][] = [
  [
    "missing request",
    [{ type: "notification-schedule" }],
  ],
  [
    "extra schedule key",
    [
      {
        type: "notification-schedule",
        request: { id: "test", title: "Test", trigger: { type: "immediate" } },
        platform: "android",
      },
    ],
  ],
  [
    "invalid request",
    [
      {
        type: "notification-schedule",
        request: { id: "test", title: "", trigger: { type: "immediate" } },
      },
    ],
  ],
  ["invalid cancel id", [{ type: "notification-cancel", notificationId: "not-valid" }]],
  ["extra cancel-all key", [{ type: "notification-cancel-all", all: true }]],
];

for (const [name, operations] of invalidOperations) {
  test(`rejects ${name}`, () => {
    assert.throws(
      () => parseDormantSdk12NotificationRuntimeResponse(response(operations)),
      (error: unknown) =>
        error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
    );
  });
}
