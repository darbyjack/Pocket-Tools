import assert from "node:assert/strict";
import test from "node:test";

import { MiniAppRuntimeError, parseRuntimeResponse } from "./protocol.ts";

function response(page: unknown): string {
  return JSON.stringify({
    ok: true,
    value: { operations: [], page },
    logs: [],
    logsTruncated: false,
  });
}

function page(input: Record<string, unknown>) {
  return { type: "page", title: "Numeric", children: [input] };
}

function invalidUiTree(error: unknown): boolean {
  return error instanceof MiniAppRuntimeError && error.code === "INVALID_UI_TREE";
}

test("parses public SDK 1.2 numeric input hints without changing their shape", () => {
  const value = page({
    type: "number-input",
    setting: "amount",
    label: "Amount",
    step: 0.01,
    decimalPlaces: 2,
  });

  assert.deepEqual(parseRuntimeResponse(response(value)).value.page, value);
});

test("rejects malformed public numeric input hint properties", () => {
  for (const input of [
    { type: "number-input", setting: "amount", step: 0 },
    { type: "number-input", setting: "amount", step: -1 },
    { type: "number-input", setting: "amount", step: "0.01" },
    { type: "number-input", setting: "amount", decimalPlaces: -1 },
    { type: "number-input", setting: "amount", decimalPlaces: 7 },
    { type: "number-input", setting: "amount", decimalPlaces: 2.5 },
  ]) {
    assert.throws(() => parseRuntimeResponse(response(page(input))), invalidUiTree);
  }
});

test("keeps ordinary numeric input responses compatible", () => {
  const value = page({ type: "number-input", setting: "amount", label: "Amount" });
  assert.deepEqual(parseRuntimeResponse(response(value)).value.page, value);
});
