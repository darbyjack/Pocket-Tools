import assert from "node:assert/strict";
import test from "node:test";

import { parseRuntimeResponse } from "./protocol.ts";

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

test("preserves public SDK 1.2 badge text and semantic tone", () => {
  const parsed = parseRuntimeResponse(response());
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
    () => parseRuntimeResponse(JSON.stringify(malformed)),
    /Expected neutral, info, success, warning, or danger/,
  );
});
