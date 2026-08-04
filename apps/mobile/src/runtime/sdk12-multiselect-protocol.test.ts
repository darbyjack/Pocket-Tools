import assert from "node:assert/strict";
import test from "node:test";

import { parseRuntimeResponse } from "./protocol.ts";

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
      operations: [{ type: "setting-set", setting: "tags", value: ["work", "personal"] }],
    },
  });
}

test("preserves public multi-select definitions, UI, and array operations", () => {
  const parsed = parseRuntimeResponse(response());
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

  const parsed = parseRuntimeResponse(JSON.stringify(malformed));
  assert.deepEqual(parsed.value.operations[0], {
    type: "setting-set",
    setting: "tags",
    value: ["personal", "work"],
  });
});
