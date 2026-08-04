import assert from "node:assert/strict";
import test from "node:test";

import {
  progressAccessibilityText,
  progressClampedValue,
  progressFraction,
  progressMaximum,
  progressMinimum,
  progressVisualText,
} from "./sdk12-progress.ts";

test("uses the frozen default progress range", () => {
  const node = { type: "progress", value: 25 } as const;
  assert.equal(progressMinimum(node), 0);
  assert.equal(progressMaximum(node), 100);
  assert.equal(progressClampedValue(node), 25);
  assert.equal(progressFraction(node), 0.25);
  assert.equal(progressVisualText(node), "25");
});

test("calculates percent through a non-zero declared range", () => {
  const node = {
    type: "progress",
    value: 15,
    min: 10,
    max: 30,
    format: "percent",
  } as const;
  assert.equal(progressFraction(node), 0.25);
  assert.equal(progressVisualText(node), "25%");
});

test("clamps only visual presentation while preserving the original value for accessibility", () => {
  const above = {
    type: "progress",
    value: 150,
    min: 0,
    max: 100,
    format: "percent",
  } as const;
  assert.equal(progressClampedValue(above), 100);
  assert.equal(progressFraction(above), 1);
  assert.equal(progressVisualText(above), "100%");
  assert.equal(progressAccessibilityText(above), "150; range 0 to 100; 100% complete");

  const below = { type: "progress", value: -5, min: 0, max: 10 } as const;
  assert.equal(progressClampedValue(below), 0);
  assert.equal(progressFraction(below), 0);
  assert.equal(progressAccessibilityText(below), "-5; range 0 to 10; 0% complete");
});

test("formats finite decimal progress without binary floating-point noise", () => {
  const node = { type: "progress", value: 0.30000000000000004, min: 0, max: 1 } as const;
  assert.equal(progressVisualText(node), "0.3");
  assert.equal(progressAccessibilityText(node), "0.3; range 0 to 1; 30% complete");
});
