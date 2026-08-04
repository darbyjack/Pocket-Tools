import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import { validatePageNodeWithDormantFormHints } from "./sdk12-multiline-ui.ts";

function inspection(sdkVersion: "1.0" | "1.1" | "1.2"): MiniAppInspection {
  return {
    manifest: { id: "numeric-tool", name: "Numeric Tool", sdkVersion },
    settings: {
      amount: {
        type: "money",
        label: "Amount",
        default: 0,
        min: 0,
      },
      count: {
        type: "number",
        label: "Count",
        default: 1,
        min: 1,
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
  return { type: "page", title: "Numeric", children: [input] };
}

test("accepts numeric input hints only through the dormant SDK 1.2 path", () => {
  const value = page({
    type: "number-input",
    setting: "amount",
    label: "Amount",
    step: 0.01,
    decimalPlaces: 2,
  });

  assert.throws(
    () => validatePageNodeWithDormantFormHints(value, inspection("1.2")),
    /require SDK 1\.2/,
  );
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(value, inspection("1.2"), {
      allowDormantSdk12: true,
    }),
  );
});

test("rejects numeric input hints for SDK 1.0 and 1.1 definitions", () => {
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.throws(
      () =>
        validatePageNodeWithDormantFormHints(
          page({ type: "number-input", setting: "amount", step: 1 }),
          inspection(sdkVersion),
          { allowDormantSdk12: true },
        ),
      /require SDK 1\.2/,
    );
    assert.throws(
      () =>
        validatePageNodeWithDormantFormHints(
          page({ type: "number-input", setting: "amount", decimalPlaces: 0 }),
          inspection(sdkVersion),
          { allowDormantSdk12: true },
        ),
      /require SDK 1\.2/,
    );
  }
});

test("accepts ordinary SDK 1.0 and 1.1 numeric inputs unchanged", () => {
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.doesNotThrow(() =>
      validatePageNodeWithDormantFormHints(
        page({ type: "number-input", setting: "amount", label: "Amount" }),
        inspection(sdkVersion),
      ),
    );
  }
});

test("requires a positive finite step and bounded decimal precision", () => {
  const options = { allowDormantSdk12: true } as const;
  const current = inspection("1.2");

  for (const step of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
    assert.throws(
      () =>
        validatePageNodeWithDormantFormHints(
          page({ type: "number-input", setting: "amount", step }),
          current,
          options,
        ),
      /finite number greater than zero/,
    );
  }

  for (const decimalPlaces of [-1, 1.5, 7, "2"]) {
    assert.throws(
      () =>
        validatePageNodeWithDormantFormHints(
          page({ type: "number-input", setting: "amount", decimalPlaces }),
          current,
          options,
        ),
      /integer from 0 to 6/,
    );
  }

  for (const decimalPlaces of [0, 6]) {
    assert.doesNotThrow(() =>
      validatePageNodeWithDormantFormHints(
        page({ type: "number-input", setting: "count", step: 1, decimalPlaces }),
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
      validatePageNodeWithDormantFormHints(
        page({ type: "number-input", setting: "notes", step: 1 }),
        current,
        options,
      ),
    /incompatible type text/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "number-input", setting: "amount", step: 0.01, precision: 2 }),
        current,
        options,
      ),
    /precision: Unknown UI property/,
  );
});
