import assert from "node:assert/strict";
import test from "node:test";

import { formatDateTime, formatDisplayValue, formatDuration } from "./display-format.ts";

test("formats money and numbers with the host locale", () => {
  assert.equal(formatDisplayValue(1234.5, "money"), "$1,234.50");
  assert.equal(formatDisplayValue(1234.5, "number"), "1,234.5");
});

test("formats durations without depending on device locale", () => {
  assert.equal(formatDuration(3_661.9), "01:01:01");
  assert.equal(formatDisplayValue(-4, "duration"), "00:00:00");
});

test("preserves invalid date strings", () => {
  assert.equal(formatDateTime("not-a-date"), "not-a-date");
});
