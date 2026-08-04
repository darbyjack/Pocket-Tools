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
      inspection: {
        manifest: {
          id: "multi-select-tool",
          name: "Multi-select Tool",
          sdkVersion: "1.2",
        },
        settings: {
          tags: {
            type: "multi-select",
            label: "Tags",
            options: [
              { label: "Work", value: "work" },
              { label: "Personal", value: "personal" },
            ],
            default: ["work"],
            minSelections: 1,
            maxSelections: 2,
          },
        },
        collections: {},
        screens: ["home"],
        actions: ["save"],
      },
      page: {
        type: "page",
        title: "Tags",
        children: [{ type: "multi-select", setting: "tags", label: "Tags" }],
      },
      operations: [
        { type: "setting-set", setting: "tags", value: ["work", "personal"] },
      ],
    },
  });
}

test("keeps normal response parsing closed to SDK 1.2 multi-select output", () => {
  assert.throws(() => parseRuntimeResponse(response()), /SDK version 1\.2 is not supported/);
});

test("preserves multi-select definitions, UI, and array operations in dormant parsing", () => {
  const parsed = parseDormantSdk12RuntimeResponse(response());
  assert.equal(parsed.value.inspection?.settings.tags?.type, "multi-select");
  assert.deepEqual(parsed.value.inspection?.settings.tags?.default, ["work"]);
  assert.equal(parsed.value.page?.children[0]?.type, "multi-select");
  assert.deepEqual(parsed.value.operations[0], {
    type: "setting-set",
    setting: "tags",
    value: ["work", "personal"],
  });
});

test("does not silently normalize untrusted operation arrays", () => {
  const malformed = JSON.parse(response()) as {
    value: { operations: [{ value: unknown }] };
  };
  malformed.value.operations[0].value = ["personal", "work"];

  const parsed = parseDormantSdk12RuntimeResponse(JSON.stringify(malformed));
  assert.deepEqual(parsed.value.operations[0], {
    type: "setting-set",
    setting: "tags",
    value: ["personal", "work"],
  });
});
