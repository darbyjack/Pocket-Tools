import assert from "node:assert/strict";
import test from "node:test";

import {
  metricValue,
  MiniAppRuntimeError,
  parseRuntimeResponse,
  settingIsVisible,
  timerElapsedSeconds,
} from "./protocol.ts";

function success(value: Record<string, unknown>) {
  return JSON.stringify({
    ok: true,
    value: { operations: [], ...value },
    logs: [],
    logsTruncated: false,
  });
}

function sdk12DateInspection() {
  return {
    manifest: { id: "date-tool", name: "Date Tool", sdkVersion: "1.2" },
    settings: {
      dueDate: {
        type: "date",
        label: "Due date",
        default: "2026-08-03",
        min: "2026-01-01",
        max: "2026-12-31",
      },
      reminderAt: {
        type: "datetime",
        label: "Reminder",
        default: "2026-08-04T03:30:00.000Z",
      },
    },
    collections: {
      entries: {
        fields: {
          dueDate: { type: "date" },
          recordedAt: {
            type: "datetime",
            min: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
    screens: ["home"],
    actions: ["save"],
  };
}

test("reconstructs a durable timer from its start timestamp", () => {
  assert.equal(
    timerElapsedSeconds(
      {
        id: "currentTrip",
        startedAt: "2026-08-03T10:00:00.000Z",
        elapsedSeconds: 0,
      },
      Date.parse("2026-08-03T10:10:00.000Z"),
    ),
    600,
  );
});

test("calculates a live money metric without rerunning the script", () => {
  assert.equal(
    metricValue(
      {
        type: "metric",
        label: "Gross earnings equivalent",
        value: 0,
        format: "money",
        liveTimer: { timerId: "currentTrip", ratePerHour: 60 },
      },
      {
        currentTrip: {
          id: "currentTrip",
          startedAt: "2026-08-03T10:00:00.000Z",
          elapsedSeconds: 0,
        },
      },
      Date.parse("2026-08-03T10:10:00.000Z"),
    ),
    10,
  );
});

test("uses declarative setting visibility", () => {
  const definition = {
    type: "money" as const,
    label: "Hourly rate",
    default: 25,
    visibleWhen: { setting: "payType", equals: "hourly" },
  };
  assert.equal(settingIsVisible(definition, { payType: "hourly" }), true);
  assert.equal(settingIsVisible(definition, { payType: "salary" }), false);
});

test("parses an SDK 1.1 inspection and CRUD operations", () => {
  const response = parseRuntimeResponse(
    JSON.stringify({
      ok: true,
      value: {
        inspection: {
          manifest: { id: "example-tool", name: "Example Tool", sdkVersion: "1.1" },
          settings: {
            title: { type: "text", label: "Title", default: "Example" },
          },
          collections: {
            entries: {
              fields: {
                title: { type: "text" },
                complete: { type: "boolean" },
              },
            },
          },
          screens: ["home", "details"],
          actions: ["save"],
        },
        operations: [
          {
            type: "update",
            collection: "entries",
            id: "0123456789abcdef0123456789abcdef",
            changes: { complete: true },
          },
          {
            type: "remove",
            collection: "entries",
            id: "fedcba9876543210fedcba9876543210",
          },
        ],
      },
      logs: [],
      logsTruncated: false,
    }),
  );
  assert.deepEqual(response.value.inspection?.screens, ["home", "details"]);
  assert.equal(response.value.inspection?.manifest.sdkVersion, "1.1");
  assert.equal(response.value.operations.length, 2);
});

test("parses public SDK 1.2 setting operations", () => {
  const response = parseRuntimeResponse(
    success({
      operations: [
        { type: "setting-set", setting: "draftTitle", value: "Saved" },
        { type: "setting-reset", setting: "draftTitle" },
      ],
    }),
  );

  assert.deepEqual(response.value.operations, [
    { type: "setting-set", setting: "draftTitle", value: "Saved" },
    { type: "setting-reset", setting: "draftTitle" },
  ]);
});

test("parses public SDK 1.2 date definitions and nodes through the normal path", () => {
  const inspection = parseRuntimeResponse(success({ inspection: sdk12DateInspection() })).value
    .inspection;
  assert.equal(inspection?.manifest.sdkVersion, "1.2");
  assert.equal(inspection?.settings.dueDate?.type, "date");
  assert.equal(inspection?.settings.reminderAt?.type, "datetime");
  assert.equal(inspection?.collections.entries?.fields.recordedAt?.type, "datetime");

  const page = parseRuntimeResponse(
    success({
      page: {
        type: "page",
        title: "Date Tool",
        children: [
          { type: "date-input", setting: "dueDate" },
          { type: "datetime-input", setting: "reminderAt" },
        ],
      },
    }),
  ).value.page;
  assert.equal(page?.children.length, 2);
});

test("parses public SDK 1.2 notifications and host effects", () => {
  const response = parseRuntimeResponse(
    success({
      operations: [
        {
          type: "notification-schedule",
          request: {
            id: "dailyReview",
            title: "Review entries",
            body: "Open your saved entries.",
            trigger: { type: "daily", hour: 9, minute: 15, delivery: "standard" },
            open: { screen: "home", input: { source: "notification" } },
          },
        },
        { type: "notification-cancel", notificationId: "oldReminder" },
        { type: "notification-cancel-all" },
      ],
      effects: [
        { type: "feedback", message: "Saved" },
        { type: "share", title: "Entries", text: "One saved entry" },
      ],
    }),
  );

  assert.equal(response.value.operations.length, 3);
  assert.deepEqual(response.value.effects, [
    { type: "feedback", message: "Saved" },
    { type: "share", title: "Entries", text: "One saved entry" },
  ]);
});

test("rejects malformed public temporal definitions", () => {
  const invalid = sdk12DateInspection();
  invalid.settings.dueDate.default = "2026-02-30";
  invalid.settings.reminderAt.default = "2026-08-03T22:30:00.000-05:00";

  assert.throws(
    () => parseRuntimeResponse(success({ inspection: invalid })),
    (error: unknown) => {
      if (!(error instanceof MiniAppRuntimeError) || error.code !== "VALIDATION_FAILED")
        return false;
      assert.match(error.message, /settings\.dueDate\.default/);
      assert.match(error.message, /settings\.reminderAt\.default/);
      return true;
    },
  );
});

test("accepts a normalized SDK 1.0 inspection", () => {
  const response = parseRuntimeResponse(
    success({
      inspection: {
        manifest: { id: "example-tool", name: "Example Tool", sdkVersion: "1.0" },
        settings: {},
        collections: {},
        screens: ["home"],
        actions: [],
      },
    }),
  );
  assert.equal(response.value.inspection?.manifest.sdkVersion, "1.0");
});

test("preserves structured sandbox errors and captured logs", () => {
  assert.throws(
    () =>
      parseRuntimeResponse(
        JSON.stringify({
          ok: false,
          error: {
            code: "RUNTIME_TIMEOUT",
            message: "Execution timed out.",
            stack: "at home (miniapp.js:10)",
          },
          logs: [{ level: "warn", message: "before timeout" }],
          logsTruncated: false,
        }),
      ),
    (error: unknown) => {
      if (!(error instanceof MiniAppRuntimeError)) return false;
      assert.equal(error.code, "RUNTIME_TIMEOUT");
      assert.equal(error.scriptStack, "at home (miniapp.js:10)");
      assert.deepEqual(error.logs, [{ level: "warn", message: "before timeout" }]);
      return true;
    },
  );
});

test("rejects malformed envelopes, inspections, operations, and effects", () => {
  assert.throws(
    () => parseRuntimeResponse("not-json"),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
  );
  assert.throws(
    () =>
      parseRuntimeResponse(
        JSON.stringify({ ok: true, value: { operations: [] }, logs: [], logsTruncated: "no" }),
      ),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
  );
  assert.throws(
    () =>
      parseRuntimeResponse(
        success({
          inspection: {
            manifest: { id: "bad", name: "Bad", sdkVersion: "1.1" },
            settings: {},
            collections: {},
            screens: ["missingHome"],
            actions: [],
          },
        }),
      ),
    (error: unknown) => error instanceof MiniAppRuntimeError && error.code === "VALIDATION_FAILED",
  );
  assert.throws(
    () =>
      parseRuntimeResponse(
        success({
          inspection: {
            manifest: { id: "bad", name: "Bad", sdkVersion: "2.0" },
            settings: {},
            collections: {},
            screens: ["home"],
            actions: [],
          },
        }),
      ),
    (error: unknown) => error instanceof MiniAppRuntimeError && error.code === "VALIDATION_FAILED",
  );
  assert.throws(
    () =>
      parseRuntimeResponse(
        success({
          operations: [{ type: "remove", collection: "entries", id: "id", extra: true }],
        }),
      ),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
  );
  assert.throws(
    () =>
      parseRuntimeResponse(
        success({
          operations: [{ type: "setting-set", setting: "draftTitle", value: "Saved", extra: true }],
        }),
      ),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
  );
  assert.throws(
    () =>
      parseRuntimeResponse(
        success({ operations: [{ type: "setting-set", setting: "draftTitle" }] }),
      ),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
  );
  assert.throws(
    () =>
      parseRuntimeResponse(
        success({ effects: [{ type: "feedback", message: "Saved", extra: true }] }),
      ),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
  );
});

test("rejects invalid UI in an otherwise valid native response", () => {
  assert.throws(
    () =>
      parseRuntimeResponse(
        success({
          page: {
            type: "page",
            title: "Unsafe",
            children: [
              {
                type: "metric",
                label: "Amount",
                value: 10,
                format: "money",
                style: { backgroundColor: "red" },
              },
            ],
          },
        }),
      ),
    (error: unknown) => error instanceof MiniAppRuntimeError && error.code === "INVALID_UI_TREE",
  );
});
