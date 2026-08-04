import assert from "node:assert/strict";
import test from "node:test";

import {
  MiniAppRuntimeError,
  parseDormantSdk12RuntimeResponse,
  parseRuntimeResponse,
} from "./protocol.ts";

function response(page: unknown): string {
  return JSON.stringify({
    ok: true,
    value: { operations: [], page },
    logs: [],
    logsTruncated: false,
  });
}

function page(input: Record<string, unknown>) {
  return { type: "page", title: "Notes", children: [input] };
}

function invalidUiTree(error: unknown): boolean {
  return error instanceof MiniAppRuntimeError && error.code === "INVALID_UI_TREE";
}

test("parses dormant SDK 1.2 multiline text input without changing its shape", () => {
  const value = page({
    type: "text-input",
    setting: "notes",
    label: "Notes",
    placeholder: "Add notes",
    multiline: true,
    minLines: 5,
  });

  assert.throws(() => parseRuntimeResponse(response(value)), invalidUiTree);
  assert.deepEqual(parseDormantSdk12RuntimeResponse(response(value)).value.page, value);
});

test("rejects malformed dormant multiline response properties", () => {
  for (const input of [
    { type: "text-input", setting: "notes", multiline: "true" },
    { type: "text-input", setting: "notes", minLines: 4 },
    { type: "text-input", setting: "notes", multiline: false, minLines: 4 },
    { type: "text-input", setting: "notes", multiline: true, minLines: 1 },
    { type: "text-input", setting: "notes", multiline: true, minLines: 9 },
    { type: "text-input", setting: "notes", multiline: true, minLines: 3.5 },
  ]) {
    assert.throws(() => parseDormantSdk12RuntimeResponse(response(page(input))), invalidUiTree);
  }
});

test("keeps ordinary text input responses compatible with the normal parser", () => {
  const value = page({ type: "text-input", setting: "notes", placeholder: "Notes" });
  assert.deepEqual(parseRuntimeResponse(response(value)).value.page, value);
});
