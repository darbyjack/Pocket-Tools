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

test("rejects malformed envelopes, inspections, and operations", () => {
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
        JSON.stringify({
          ok: true,
          value: {
            operations: [{ type: "remove", collection: "entries", id: "id", extra: true }],
          },
          logs: [],
          logsTruncated: false,
        }),
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
