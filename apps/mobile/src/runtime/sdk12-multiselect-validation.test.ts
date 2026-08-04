import assert from "node:assert/strict";
import test from "node:test";

import type { MultiSelectSetting } from "../model.ts";
import { assertSettingValue } from "./sdk-validation.ts";
import { normalizeMultiSelectValue } from "./sdk12-multiselect.ts";

const definition: MultiSelectSetting = {
  type: "multi-select",
  label: "Tags",
  options: [
    { label: "Work", value: "work" },
    { label: "Personal", value: "personal" },
    { label: "Pinned", value: true },
    { label: "Priority", value: 2 },
  ],
  default: ["work"],
  minSelections: 1,
  maxSelections: 3,
  hostSdkVersion: "1.2",
};

test("accepts canonical declared multi-select values", () => {
  assert.doesNotThrow(() =>
    assertSettingValue(definition, ["work", true, 2], "settings.tags", "1.2"),
  );
});

test("normalizes selections into option declaration order", () => {
  assert.deepEqual(
    normalizeMultiSelectValue(definition, [2, "work", true], "settings.tags"),
    ["work", true, 2],
  );
});

test("rejects non-canonical, duplicate, and unknown selections", () => {
  assert.throws(
    () => assertSettingValue(definition, [true, "work"], "settings.tags", "1.2"),
    /declared option order/,
  );
  assert.throws(
    () => assertSettingValue(definition, ["work", "work"], "settings.tags", "1.2"),
    /unique/,
  );
  assert.throws(
    () => assertSettingValue(definition, ["unknown"], "settings.tags", "1.2"),
    /declared options/,
  );
  assert.throws(
    () => assertSettingValue(definition, "work", "settings.tags", "1.2"),
    /Expected an array/,
  );
});

test("enforces minimum and maximum selection counts", () => {
  assert.throws(
    () => assertSettingValue(definition, [], "settings.tags", "1.2"),
    /below the minimum/,
  );
  assert.throws(
    () => assertSettingValue(definition, ["work", "personal", true, 2], "settings.tags", "1.2"),
    /exceeds the maximum/,
  );
});

test("keeps multi-select values gated to SDK 1.2", () => {
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.throws(
      () => assertSettingValue(definition, ["work"], "settings.tags", sdkVersion),
      /require SDK 1\.2/,
    );
  }
});
