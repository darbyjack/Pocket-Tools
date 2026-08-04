import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import { validatePageNodeWithDormantMultiline } from "./sdk12-multiline-ui.ts";

function inspection(sdkVersion: "1.0" | "1.1" | "1.2"): MiniAppInspection {
  return {
    manifest: { id: "notes-tool", name: "Notes Tool", sdkVersion },
    settings: {
      notes: {
        type: "text",
        label: "Notes",
        default: "",
        maxLength: 10_000,
      },
      count: {
        type: "number",
        label: "Count",
        default: 0,
      },
    },
    collections: {},
    screens: ["home"],
    actions: [],
  };
}

function page(input: Record<string, unknown>) {
  return { type: "page", title: "Notes", children: [input] };
}

test("accepts bounded multiline text input only through the dormant SDK 1.2 path", () => {
  const value = page({
    type: "text-input",
    setting: "notes",
    placeholder: "Add notes",
    multiline: true,
    minLines: 4,
  });

  assert.throws(
    () => validatePageNodeWithDormantMultiline(value, inspection("1.2")),
    /require SDK 1\.2/,
  );
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantMultiline(value, inspection("1.2"), {
      allowDormantSdk12: true,
    }),
  );
});

test("rejects multiline properties for SDK 1.0 and 1.1 definitions", () => {
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.throws(
      () =>
        validatePageNodeWithDormantMultiline(
          page({ type: "text-input", setting: "notes", multiline: false }),
          inspection(sdkVersion),
          { allowDormantSdk12: true },
        ),
      /require SDK 1\.2/,
    );
  }
});

test("accepts ordinary SDK 1.0 and 1.1 text inputs unchanged", () => {
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.doesNotThrow(() =>
      validatePageNodeWithDormantMultiline(
        page({ type: "text-input", setting: "notes", placeholder: "Notes" }),
        inspection(sdkVersion),
      ),
    );
  }
});

test("requires a boolean multiline flag and bounded integer minLines", () => {
  const options = { allowDormantSdk12: true } as const;
  const current = inspection("1.2");

  assert.throws(
    () =>
      validatePageNodeWithDormantMultiline(
        page({ type: "text-input", setting: "notes", multiline: "yes" }),
        current,
        options,
      ),
    /multiline: Expected a boolean/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantMultiline(
        page({ type: "text-input", setting: "notes", minLines: 4 }),
        current,
        options,
      ),
    /minLines requires multiline: true/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantMultiline(
        page({ type: "text-input", setting: "notes", multiline: false, minLines: 4 }),
        current,
        options,
      ),
    /minLines requires multiline: true/,
  );

  for (const minLines of [1, 2.5, 9]) {
    assert.throws(
      () =>
        validatePageNodeWithDormantMultiline(
          page({ type: "text-input", setting: "notes", multiline: true, minLines }),
          current,
          options,
        ),
      /integer from 2 to 8/,
    );
  }

  for (const minLines of [2, 8]) {
    assert.doesNotThrow(() =>
      validatePageNodeWithDormantMultiline(
        page({ type: "text-input", setting: "notes", multiline: true, minLines }),
        current,
        options,
      ),
    );
  }
});

test("preserves ordinary trusted binding and exact-property validation", () => {
  const options = { allowDormantSdk12: true } as const;
  const current = inspection("1.2");

  assert.throws(
    () =>
      validatePageNodeWithDormantMultiline(
        page({ type: "text-input", setting: "count", multiline: true }),
        current,
        options,
      ),
    /incompatible type number/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantMultiline(
        page({ type: "text-input", setting: "notes", multiline: true, rows: 4 }),
        current,
        options,
      ),
    /rows: Unknown UI property/,
  );
});
