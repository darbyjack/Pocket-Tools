import assert from "node:assert/strict";
import test from "node:test";

import {
  formatNumberInputValue,
  normalizeNumberInputValue,
  parseNumberInputDraft,
  stepNumberInputValue,
} from "./number-input-hints.ts";

test("formats numeric input values with optional fixed decimal precision", () => {
  assert.equal(formatNumberInputValue(12.5), "12.5");
  assert.equal(formatNumberInputValue(12.5, 2), "12.50");
  assert.equal(formatNumberInputValue(12.6, 0), "13");
  assert.equal(formatNumberInputValue(-0, 2), "0.00");
});

test("parses, rounds, and constrains committed drafts", () => {
  assert.equal(parseNumberInputDraft(" 1.235 ", { decimalPlaces: 2 }), 1.24);
  assert.equal(parseNumberInputDraft("-5", { min: 0 }), 0);
  assert.equal(parseNumberInputDraft("15", { max: 10 }), 10);
  assert.equal(parseNumberInputDraft(""), undefined);
  assert.equal(parseNumberInputDraft("not-a-number"), undefined);
});

test("applies decimal steps without floating-point display noise", () => {
  assert.equal(stepNumberInputValue(0.2, 1, { step: 0.1 }), 0.3);
  assert.equal(stepNumberInputValue(0.3, -1, { step: 0.1 }), 0.2);
  assert.equal(stepNumberInputValue(1.005, 1, { step: 0.01, decimalPlaces: 2 }), 1.02);
});

test("step controls respect declared numeric bounds", () => {
  assert.equal(stepNumberInputValue(10, 1, { step: 1, max: 10 }), 10);
  assert.equal(stepNumberInputValue(0, -1, { step: 1, min: 0 }), 0);
  assert.equal(stepNumberInputValue(5, 1, { step: 2, min: 0, max: 6 }), 6);
});

test("rejects invalid or non-finite normalization and step inputs", () => {
  assert.equal(normalizeNumberInputValue(Number.NaN), undefined);
  assert.equal(stepNumberInputValue(1, 1, { step: 0 }), undefined);
  assert.equal(stepNumberInputValue(1, 1, { step: Number.POSITIVE_INFINITY }), undefined);
});
