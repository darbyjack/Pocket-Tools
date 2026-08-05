import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import { validatePageNodeWithDormantFormHints } from "./sdk12-multiline-ui.ts";

function inspection(sdkVersion: "1.0" | "1.1" | "1.2"): MiniAppInspection {
  return {
    manifest: { id: "multi-select-tool", name: "Multi-select Tool", sdkVersion },
    settings: {
      tags: {
        type: "multi-select",
        label: "Tags",
        options: [
          { label: "Work", value: "work" },
          { label: "Personal", value: "personal" },
        ],
        default: ["work"],
        hostSdkVersion: "1.2",
      },
      notes: {
        type: "text",
        label: "Notes",
        default: "",
      },
    },
    collections: {},
    screens: ["home"],
    actions: [],
  };
}

function page(input: Record<string, unknown>) {
  return { type: "page", title: "Multi-select", children: [input] };
}

test("accepts multi-select UI only through dormant SDK 1.2 validation", () => {
  const value = page({ type: "multi-select", setting: "tags", label: "Tags" });

  assert.throws(
    () => validatePageNodeWithDormantFormHints(value, inspection("1.2")),
    /Unsupported UI node type: multi-select/,
  );
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(value, inspection("1.2"), {
      allowDormantSdk12: true,
    }),
  );
});

test("rejects multi-select UI below SDK 1.2", () => {
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.throws(
      () =>
        validatePageNodeWithDormantFormHints(
          page({ type: "multi-select", setting: "tags" }),
          inspection(sdkVersion),
          { allowDormantSdk12: true },
        ),
      /require SDK 1\.2/,
    );
  }
});

test("requires a compatible multi-select setting binding", () => {
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "multi-select", setting: "notes" }),
        inspection("1.2"),
        { allowDormantSdk12: true },
      ),
    /incompatible type text/,
  );
});

test("rejects unknown multi-select UI properties", () => {
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "multi-select", setting: "tags", columns: 2 }),
        inspection("1.2"),
        { allowDormantSdk12: true },
      ),
    /columns: Unknown UI property/,
  );
});
