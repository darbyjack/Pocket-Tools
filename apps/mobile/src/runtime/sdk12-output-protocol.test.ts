import assert from "node:assert/strict";
import test from "node:test";

import {
  MiniAppRuntimeError,
  parseDormantSdk12RuntimeResponse,
  parseRuntimeResponse,
} from "./protocol.ts";
import { parseDormantSdk12NotificationRuntimeResponse } from "./sdk12-notification-protocol.ts";

function response(effects: unknown, operations: unknown = []): string {
  return JSON.stringify({
    ok: true,
    value: {
      operations,
      effects,
    },
    logs: [],
    logsTruncated: false,
  });
}

test("parses dormant copy and share effects", () => {
  const copy = parseDormantSdk12RuntimeResponse(response([{ type: "copy", text: "Copied value" }]));
  assert.deepEqual(copy.value.effects, [{ type: "copy", text: "Copied value" }]);

  const share = parseDormantSdk12RuntimeResponse(
    response([
      { type: "feedback", message: "Ready" },
      { type: "share", title: "Pocket Tools", text: "Shared value" },
    ]),
  );
  assert.deepEqual(share.value.effects, [
    { type: "feedback", message: "Ready" },
    { type: "share", title: "Pocket Tools", text: "Shared value" },
  ]);
});

test("preserves output while parsing dormant notification operations", () => {
  const parsed = parseDormantSdk12NotificationRuntimeResponse(
    response(
      [{ type: "copy", text: "Reminder created" }],
      [
        {
          type: "notification-schedule",
          request: {
            id: "followUp",
            title: "Follow up",
            trigger: { type: "immediate" },
          },
        },
      ],
    ),
  );

  assert.equal(parsed.value.operations[0]?.type, "notification-schedule");
  assert.deepEqual(parsed.value.effects, [{ type: "copy", text: "Reminder created" }]);
});

test("counts output limits by Unicode code point", () => {
  const text = "😀".repeat(10_000);
  const title = "😀".repeat(120);
  const parsed = parseDormantSdk12RuntimeResponse(response([{ type: "share", title, text }]));
  assert.deepEqual(parsed.value.effects, [{ type: "share", title, text }]);
});

test("normal response parsing rejects dormant output effects", () => {
  assert.throws(
    () => parseRuntimeResponse(response([{ type: "copy", text: "Copied" }])),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError &&
      error.code === "INVALID_NATIVE_RESPONSE" &&
      error.message.includes("require SDK 1.2"),
  );
});

const invalidEffects: readonly [string, unknown][] = [
  ["non-array list", { type: "copy", text: "Copied" }],
  [
    "multiple output effects",
    [
      { type: "copy", text: "First" },
      { type: "share", text: "Second" },
    ],
  ],
  [
    "more than two effects",
    [
      { type: "copy", text: "Copied" },
      { type: "feedback", message: "First" },
      { type: "feedback", message: "Second" },
    ],
  ],
  ["unsupported type", [{ type: "open", text: "No" }]],
  ["copy extra property", [{ type: "copy", text: "Copied", format: "html" }]],
  ["copy non-string text", [{ type: "copy", text: 42 }]],
  ["copy empty text", [{ type: "copy", text: "" }]],
  ["copy overlong text", [{ type: "copy", text: "😀".repeat(10_001) }]],
  ["share missing text", [{ type: "share", title: "Title" }]],
  ["share non-object shape", ["share"]],
  ["share non-string text", [{ type: "share", text: false }]],
  ["share empty text", [{ type: "share", text: "" }]],
  ["share overlong text", [{ type: "share", text: "x".repeat(10_001) }]],
  ["share empty title", [{ type: "share", title: "", text: "Shared" }]],
  ["share non-string title", [{ type: "share", title: 42, text: "Shared" }]],
  ["share overlong title", [{ type: "share", title: "😀".repeat(121), text: "Shared" }]],
  ["share extra property", [{ type: "share", text: "Shared", mimeType: "text/plain" }]],
];

for (const [name, effects] of invalidEffects) {
  test(`rejects ${name}`, () => {
    assert.throws(
      () => parseDormantSdk12RuntimeResponse(response(effects)),
      (error: unknown) =>
        error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
    );
  });
}
