import assert from "node:assert/strict";
import test from "node:test";

import { MiniAppRuntimeError, parseRuntimeResponse } from "./protocol.ts";

function response(effects: unknown): string {
  return JSON.stringify({
    ok: true,
    value: {
      operations: [],
      effects,
    },
    logs: [],
    logsTruncated: false,
  });
}

test("parses one public SDK 1.2 feedback effect", () => {
  const parsed = parseRuntimeResponse(response([{ type: "feedback", message: "Saved" }]));
  assert.deepEqual(parsed.value.effects, [{ type: "feedback", message: "Saved" }]);
});

test("counts feedback limits by Unicode code point", () => {
  const message = "😀".repeat(160);
  const parsed = parseRuntimeResponse(response([{ type: "feedback", message }]));
  const effect = parsed.value.effects?.[0];
  assert.equal(effect?.type, "feedback");
  if (effect?.type === "feedback") assert.equal(effect.message, message);
});

const invalidEffects: readonly [string, unknown][] = [
  ["non-array list", { type: "feedback", message: "Saved" }],
  [
    "multiple feedback effects",
    [
      { type: "feedback", message: "First" },
      { type: "feedback", message: "Second" },
    ],
  ],
  ["unsupported type", [{ type: "output", message: "Saved" }]],
  ["extra property", [{ type: "feedback", message: "Saved", duration: 5000 }]],
  ["non-string message", [{ type: "feedback", message: 42 }]],
  ["empty message", [{ type: "feedback", message: "" }]],
  ["overlong message", [{ type: "feedback", message: "😀".repeat(161) }]],
];

for (const [name, effects] of invalidEffects) {
  test(`rejects ${name}`, () => {
    assert.throws(
      () => parseRuntimeResponse(response(effects)),
      (error: unknown) =>
        error instanceof MiniAppRuntimeError && error.code === "INVALID_NATIVE_RESPONSE",
    );
  });
}
