import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDormantSdk12RuntimeResponse,
  parseRuntimeResponse,
} from "./protocol.ts";

function response(): string {
  return JSON.stringify({
    ok: true,
    logs: [],
    logsTruncated: false,
    value: {
      page: {
        type: "page",
        title: "Status",
        children: [
          { type: "badge", text: "Pending" },
          { type: "badge", text: "Saved", tone: "success" },
        ],
      },
      operations: [],
    },
  });
}

test("keeps normal response parsing closed to SDK 1.2 badge output", () => {
  assert.throws(() => parseRuntimeResponse(response()), /Badge nodes require SDK 1\.2/);
});

test("preserves badge text and semantic tone in dormant response parsing", () => {
  const parsed = parseDormantSdk12RuntimeResponse(response());
  assert.deepEqual(parsed.value.page?.children, [
    { type: "badge", text: "Pending" },
    { type: "badge", text: "Saved", tone: "success" },
  ]);
});

test("rejects malformed badge output from the native boundary", () => {
  const malformed = JSON.parse(response()) as {
    value: { page: { children: [{ tone?: string }, { tone?: string }] } };
  };
  malformed.value.page.children[1].tone = "purple";

  assert.throws(
    () => parseDormantSdk12RuntimeResponse(JSON.stringify(malformed)),
    /Expected neutral, info, success, warning, or danger/,
  );
});
