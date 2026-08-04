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

test("preserves public progress values, bounds, labels, and formats", () => {
  const parsed = parseRuntimeResponse(response());
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
    () => parseRuntimeResponse(JSON.stringify(malformed)),
    /value: Expected a finite number/,
  );

  const invalidFormat = JSON.parse(response()) as {
    value: { page: { children: [{}, { format?: string }] } };
  };
  invalidFormat.value.page.children[1].format = "ratio";
  assert.throws(
    () => parseRuntimeResponse(JSON.stringify(invalidFormat)),
    /format: Expected number or percent/,
  );
});
