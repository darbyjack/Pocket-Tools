import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import { validatePageNodeWithDormantFormHints } from "./sdk12-multiline-ui.ts";

function inspection(sdkVersion: "1.0" | "1.1" | "1.2"): MiniAppInspection {
  return {
    manifest: { id: "progress-tool", name: "Progress Tool", sdkVersion },
    settings: {},
    collections: {},
    screens: ["home"],
    actions: [],
  };
}

function page(child: Record<string, unknown>) {
  return { type: "page", title: "Progress", children: [child] };
}

const dormant = { allowDormantSdk12: true } as const;

test("accepts the frozen progress shapes only through dormant SDK 1.2 validation", () => {
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(
      page({ type: "progress", value: 25 }),
      inspection("1.2"),
      dormant,
    ),
  );
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(
      page({
        type: "progress",
        label: "Completed",
        value: 7,
        min: 0,
        max: 10,
        format: "number",
      }),
      inspection("1.2"),
      dormant,
    ),
  );
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(
      page({ type: "progress", value: 15, min: 10, max: 30, format: "percent" }),
      inspection("1.2"),
      dormant,
    ),
  );
});

test("keeps normal parsing and lower SDK versions closed to progress nodes", () => {
  const value = page({ type: "progress", value: 25 });
  assert.throws(
    () => validatePageNodeWithDormantFormHints(value, inspection("1.2")),
    /Progress nodes require SDK 1\.2/,
  );
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.throws(
      () => validatePageNodeWithDormantFormHints(value, inspection(sdkVersion), dormant),
      /Progress nodes require SDK 1\.2/,
    );
  }
});

test("allows finite values outside the declared range for visual clamping", () => {
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(
      page({ type: "progress", value: 150, min: 0, max: 100, format: "percent" }),
      inspection("1.2"),
      dormant,
    ),
  );
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(
      page({ type: "progress", value: -5, min: 0, max: 10 }),
      inspection("1.2"),
      dormant,
    ),
  );
});

test("rejects non-finite values and invalid bounds", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(
      () =>
        validatePageNodeWithDormantFormHints(
          page({ type: "progress", value }),
          inspection("1.2"),
          dormant,
        ),
      /value: Expected a finite number/,
    );
  }
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "progress", value: 1, min: Number.NaN }),
        inspection("1.2"),
        dormant,
      ),
    /min: Expected a finite number/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "progress", value: 1, max: Number.POSITIVE_INFINITY }),
        inspection("1.2"),
        dormant,
      ),
    /max: Expected a finite number/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "progress", value: 1, min: 10, max: 10 }),
        inspection("1.2"),
        dormant,
      ),
    /max: Expected max to be greater than min/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "progress", value: 1, min: 10, max: 5 }),
        inspection("1.2"),
        dormant,
      ),
    /max: Expected max to be greater than min/,
  );
});

test("rejects malformed labels, formats, and unknown styling", () => {
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "progress", label: 7, value: 1 }),
        inspection("1.2"),
        dormant,
      ),
    /label: Expected text/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "progress", value: 1, format: "ratio" }),
        inspection("1.2"),
        dormant,
      ),
    /format: Expected number or percent/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "progress", value: 1, color: "green" }),
        inspection("1.2"),
        dormant,
      ),
    /color: Unknown UI property/,
  );
});

test("accepts progress nodes nested in host-owned layout containers", () => {
  const value = {
    type: "page",
    title: "Progress",
    children: [
      {
        type: "section",
        title: "Status",
        children: [
          {
            type: "column",
            children: [{ type: "progress", label: "Upload", value: 3, min: 0, max: 4 }],
          },
        ],
      },
    ],
  };
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(value, inspection("1.2"), dormant),
  );
});
