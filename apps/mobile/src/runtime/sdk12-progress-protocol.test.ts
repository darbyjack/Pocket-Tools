import assert from "node:assert/strict";
import test from "node:test";

import { parseDormantSdk12RuntimeResponse, parseRuntimeResponse } from "./protocol.ts";

function response(): string {
  return JSON.stringify({
    ok: true,
    logs: [],
    logsTruncated: false,
    value: {
      page: {
        type: "page",
        title: "Progress",
        children: [
          { type: "progress", value: 25 },
          {
            type: "progress",
            label: "Upload",
            value: 15,
            min: 10,
            max: 30,
            format: "percent",
          },
        ],
      },
      operations: [],
    },
  });
}

test("keeps normal response parsing closed to SDK 1.2 progress output", () => {
  assert.throws(() => parseRuntimeResponse(response()), /Progress nodes require SDK 1\.2/);
});

test("preserves progress values, bounds, labels, and formats in dormant parsing", () => {
  const parsed = parseDormantSdk12RuntimeResponse(response());
  assert.deepEqual(parsed.value.page?.children, [
    { type: "progress", value: 25 },
    {
      type: "progress",
      label: "Upload",
      value: 15,
      min: 10,
      max: 30,
      format: "percent",
    },
  ]);
});

test("rejects malformed progress output from the native boundary", () => {
  const malformed = JSON.parse(response()) as {
    value: { page: { children: [{ value: unknown }, { format?: string }] } };
  };
  malformed.value.page.children[0].value = null;
  assert.throws(
    () => parseDormantSdk12RuntimeResponse(JSON.stringify(malformed)),
    /value: Expected a finite number/,
  );

  const invalidFormat = JSON.parse(response()) as {
    value: { page: { children: [{}, { format?: string }] } };
  };
  invalidFormat.value.page.children[1].format = "ratio";
  assert.throws(
    () => parseDormantSdk12RuntimeResponse(JSON.stringify(invalidFormat)),
    /format: Expected number or percent/,
  );
});
